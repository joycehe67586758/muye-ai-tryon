/* =========================================================================
   用顾客本人的照片试穿
   站到屏前 → 拍照（本机）→ 照片作为换装模型的人像输入 → 生成"你穿这件"
   没有接入模型时，用本机合成做预览（照片 + 服装图层），保证不空手。
   ========================================================================= */
const PHOTO = (() => {
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
  let video, canvas, ctx, guide, hint, err, stream = null, pose = null, running = false;
  let raf = 0, sending = false, land = null, lastSeen = 0, mode = 'camera', source = null;
  const $ = s => document.querySelector(s);

  const loadImg = src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });

  async function ensurePose() {
    if (pose) return pose;
    if (!window.Pose) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = MP + 'pose.js'; s.onload = res; s.onerror = () => rej(new Error('pose.js 加载失败'));
        document.head.appendChild(s);
      });
    }
    pose = new window.Pose({ locateFile: f => MP + f });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: .5, minTrackingConfidence: .5 });
    pose.onResults(r => { land = r.poseLandmarks || null; if (land) lastSeen = performance.now(); });
    return pose;
  }

  /* 全身是否入镜：肩、髋、膝、踝都识别到 */
  function fullBody() {
    if (!land) return false;
    const need = [11, 12, 23, 24, 25, 26, 27, 28];
    return need.every(i => land[i] && (land[i].visibility ?? 1) > .4);
  }

  function tick() {
    if (!running) return;
    const src = mode === 'image' ? source : video;
    if (src && (mode === 'image' || video.readyState >= 2)) {
      canvas.width = mode === 'image' ? source.naturalWidth : video.videoWidth;
      canvas.height = mode === 'image' ? source.naturalHeight : video.videoHeight;
      if (mode === 'image') {
        ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height); ctx.restore();
      }
      if (pose && !sending) { sending = true; pose.send({ image: src }).catch(() => {}).finally(() => sending = false); }
      const ok = fullBody();
      guide.classList.toggle('ok', ok);
      hint.textContent = ok ? '已识别到全身 · 可以拍' : (performance.now() - lastSeen > 1500 ? '没看到人 · 请站到框里' : '请退后一点，让全身入镜');
    }
    raf = requestAnimationFrame(tick);
  }

  async function start() {
    video = $('#photoVideo'); canvas = $('#photoCanvas'); ctx = canvas.getContext('2d');
    guide = $('#photoGuide'); hint = $('#photoHint'); err = $('#photoErr');
    if (!video) return;
    err.classList.remove('on');
    const q = new URLSearchParams(location.search);
    mode = q.get('livemode') === 'image' ? 'image' : 'camera';
    if (mode === 'image') {
      source = await loadImg('assets/process/models__m3.jpg');
      video.style.display = 'none';
      canvas.style.background = '#F1F1F1';
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        err.classList.add('on');
        $('#photoErrMsg').innerHTML = '这个内置浏览器不支持调用摄像头。<b>请复制下面的链接，用系统里的 Chrome / Edge 打开</b>，浏览器第一次会弹出"允许使用摄像头"，点允许即可。'
          + `<div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
               <button class="btn primary sm" onclick="copyLocal('http://localhost:5173/'+encodeURIComponent('AI虚拟试衣-大屏原型.html')+'?kiosk=1&start=photo')">复制链接</button>
             </div>`;
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      } catch (e) { return showErr(e); }
      video.srcObject = stream;
      await video.play().catch(() => {});
    }
    running = true; cancelAnimationFrame(raf); tick();
    ensurePose().then(() => {}).catch(() => { hint.textContent = '识别不可用 · 仍可拍摄'; });
  }

  function showErr(e) {
    err.classList.add('on');
    const isFile = location.protocol === 'file:';
    const file = decodeURIComponent(location.pathname.split('/').pop() || 'AI虚拟试衣-大屏原型.html');
    const localURL = 'http://localhost:5173/' + encodeURIComponent(file) + location.search;
    $('#photoErrMsg').innerHTML = (isFile
      ? '摄像头只能在 <b>http://localhost</b> 或 https 下打开。先运行 <b>启动原型.bat</b>，再用下面的按钮。'
      : ({
        NotAllowedError: '浏览器拒绝了摄像头权限，点地址栏右侧的摄像头图标允许后重试。',
        NotFoundError: '没有检测到摄像头。',
        NotReadableError: '摄像头被其他程序占用了。',
      }[String(e && e.name)] || ('错误：' + (e && e.name))))
      + `<div style="margin-top:16px"><button class="btn primary sm" onclick="location.href='${localURL}'">用 localhost 打开（推荐）</button></div>`;
  }

  function stop() {
    running = false; cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.srcObject = null;
    if (pose && pose.close) { try { pose.close(); } catch (e) {} pose = null; }
    land = null;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* 拍照：把当前画面（镜像）存成本机 dataURL，并记录姿态用于本地合成 */
  function capture() {
    const cb = $('#photoConsent');
    if (cb && !cb.checked) { toast('请先勾选照片使用同意'); return; }
    const src = mode === 'image' ? source : video;
    if (!src || (!mode === 'image' && video.readyState < 2)) { toast('摄像头还没准备好'); return; }
    const W = mode === 'image' ? source.naturalWidth : video.videoWidth;
    const H = mode === 'image' ? source.naturalHeight : video.videoHeight;
    const scale = Math.min(1, 900 / W);
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const x = c.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1);          // 镜像，和屏幕所见一致
    x.drawImage(src, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', .92);
    S.userPhoto = url;
    S.userPose = land ? land.map(p => ({ x: p.x, y: p.y, v: p.visibility ?? 1 })) : null;
    track('user_photo_captured', { full: fullBody() });
    stop();
    go('outfit');
    toast('已拍下你的照片：照片只在本机使用，60 秒后随画面一起清除');
  }

  function countdown() {
    let n = 3;
    hint.textContent = '倒计时 ' + n;
    const t = setInterval(() => {
      n--;
      if (n > 0) { hint.textContent = '倒计时 ' + n; return; }
      clearInterval(t); capture();
    }, 1000);
  }

  /* 本地回落：顾客照片 + 服装抠图（按拍照时的姿态对齐；没有姿态就用默认位置） */
  async function composite(garmentId) {
    if (!S.userPhoto) return null;
    const item = window.MUYE ? MUYE.byId(garmentId) : null;
    const cut = item && item.cut;
    if (!cut) return null;                       // 这件没有抠图，就回落到商品实拍
    const key = Object.keys(window.LIVE_ANCHOR || {}).find(k => (item.cut || '').includes(k)) || '';
    const [photo, g] = await Promise.all([loadImg(S.userPhoto), loadImg(cut)]);
    const a = (window.LIVE_ANCHOR && LIVE_ANCHOR[key]) || { sY: .2, sW: .72, cx: .5, ar: 1.1 };
    const c = document.createElement('canvas');
    c.width = photo.naturalWidth; c.height = photo.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(photo, 0, 0);
    let w = c.width * .48, cx = c.width * .5, cy = c.height * .40;
    const p = S.userPose;
    if (p && p[11] && p[12]) {
      const P = k => ({ x: (1 - p[k].x) * c.width, y: p[k].y * c.height });   // 照片已镜像
      const l0 = P(11), r0 = P(12);
      const dist = Math.hypot(l0.x - r0.x, l0.y - r0.y);
      if (dist > 20) {
        w = dist * (window.LIVE_FIT.k || 1.06) / a.sW;
        cx = (l0.x + r0.x) / 2; cy = (l0.y + r0.y) / 2;
      }
    }
    const h = w * (g.naturalHeight / g.naturalWidth);
    x.save();
    x.globalAlpha = .97;
    x.drawImage(g, cx - a.cx * w, cy - a.sY * h, w, h);
    x.restore();
    return c.toDataURL('image/jpeg', .92);
  }

  return { start, stop, capture, countdown, composite, get hasPhoto() { return !!S.userPhoto; } };
})();
window.PHOTO = PHOTO;
