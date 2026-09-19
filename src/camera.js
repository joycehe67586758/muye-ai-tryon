/* =========================================================================
   真人试穿 · 实时 AR 试衣镜
   - getUserMedia 打开摄像头（需 localhost / https）
   - MediaPipe Pose 追踪肩线/胯线，把真实服装图实时贴到人身上
   - 追踪失败可手动拖动/缩放；摄像头不可用时可回落到虚拟形象
   ========================================================================= */
const LIVE = (() => {
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
  const K = 1.46;                 // 服装宽度 = 肩宽 × K（与静态合成一致）
  let video, canvas, ctx, errBox, fpsEl;
  let stream = null, pose = null, running = false, rafId = 0, sending = false;
  let land = null, lastSeen = 0, garment = null, garImg = null;
  let adj = { scale: 1, x: 0, y: 0 };
  let mode = 'camera';
  let fps = { t: 0, n: 0 };

  const $ = s => document.querySelector(s);

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
  }

  async function ensurePose() {
    if (pose) return pose;
    if (!window.Pose) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = MP + 'pose.js';
        s.onload = res; s.onerror = () => rej(new Error('pose.js 加载失败'));
        document.head.appendChild(s);
      });
    }
    pose = new window.Pose({ locateFile: f => MP + f });
    pose.setOptions({
      modelComplexity: 1, smoothLandmarks: true,
      minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    pose.onResults(r => {
      land = r.poseLandmarks || null;
      if (land) lastSeen = performance.now();
    });
    return pose;
  }

  /* 用肩线 + 胯线决定服装的位置、大小与倾斜 */
  function fitFromLandmarks(W, H) {
    if (!land || !land[11] || !land[12]) return null;
    const s = k => ({ x: (1 - land[k].x) * W, y: land[k].y * H, v: land[k].visibility ?? 1 });
    const ls = s(11), rs = s(12);
    if (ls.v < 0.4 || rs.v < 0.4) return null;
    const mid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const dist = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    let ang = Math.atan2(rs.y - ls.y, rs.x - ls.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    /* 胯线：判断"上半身是否完整入镜"，只靠肩线会被近距离拍摄骗到 */
    let torso = 0, hipOK = false;
    if (land[23] && land[24]) {
      const lh = s(23), rh = s(24);
      if (lh.v > 0.4 && rh.v > 0.4) {
        hipOK = true;
        torso = Math.abs(((lh.y + rh.y) / 2) - mid.y);
      }
    }
    return { mid, dist, ang, torso, hipOK, ratio: torso / H };
  }

  /* 取景是否合格：上半身要完整，且不能靠得太近 */
  function framing(fit, W, H) {
    if (!fit) return { ok: false, msg: '没找到人 · 请站到画面中间' };
    if (!fit.hipOK) return { ok: false, msg: '请退后一点，让上半身完整入镜' };
    if (fit.ratio > 0.38) return { ok: false, msg: '太近了 · 请退后一步' };
    if (fit.ratio < 0.10) return { ok: false, msg: '有点远 · 请靠近一点' };
    return { ok: true, msg: '取景很好' };
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (mode === 'image' && sourceImage) ctx.drawImage(sourceImage, 0, 0, W, H);
    if (!garImg) return;
    let fit = fitFromLandmarks(W, H);
    let w, cx, cy, ang, tracked = !!fit;
    const fr = framing(fit, W, H);
    const ok = fr.ok;
    if (fit && ok) {
      const a = (window.LIVE_ANCHOR && LIVE_ANCHOR[garment]) || { sY:.2, sW:.72, cx:.5, ar:1.1 };
      const st = (window.LIVE_FIT) || { k:1.02, anchor:'shoulder' };
      w = fit.dist * st.k / a.sW;      // 服装整图宽度 = 肩宽 × 松量 ÷ 服装肩宽占比
      cx = fit.mid.x; cy = fit.mid.y; ang = fit.ang;
    } else {
      // 取景不合格：不硬贴，只给淡淡的示意，不假装"已经穿上了"
      fpsEl.textContent = fr.msg;
      w = W * 0.34; cx = W * 0.5; cy = H * 0.42; ang = 0;
    }
    const scale = adj.scale;
    w *= scale;
    if (w > W * 0.82) w = W * 0.82;        // 限幅：近距离拍摄时衣服不会撑满整屏
    const h = w * (garImg.height / garImg.width);
    const a2 = (window.LIVE_ANCHOR && LIVE_ANCHOR[garment]) || { sY:.2, sW:.72, cx:.5, ar:1.1 };
    ctx.save();
    ctx.globalAlpha = (fit && ok) ? 0.96 : 0.26;
    ctx.translate(cx + adj.x, cy + adj.y);
    ctx.rotate(ang);
    ctx.drawImage(garImg, -a2.cx * w, -a2.sY * h, w, h);
    ctx.restore();
    // 追踪状态提示
    const now = performance.now();
    fps.n++;
    if (now - fps.t > 1000) {
      const f = Math.round(fps.n * 1000 / (now - fps.t));
      fpsEl.textContent = ok ? `取景很好 · ${f} fps` : fr.msg;
      fps.n = 0; fps.t = now;
    }
  }

  async function loop() {
    if (!running) return;
    const src = mode === 'image' ? sourceImage : video;
    if (src && (mode === 'image' || video.readyState >= 2)) {
      canvas.width = mode === 'image' ? sourceImage.naturalWidth : video.videoWidth;
      canvas.height = mode === 'image' ? sourceImage.naturalHeight : video.videoHeight;
      if (pose && !sending) {
        sending = true;
        try { await pose.send({ image: src }); } catch (e) {}
        sending = false;
      }
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }

  let sourceImage = null;

  async function start() {
    video = $('#liveVideo'); canvas = $('#liveCanvas'); ctx = canvas.getContext('2d');
    errBox = $('#liveErr'); fpsEl = $('#liveFps');
    if (!video) return;
    errBox.classList.remove('on');
    const q = new URLSearchParams(location.search);
    mode = q.get('livemode') === 'image' ? 'image' : 'camera';

    if (mode === 'image') {
      sourceImage = await loadImg('assets/process/models__m3.jpg');
      video.style.display = 'none';
      canvas.style.background = '#F2EEE5';
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        errBox.classList.add('on');
        $('#liveErrMsg').innerHTML = '这个内置浏览器不支持调用摄像头。<b>请复制链接，用系统里的 Chrome / Edge 打开</b>，第一次会弹出"允许使用摄像头"。'
          + `<div style="margin-top:16px"><button class="btn primary sm" onclick="copyLocal('http://localhost:5173/'+encodeURIComponent('AI虚拟试衣-大屏原型.html')+'?kiosk=1&start=live')">复制链接</button></div>`;
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false,
        });
      } catch (e) {
        showError(e);
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
    }
    if (!garment) setGarment((window.S && S.liveId) || 'g1');
    running = true;
    cancelAnimationFrame(rafId);
    loop();
    /* 姿态追踪并行加载：加载失败也不影响出效果，用户可手动调整 */
    ensurePose()
      .then(() => { fpsEl.textContent = '姿态追踪已就绪'; })
      .catch(() => { pose = null; fpsEl.textContent = '姿态追踪不可用 · 可拖动手动贴合'; });
  }

  function showError(e) {
    errBox.classList.add('on');
    const m = String(e && e.name || e);
    const tip = {
      NotAllowedError: '浏览器里拒绝了摄像头权限。点地址栏右侧的摄像头图标允许后，再点「重试」。',
      NotFoundError: '没有检测到摄像头设备。',
      NotReadableError: '摄像头被其他程序占用了（比如视频会议软件）。',
    }[m] || ('错误：' + m);
    const isFile = location.protocol === 'file:';
    const file = decodeURIComponent(location.pathname.split('/').pop() || 'AI虚拟试衣-大屏原型.html');
    const localURL = 'http://localhost:5173/' + encodeURIComponent(file) + location.search;
    $('#liveErrMsg').innerHTML = (isFile
      ? `摄像头只能在 <b>http://localhost</b> 或 https 下打开，直接双击 HTML（file://）会被浏览器直接拒绝。<br>先双击交付目录里的 <b>启动原型.bat</b>（或运行 <b>node src/serve.js 5173 .</b>），再点下面的按钮。`
      : tip)
      + `<div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
           <button class="btn primary sm" onclick="location.href='${localURL}'">用 localhost 打开（推荐）</button>
           <button class="btn sm" onclick="copyLocal('${localURL}')">复制 localhost 链接</button>
         </div>`;
  }

  window.copyLocal = function (u) {
    navigator.clipboard && navigator.clipboard.writeText(u)
      .then(() => toast('已复制：' + u)).catch(() => toast(u));
  };

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.srcObject = null;
    if (pose && pose.close) { try { pose.close(); } catch (e) {} pose = null; }
    land = null;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function setGarment(id) {
    const it = window.LIVE_LIST && LIVE_LIST.find(i => i.id === id);
    if (!it) return;
    garment = id;
    garImg = await loadImg(it.img);
  }

  function resetFit() {
    adj = { scale: 1, x: 0, y: 0 };
    ['ltScale', 'ltX', 'ltY'].forEach((k, i) => { const el = $('#' + k); if (el) el.value = i === 0 ? 100 : 0; });
  }

  function bindControls() {
    const bind = (id, key, k) => { const el = $('#' + id); if (el) el.oninput = () => { adj[key] = (+el.value) * k; }; };
    bind('ltScale', 'scale', 0.01); bind('ltX', 'x', 1); bind('ltY', 'y', 1);
    const box = $('.livebox');
    if (!box) return;
    let drag = null;
    box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ax: adj.x, ay: adj.y }; });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      adj.x = drag.ax + (e.clientX - drag.x); adj.y = drag.ay + (e.clientY - drag.y);
    });
    window.addEventListener('pointerup', () => drag = null);
    box.addEventListener('wheel', e => {
      e.preventDefault();
      adj.scale = Math.min(1.6, Math.max(0.6, adj.scale - e.deltaY * 0.001));
    }, { passive: false });
  }

  function toRender() {
    const ids = [garment || (window.LIVE_LIST && LIVE_LIST[0].id) || 'w1'];
    if (window.__liveToRender) return window.__liveToRender(ids);
    track('live_to_render', { id: ids[0] });
    stop();
    S.look = MUYE.byId(ids[0]) ? ids[0] : null;
    renderItems(); renderSel();
    startGen();
  }

  return { start, stop, setGarment, resetFit, toRender, bind: bindControls,
    get state() { return { running, mode, tracked: !!land, garment }; } };
})();

document.addEventListener('DOMContentLoaded', () => LIVE.bind());
window.LIVE = LIVE;   /* 让内联 onclick 与 app.js 都能取到 */


