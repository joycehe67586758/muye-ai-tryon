/* =========================================================================
   交互逻辑：状态机 / 等待与失败 / 隐私计时 / 扫码转化 / 演示控制
   ========================================================================= */
const B = MUYE.BODIES, IT = MUYE.ITEMS;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* 实时 AR 镜用的服装抠图与锚点（挂拍图才适合实时贴合） */
const LIVE_LIST = [
  { id:'g1', name:'燕麦羊毛开衫', tone:'燕麦',   price:399,  img:'assets/process/garments__g1.png' },
  { id:'g2', name:'真丝垂感衬衫', tone:'月光白', price:599,  img:'assets/process/garments__g2.png' },
  { id:'g3', name:'重磅纯棉 T 恤', tone:'石墨黑', price:199, img:'assets/process/garments__g3.png' },
  { id:'g6', name:'炭灰西装外套', tone:'炭灰',   price:899,  img:'assets/process/garments__g6.png' },
];
window.LIVE_LIST = LIVE_LIST;
window.LIVE_ANCHOR = {
  g1:{ sY:0.192, sW:0.709, cx:0.499, ar:1.088 },
  g2:{ sY:0.201, sW:0.640, cx:0.495, ar:1.223 },
  g3:{ sY:0.222, sW:0.785, cx:0.500, ar:1.070 },
  g6:{ sY:0.235, sW:0.784, cx:0.496, ar:1.139 },
  g4:{ sY:0.167, sW:0.716, cx:0.510, ar:1.405 },
  g5:{ sY:0.180, sW:0.700, cx:0.500, ar:1.900 },
  g8:{ sY:0.238, sW:0.945, cx:0.527, ar:1.001 },
};
window.LIVE_FIT = { k:1.06, anchor:'shoulder' };

const S = {
  scr: 'attract',
  avatar: 'm3',
  cat: 'top',
  look: null,
  code: '------',
  view: 'fit',
  genMs: 18000,
  failNext: false,
  staticMode: false,
  liveId: 'g1',
};

const T = { idle: null, idleLeft: 90, gen: null, clear: null, clearLeft: 60 };
const IDLE_SEC = 90, CLEAR_SEC = 60;

function randCode() {
  const c = 'ACDEFGHJKLMNPQRTUVWXY34679';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
const money = n => '¥' + n.toLocaleString('zh-CN');
const body = () => MUYE.bodyById(S.avatar);
const selItems = () => (S.look ? [MUYE.byId(S.look)].filter(Boolean) : []);

/* ------------------------------ 屏幕切换 ------------------------------ */
function go(name) {
  S.scr = name;
  if (name === 'rec') renderRec();
  $$('.scr').forEach(el => el.classList.toggle('on', el.dataset.scr === name));
  if (name === 'attract') { stopIdle(); T.clearLeft = CLEAR_SEC; $('#pillbar').style.transform = 'scaleX(0)'; }
  else { startIdle(); }
}

function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), ms);
}

/* ------------------------------ 待机页 ------------------------------ */
function renderAttract() {
  $('#attractArt').innerHTML = MUYE.figureSVG({ body: 'm4', items: ['w6'] })
    + MUYE.figureSVG({ body: 'm1', items: ['w1'] })
    + MUYE.figureSVG({ body: 'm3', items: ['w4'] });
}

/* ------------------------------ 形象选择 ------------------------------ */
function renderAvatars() {
  $('#avatarGrid').innerHTML = B.map(b => `
    <div class="avcard ${b.id === S.avatar ? 'sel' : ''}" data-av="${b.id}">
      ${MUYE.figureSVG({ body: b })}
      <div class="nm">${b.name}</div>
      <div class="mt">${b.note}</div>
      <div class="tip">${b.tip}</div>
    </div>`).join('');
  $$('#avatarGrid .avcard').forEach(el => el.onclick = () => {
    S.avatar = el.dataset.av;
    renderAvatars();
    const b = body();
    $('#curAvatarName').textContent = `${b.name} · ${b.height}cm · ${b.shape}`;
    $('#avSummary').textContent = `已选：${b.name} · ${b.height}cm · ${b.shape}`;
    toast(`已切换为「${b.name}」${b.note}，看版型更接近你的身形`);
  });
}

/* ------------------------------ 服装选择 ------------------------------ */
const CATS = [
  { k: 'top', n: '上装', hint: '最多选 1 件' },
  { k: 'bottom', n: '下装', hint: '最多选 1 件' },
  { k: 'dress', n: '连衣裙', hint: '选了裙子会替换上下装' },
  { k: 'outer', n: '外套', hint: '可叠加在搭配外' },
];

function renderTabs() {
  $('#tabs').innerHTML = CATS.map(c =>
    `<button class="tab ${c.k === S.cat ? 'on' : ''}" data-cat="${c.k}">${c.n}</button>`).join('')
    + `<span style="align-self:center;margin-left:10px;font-size:21px;color:#9AA0A6">${
      (CATS.find(c => c.k === S.cat) || {}).hint || ''}</span>`;
  $$('#tabs .tab').forEach(el => el.onclick = () => { S.cat = el.dataset.cat; renderTabs(); renderItems(); });
}

function renderItems() {
  /* 男装形象下只展示中性/男装款（连衣裙自动隐藏） */
  const list = MUYE.availableFor(body()).filter(i => i.cat === S.cat);
  $('#itemGrid').innerHTML = list.map(i => `
    <div class="itemcard ${S.look === i.id ? 'sel' : ''}" data-id="${i.id}">
      ${i.tag ? `<div class="tag">${i.tag}</div>` : ''}
      <div class="im">${MUYE.thumbSVG(i, body())}</div>
      <div class="info">
        <div class="nm">${i.name}</div>
        <div class="meta"><span>${i.tone}</span><span>${i.stock}</span></div>
        <div class="pr">${money(i.price)}</div>
      </div>
    </div>`).join('');
  $$('#itemGrid .itemcard').forEach(el => el.onclick = () => toggleItem(el.dataset.id));
}

function toggleItem(id) {
  S.look = (S.look === id) ? null : id;
  S.staticMode = false;
  renderItems(); renderTabs(); renderSel();
  track('pick_item', { id });
}

function renderSel() {
  const items = selItems();
  $('#selList').innerHTML = items.length
    ? `<div class="selchip">${items[0].name} <b>${money(items[0].price)}</b><i data-x="1">×</i></div>`
    : `<div class="selchip empty">还没选衣服 —— 点一件想试的</div>`;
  $$('#selList [data-x]').forEach(el => el.onclick = () => { S.look = null; renderItems(); renderSel(); });
  const n = items.length;
  $('#estTime').textContent = n ? '16 秒' : '—';
  $('#btnGen').disabled = !n;
  $('#btnGen').textContent = n ? '生成试穿效果' : '请先选择衣服';
}

/* ------------------------------ 生成 / 等待 ------------------------------ */
const STEPS = ['读取身形与版型参数', '服装贴合与褶皱计算', '面料质感和光影渲染', '生成效果图并排队加密'];

async function startGen() {
  if (!selItems().length) return;
  S.code = randCode();
  S.genResult = null;
  const run = (S.runId = (S.runId || 0) + 1);   // 每次生成都有独立 token，旧的一律作废
  go('gen');
  track('gen_start', { code: S.code });
  const total = S.genMs;
  const t0 = Date.now();
  /* 调用换装模型（按体型传数字模特 + 服装 + 体型参数）；未配置时自动回落本地预览 */
  const it = selItems()[0], b0 = body();
  let modelDone = false;
  const useUserPhoto = !!S.userPhoto;
  if (window.TRYON) {
    const localPreview = useUserPhoto && window.PHOTO ? await PHOTO.composite(it.id) : null;
    TRYON.generate({
      human: useUserPhoto ? S.userPhoto : TRYON.humanFor(S.avatar, B),
      garment: MUYE.wornFor(it, body()),
      desc: it.name,
      body: { height: b0.height, shape: b0.shape, size: sizeAdvice() },
      fallback: localPreview || MUYE.wornFor(it, body()),
    }).then(r => {
      S.genResult = r.image; S.genOk = r.ok; S.genProvider = r.provider; S.genMsUsed = r.ms;
      modelDone = true;
      track(r.ok ? 'model_success' : 'model_fail', { provider: r.provider, ms: r.ms });
    }).catch(() => { modelDone = true; });
  } else { modelDone = true; }
  $('#ringFg').setAttribute('stroke-dashoffset', 326.7);
  $('#pctNum').textContent = '0%';
  const mark = [0, 0, 0, 0];
  const paint = () => {
    const p = Math.min(1, (Date.now() - t0) / total);
    S.ticks = (S.ticks || 0) + 1; S.lastP = Math.round(p * 100); S.lastRun = run;
    const pct = Math.round(p * 100);
    $('#pctNum').textContent = pct + '%';
    $('#ringFg').setAttribute('stroke-dashoffset', (326.7 * (1 - p)).toFixed(1));
    $('#etaText').textContent = p < 1 ? `预计还需 ${Math.max(1, Math.ceil((total - (Date.now() - t0)) / 1000))} 秒` : '正在完成';
    $$('#genSteps li').forEach((li, i) => {
      const from = [0, .3, .58, .86][i], to = [.3, .58, .86, 1.02][i];
      const done = p >= to, on = p >= from && p < to;
      li.classList.toggle('done', done);
      li.classList.toggle('on', on);
      if (on && !mark[i]) { mark[i] = 1; }
    });
    return p >= 1;
  };
  paint();
  clearInterval(S.genTimer);
  S.genTimer = setInterval(() => {
    if (run !== S.runId) { clearInterval(S.genTimer); return; }   // 已被新的生成取代
    if (!paint()) return;
    clearInterval(S.genTimer);
    const wait = () => {
      if (run !== S.runId) return;
      if (modelDone || Date.now() - t0 > 100000) finishGen();
      else setTimeout(wait, 160);
    };
    wait();
  }, 180);
  makeQR('#qrGen', qrText());
  $('#codeGen').textContent = S.code;
}

function finishGen() {
  if (S.failNext) { S.failNext = false; showFail(); return; }
  showResult();
}

function cancelGen() { S.runId = (S.runId || 0) + 1; clearInterval(S.genTimer); go('outfit'); toast('已取消生成，你的选择还在，可以直接重来'); }

/* ------------------------------ 结果页 ------------------------------ */
function sizeAdvice() {
  const b = body();
  let s = b.height <= 162 ? 'S' : b.height <= 168 ? 'M' : b.height <= 172 ? 'L' : 'XL';
  if (b.shape === '丰满' && s === 'S') s = 'M';
  if (b.shape === '丰满' && s === 'M') s = 'L';
  return s;
}

/* ------------------------------ AI 推荐（身高体重 + 门店现货） ------------------------------ */
function bodyHW() {
  const h = Number(($('#inH') || {}).value) || 168;
  const w = Number(($('#inW') || {}).value) || 58;
  return { h, w };
}
function recSize(h, w) {
  const bmi = w / Math.pow(h / 100, 2);
  let s = h <= 162 ? 'S' : h <= 168 ? 'M' : h <= 172 ? 'L' : 'XL';
  if (bmi >= 23 && s === 'S') s = 'M';
  if (bmi >= 23 && s === 'M') s = 'L';
  return { size: s, bmi: bmi.toFixed(1) };
}
function recList() {
  const { h, w } = bodyHW();
  const { size, bmi } = recSize(h, w);
  const shape = bmi >= 23 ? '丰满' : bmi <= 18.5 ? '偏瘦' : '匀称';
  const scored = IT.map(it => {
    let score = 0;
    const stockNum = (it.stock.match(/\d+/) || [1])[0] | 0;
    const sizes = { S: 3, M: 4, L: 3, XL: 1 };
    score += sizes[size] ? 24 : 8;
    score += Math.min(stockNum, 12);
    if (shape === '丰满' && (it.cat === 'outer' || it.cat === 'dress')) score += 8;
    if (shape === '偏瘦' && (it.cat === 'top' || it.cat === 'dress')) score += 6;
    if (h <= 162 && it.id === 'w4') score -= 8;
    if (h >= 172 && it.id === 'w5') score -= 5;
    return { it, score };
  }).sort((a, b) => b.score - a.score);
  return { size, bmi, shape, h, w, list: scored.slice(0, 3).map(x => x.it) };
}
function renderRec() {
  const r = recList();
  const grid = $('#recGrid'); if (!grid) return;
  $('#recWhy').innerHTML = `身高 <b>${r.h}cm</b> · 体重 <b>${r.w}kg</b> · BMI ${r.bmi} · 建议 <b>${r.size}</b> 码`
    + `（当前形象 ${sizeAdvice()} 码）· 已按本店现货优先排序`;
  grid.innerHTML = r.list.map((it, i) => {
    const pair = MUYE.pairOf(it.id);
    const total = it.price + (pair ? pair.item.price : 0);
    return `<div class="itemcard" onclick="startTryonFrom('${it.id}')">
      <div class="im">${MUYE.thumbSVG(it, body())}</div>
      <div class="info">
        <div class="nm">${i + 1}. ${it.name}</div>
        <div class="meta"><span>建议 ${r.size} 码</span><span>${it.stock}</span></div>
        <div class="pr">${money(it.price)}</div>
        ${pair ? `<div class="meta" style="margin-top:6px"><span>搭 ${pair.item.name}</span><b style="color:#111">合计 ${money(total)}</b></div>` : ''}
      </div></div>`;
  }).join('');
}
function startTryonFrom(id) {
  S.look = id; S.genMs = S.fastMode ? 1500 : 16000;
  track('rec_pick', { id });
  renderItems(); renderSel();
  startGen();
}

/* ------------------------------ 360° 转圈 / 转一圈切换下一套 ------------------------------ */
function bindSpin() {
  const box = $('#resFig'); if (!box) return;
  if (box._spin) return;
  let down = false, x0 = 0, last = 0, total = 0, used = 0;
  box.style.touchAction = 'none';
  box.addEventListener('pointerdown', e => {
    down = true; x0 = e.clientX; last = e.clientX; total = 0; used = false;
    if (box.setPointerCapture) { try { box.setPointerCapture(e.pointerId); } catch (x) {} }
    e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!down) return;
    const step = 95;
    total += e.clientX - last;
    last = e.clientX;
    if (S.spinFrames) {
      const moved = Math.trunc(total / step) - 0;
      const i = ((moved % 4) + 4) % 4;
      if (i !== S.spinIdx) {
        S.spinIdx = i;
        const img = box.querySelector('img');
        if (img) img.src = S.spinFrames[i];
      }
      if (Math.abs(total) > 470 && !used) {              // 转满一圈 → 换下一套
        used = true;
        switchLook(nextLookId(total > 0 ? 1 : -1));
      }
    } else if (Math.abs(total) > 120 && !used) {          // 没有角度帧：滑动即换下一套
      used = true;
      switchLook(nextLookId(total < 0 ? 1 : -1));
    }
    e.preventDefault();
  });
  const up = e => { down = false; try { box.releasePointerCapture(e.pointerId); } catch (x) {} };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('pointerleave', () => { down = false; });
  box._spin = true;
}
function nextLookId(step) {
  const i = IT.findIndex(x => x.id === S.look);
  return IT[(i + step + IT.length) % IT.length].id;
}

/* 箭头按钮：有角度帧就转一格；转满一圈（或没有角度帧）就换下一套 */
function spinBy(dir) {
  if (S.spinFrames && S.spinFrames.length > 1) {
    const next = S.spinIdx + dir;
    if (next >= 0 && next < S.spinFrames.length) {
      S.spinIdx = next;
      const img = $('#resFig').querySelector('img');
      if (img) img.src = S.spinFrames[next];
      track('spin_360', { idx: next });
      if (next === S.spinFrames.length - 1 && dir > 0) toast('已经转完一圈，再点一次看下一套');
      return;
    }
  }
  switchLook(nextLookId(dir));
}

function showResult() {
  S.staticMode = false;
  go('result');
  track('gen_success', { code: S.code });
  const items = selItems();
  const b = body();
  const it = items[0];
  /* 全屏底图：换装模型结果优先，其次是本地合成预览，最后是商品实拍 */
  const bgSrc = S.genResult || MUYE.wornFor(it, body());
  $('#resFig').style.setProperty('--img', `url("${bgSrc}")`);
  $('#resFig').innerHTML = `<img src="${bgSrc}" alt="" draggable="false">`;
  $('#resBadge').textContent = (S.userPhoto ? '基于你的照片 · ' : '')
    + (S.genOk === false ? '本地合成预览' : 'AI 生成效果 · ' + (window.TRYON ? TRYON.providerName() : ''));
  /* 钉在衣服上的商品标签 */
  $('#resItems').innerHTML = `<img src="${MUYE.wornFor(it, body())}" alt=""><b>${it.name}</b><i onclick="backToOutfit()">×</i>`;
  /* 底部 Dock：价格 / 尺码 / 现货 + 衣服横滑 + 主按钮 */
  $('#resTotal').textContent = money(it.price);
  $('#sizeHead').textContent = `建议 ${sizeAdvice()} 码`;
  $('#sizeBody').textContent = `${it.tone} · 本店现货 ${it.stock}`;
  $('#resRail').innerHTML = MUYE.availableFor(body()).map(x => `<div class="rthumb ${x.id === it.id ? 'on' : ''}" onclick="switchLook('${x.id}')"><img src="${MUYE.wornFor(x, body())}" alt=""></div>`).join('');
  /* 自动搭配：这件 + 推荐的那件 */
  const pair = MUYE.pairOf(it.id);
  $('#resPair').innerHTML = pair
    ? `<img src="${MUYE.wornFor(pair.item, body())}" alt=""><span><b>本套搭配：</b>${it.name} + ${pair.item.name} · 合计 <b>${money(it.price + pair.item.price)}</b></span>
       <button onclick="switchLook('${pair.item.id}')">换穿这一件</button>`
    : `<span><b>这件自成一套</b> · ${it.name}</span>`;
  /* 360°：有角度帧就转起来，转满一圈切换下一套 */
  S.spinFrames = MUYE.framesFor(it, body());
  if (S.spinItem !== it.id) { S.spinIdx = 0; S.spinItem = it.id; }   // 同一件重绘时保留旋转角度
  bindSpin();
  $('#resFlat').innerHTML = MUYE.flatLay(items);
  $('#resFlat').innerHTML = MUYE.flatLay(items);
  $('#codeRes').textContent = S.code;
  $('#codeRes2').textContent = S.code;
  makeQR('#qrRes', qrText());
  setView('fit');
  startClear();
}

/* 结果页直接换一件：重新生成这一件 */
function switchLook(id) {
  if (!MUYE.byId(id)) return;
  S.look = id;
  track('switch_look', { id });
  S.genMs = S.fastMode ? 1500 : 14000;
  renderItems(); renderSel();
  startGen();
}

function staticFallback() {
  showResult();
  S.staticMode = true;
  $('#resBadge').textContent = '静态搭配图 · 兜底方案';
  setView('flat');
  toast('已用静态搭配图兜底，这套搭配和你在屏幕上选的一致');
  track('static_fallback');
}

function setView(v) {
  S.view = v;
  $('#resFlat').classList.toggle('on', v !== 'fit');
  $$('.rseg button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
}

function backToOutfit() { stopClear(); go('outfit'); renderItems(); renderSel(); }

/* 门店真实转化动作：呼叫导购 */
function callStaff() {
  track('call_staff');
  toast('已通知 3F 导购：她会带着这件衣服过来，也可以直接帮你调货、改裤长');
  const el = $('#resBadge');
  if (el) el.textContent = (S.userPhoto ? '基于你的照片 · ' : '') + '已呼叫导购';
}

/* ------------------------------ 失败页 ------------------------------ */
function showFail() {
  go('fail');
  track('gen_fail');
  const n = selItems().length;
  $('#failLog').textContent = `错误码 E-NET-07 · 已自动重试 1 次 · 耗时 ${(10 + n * 1.2).toFixed(1)} 秒 · 你的搭配已保留`;
}

function retryGen() {
  toast('已切换到备用渲染通道，正在重新生成');
  track('retry_gen');
  S.genMs = S.fastMode ? 1500 : 18000;
  startGen();
}

function qrFallback() {
  go('result');
  S.staticMode = true;
  $('#resBadge').textContent = '稍后发到手机';
  setView('flat');
  toast('已为你保留这套搭配：扫码或让导购记下取件码，出图后直接发到你手机');
  track('qr_fallback');
  startClear();
}

/* ------------------------------ 二维码 / 取件码 ------------------------------ */
function qrText() {
  return phonePageURL();
}

/* 二维码指向真实可打开的页面：手机连同一个 Wi-Fi 扫码即可打开手机端商城 */
function phonePageURL() {
  const host = location.hostname || 'localhost';
  /* 本地打开用局域网地址（手机扫码可访问）；部署到公网后直接用当前域名 */
  const isLocal = !host || host === 'localhost' || host === '127.0.0.1'
    || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  const origin = isLocal
    ? `http://${window.LAN_HOST || host}:${location.port || '5173'}`
    : location.origin;
  const shortName = 'phone.html';
  const items = selItems().map(i => i.id).join(',');
  return `${origin}/${shortName}?code=${S.code}&avatar=${S.avatar}&items=${items}`;
}

function makeQR(sel, text) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el || typeof QRCode === 'undefined') return;
  el.innerHTML = '';
  new QRCode(el, { text, width: 264, height: 264, colorDark: '#14171A', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
}

/* ------------------------------ 隐私计时 ------------------------------ */
function startIdle() {
  stopIdle();
  T.idleLeft = IDLE_SEC;
  T.idle = setInterval(() => {
    T.idleLeft--;
    if ($('#idleNum')) $('#idleNum').textContent = Math.max(0, T.idleLeft);
    if ($('#idleNum2')) $('#idleNum2').textContent = Math.max(0, T.idleLeft);
    $('#pillbar').style.transform = `scaleX(${1 - T.idleLeft / IDLE_SEC})`;
    if (T.idleLeft <= 0) { resetAll('长时间未操作，已为你自动清屏'); }
  }, 1000);
}
function stopIdle() { clearInterval(T.idle); T.idle = null; T.idleLeft = IDLE_SEC; $('#pillbar').style.transform = 'scaleX(0)'; }

function startClear() {
  stopClear();
  T.clearLeft = CLEAR_SEC;
  T.clear = setInterval(() => {
    T.clearLeft--;
    $('#clearNum').textContent = Math.max(0, T.clearLeft);
    const p = 1 - T.clearLeft / CLEAR_SEC;
    $('#clearRing').style.background = `conic-gradient(#A9522F ${p * 360}deg,#F0DBD2 0)`;
    if (T.clearLeft <= 0) { resetAll('已自动清除本次试穿画面'); }
  }, 1000);
}
function stopClear() { clearInterval(T.clear); T.clear = null; T.clearLeft = CLEAR_SEC; }

function resetAll(msg) {
  S.runId = (S.runId || 0) + 1; clearInterval(S.genTimer); stopClear(); stopIdle();
  S.look = null;
  S.cat = 'top'; S.code = '------'; S.staticMode = false; S.failNext = false; S.genMs = 18000; S.fastMode = false;
  S.userPhoto = null; S.userPose = null;
  $('#qrGen').innerHTML = ''; $('#qrRes').innerHTML = '';
  renderTabs(); renderItems(); renderSel(); renderAvatars();
  go('attract');
  toast(msg || '已回到首页');
}

/* ------------------------------ 弹层 ------------------------------ */
function openModal(id) { $('#' + id).classList.add('on'); }
function closeModal(id) { $('#' + id).classList.remove('on'); }
function openPrivacy() { openModal('mPrivacy'); track('privacy_open'); }
let MREAL_HTML = '';
function openRealTry() {
  if (MREAL_HTML) $('#mReal').innerHTML = MREAL_HTML;
  openModal('mReal');
}

/* 用我的照片试穿：先给一段可读的告知，再进拍照页 */
function openPhotoConsent() {
  const box = $('#mReal');
  box.querySelector('h3').textContent = '用你自己的照片试穿？';
  box.querySelector('.lead').innerHTML = '会把你在店里拍的这一张照片当成"数字人像"来生成效果图。先看清下面这几条，再决定要不要继续。';
  box.querySelector('.dl li:nth-child(1)').innerHTML = '照片只在<b>拍照时获取一次</b>，用来生成"你穿这件"的效果图。';
  box.querySelector('.dl li:nth-child(2)').innerHTML = '默认<b>只在本机处理</b>，不上传、不入库、不用于训练；生成结束后立即删除。';
  box.querySelector('.dl li:nth-child(3)').innerHTML = '如果你在设置里接了<b>云端换装模型</b>，生成时会把这张照片发送到模型服务，仅用于本次生成并立即删除。';
  box.querySelector('.dl li:nth-child(4)').innerHTML = '随时可以按屏幕上的"退出"中止，也可以改用虚拟形象。';
  box.querySelector('.acts').innerHTML =
    '<button class="btn ghost" onclick="closeModal(\'mReal\')">还是用虚拟形象</button>' +
    '<button class="btn primary" onclick="closeModal(\'mReal\');go(\'photo\');PHOTO.start()">同意并去拍照</button>';
  openModal('mReal');
  track('photo_entry');
}

/* ------------------------------ 换装模型设置 ------------------------------ */
function openModel() {
  const c = TRYON.config;
  $('#mmProvider').value = c.provider;
  $('#mmEndpoint').value = c.endpoint || '';
  $('#mmKey').value = c.key || '';
  $('#mmModel').value = c.model || 'fal-ai/cat-vton';
  $('#mmState').textContent = '当前：' + TRYON.providerName();
  openModal('mModel');
}
function readModel() {
  return {
    provider: $('#mmProvider').value,
    endpoint: $('#mmEndpoint').value.trim(),
    key: $('#mmKey').value.trim(),
    model: $('#mmModel').value.trim() || 'fal-ai/cat-vton',
  };
}
function saveModel() {
  const c = readModel();
  if (c.provider === 'custom' && !c.endpoint) { toast('填上自建服务端点，例如 http://localhost:5199/generate'); return; }
  if (c.provider === 'fal' && !c.key) { toast('fal.ai 需要 API Key'); return; }
  TRYON.setConfig(c);
  $('#mmState').textContent = '当前：' + TRYON.providerName();
  closeModal('mModel');
  toast('已切换到「' + TRYON.providerName() + '」，下次生成就用它');
  track('model_config', { provider: c.provider });
}
async function testModel() {
  const c = readModel();
  TRYON.setConfig(c);
  $('#mmState').textContent = '正在测试…';
  const it = IT[0], b = B[2];
  const r = await TRYON.generate({ human: TRYON.humanFor(b.id, B), garment: MUYE.wornFor(it, body()), desc: it.name,
    body: { height: b.height, shape: b.shape, size: 'M' }, fallback: MUYE.wornFor(it, body()) });
  $('#mmState').textContent = r.ok
    ? `连接成功 · ${r.ms} ms · 用的是「${TRYON.providerName()}」`
    : `调用失败：${r.error}（生成时会自动回落到本地预览）`;
}
function agreeReal() {
  closeModal('mReal');
  track('real_try_on_start');
  go('live');
  renderLiveItems();
  if (window.LIVE) LIVE.start();
}

/* 真人试穿：右侧可选衣服列表 */
function renderLiveItems() {
  const el = $('#liveItems');
  if (!el) return;
  el.innerHTML = LIVE_LIST.map(i => `<div class="lr-item ${S.liveId === i.id ? 'on' : ''}" data-live="${i.id}">
      <img src="${i.img}" alt="">
      <div class="nm">${i.name}<span class="mt">${i.tone} · ${money(i.price)}</span></div>
      <div style="font-size:20px;color:${S.liveId === i.id ? 'var(--ink)' : 'var(--mut)'}">${S.liveId === i.id ? '● 穿着中' : '试穿'}</div>
    </div>`).join('');
  $$('#liveItems [data-live]').forEach(n => n.onclick = () => {
    S.liveId = n.dataset.live;
    if (window.LIVE) LIVE.setGarment(S.liveId);
    renderLiveItems();
    track('live_switch_garment', { id: S.liveId });
  });
}

/* ------------------------------ 手机端 ------------------------------ */
function phoneURL() {
  return `AI虚拟试衣-手机端.html?code=${S.code}&avatar=${S.avatar}&items=${selItems().map(i => i.id).join(',')}`;
}
function openPhone() {
  const items = selItems();
  if (!items.length) { toast('先选一件衣服，我们再看看手机上会看到什么'); return; }
  const url = phonePageURL();
  const link = $('#phoneOpenLink'); if (link) link.href = url;
  $('#phoneMock').innerHTML = `
    <div class="pvtop"><span>MUYE 沐野</span><span>取件码 ${S.code}</span></div>
    <div class="pvhero">${MUYE.figureSVG({ body: S.avatar, items: items.map(i => i.id) })}</div>
    <div class="pvrow"><b>尺码建议</b><span>${sizeAdvice()} 码 · 本店现货</span></div>
    <div class="pvrow"><span>${items.map(i => i.name).join(' + ')}</span><b>${money(items.reduce((a, i) => a + i.price, 0))}</b></div>
    <div class="pvbtn">加入购物车 ${money(items.reduce((a, i) => a + i.price, 0))}</div>
    <div class="pvbtn gh">预约到店试衣</div>
    <div class="pvbtn gh">加导购企业微信，让她帮你留货</div>
    <div class="pvtip">你的试穿数据 7 天后自动删除 · 可随时一键删除</div>`;
  openModal('mPhone');
  track('phone_open');
}
function openPhoneFile() { window.open(phoneURL(), '_blank'); }

/* ------------------------------ 演示控制 ------------------------------ */
function demoFail() { S.failNext = true; toast('已开启失败演示：下次生成会失败，再点「重新生成」就会成功'); }
function demoSlow() { S.genMs = 30000; toast('已切换为慢速网络：生成约 30 秒，可演示"边等边扫码"'); }
function demoFast() { S.fastMode = true; S.genMs = 1500; toast('已切换为快速通道：生成约 2 秒'); }
function demoIdle() { toast('已把无操作等待缩短，3 秒后自动清屏'); stopIdle(); T.idleLeft = 3; startIdle(); }
function demoClear() { if (S.scr !== 'result') { toast('先走到结果页，再演示自动清除'); return; } stopClear(); T.clearLeft = 3; startClear(); }
function demoReal() { openRealTry(); closeModal('mReal'); toast('真人试穿授权被拒 —— 已自动回落到虚拟形象，流程不中断'); }

function toggleSide() {
  const hide = !$('#sideL').classList.contains('hidden');
  ['#sideL', '#sideR'].forEach(s => $(s).classList.toggle('hidden', hide));
  document.querySelectorAll('.side').forEach(el => el.style.display = hide ? 'none' : '');
  fitStage();
}
function kioskMode() {
  document.body.classList.toggle('kiosk');
  document.querySelector('.topbar').style.display = document.body.classList.contains('kiosk') ? 'none' : '';
  document.querySelectorAll('.side').forEach(el => el.style.display = document.body.classList.contains('kiosk') ? 'none' : '');
  document.querySelector('.layout').style.padding = document.body.classList.contains('kiosk') ? '0' : '20px';
  document.querySelector('.bezel').style.padding = document.body.classList.contains('kiosk') ? '0' : '20px';
  document.querySelector('.bezel').style.borderRadius = document.body.classList.contains('kiosk') ? '0' : '34px';
  document.querySelector('.cam').style.display = document.body.classList.contains('kiosk') ? 'none' : '';
  document.querySelector('.stage').style.borderRadius = document.body.classList.contains('kiosk') ? '0' : '20px';
  document.querySelector('.bezel').style.boxShadow = document.body.classList.contains('kiosk') ? 'none' : '';
  fitStage();
}

/* ------------------------------ 自适应缩放 ------------------------------ */
function fitStage() {
  const screen = $('#screen'), stage = $('#stage');
  const kiosk = document.body.classList.contains('kiosk');
  const sideW = kiosk ? 0 : Array.from(document.querySelectorAll('.side'))
    .reduce((a, el) => a + (el.style.display === 'none' ? 0 : el.offsetWidth), 0);
  const gaps = kiosk ? 0 : (document.querySelectorAll('.side').length * 20) + 40;
  const availW = Math.max(300, window.innerWidth - sideW - (kiosk ? 0 : 80) - gaps);
  const availH = Math.max(300, window.innerHeight - (kiosk ? 0 : 60) - (kiosk ? 0 : 80));
  const custom = new URLSearchParams(location.search).get('s');
  const s = custom ? parseFloat(custom) : Math.min(availW / 1080, availH / 1920);
  screen.style.transform = `scale(${s})`;
  stage.style.width = 1080 * s + 'px';
  stage.style.height = 1920 * s + 'px';
}

/* ------------------------------ 埋点（演示用） ------------------------------ */
const EVENTS = [];
function track(name, data) {
  EVENTS.push({ t: Date.now(), name, data });
  console.log('%c[埋点] ' + name, 'color:#2E4F7C', data || '');
}

/* ------------------------------ 初始化 ------------------------------ */
MREAL_HTML = $('#mReal').innerHTML;
renderAttract(); renderAvatars(); renderTabs(); renderItems(); renderSel();
$('#btnStart').onclick = () => { track('start_fitting'); go('avatar'); };
$('#btnToOutfit').onclick = () => { track('next_to_outfit'); go('outfit'); };
$('#btnGen').onclick = startGen;
$$('.rseg button').forEach(b => b.onclick = () => setView(b.dataset.view));
$$('[data-back]').forEach(b => b.onclick = () => { const order = ['attract', 'avatar', 'outfit', 'gen', 'result', 'fail']; const i = order.indexOf(S.scr); go(order[Math.max(0, i - 1)]); });
document.addEventListener('pointerdown', () => { if (S.scr !== 'attract') { T.idleLeft = IDLE_SEC; } });
/* 防止浏览器把"拖动模特"识别成拖拽图片（会吞掉滑动事件） */
document.addEventListener('dragstart', e => { if (e.target && e.target.tagName === 'IMG') e.preventDefault(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.body.classList.contains('kiosk')) kioskMode(); } });
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); }));
window.addEventListener('resize', fitStage);
fitStage(); go('attract');

/* ------------------------------ 摄像头自检 + 直达入口 ------------------------------ */
async function camCheck() {
  const el = $('#camStatus');
  if (!el) return;
  if (location.protocol === 'file:') {
    el.innerHTML = '<i class="dot" style="background:#D93025;opacity:.85"></i>当前是 file:// 打开，浏览器会拒绝摄像头 —— 请用 启动原型.bat 或 localhost 链接';
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    el.innerHTML = '<i class="dot" style="background:#D93025;opacity:.85"></i>这个浏览器不支持摄像头，请用 Chrome / Edge 打开';
    return;
  }
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const cams = list.filter(d => d.kind === 'videoinput');
    el.innerHTML = cams.length
      ? '<i class="dot"></i>已检测到摄像头 · 点上面两个按钮即可开始（浏览器会问你"允许"）'
      : '<i class="dot" style="background:#D93025;opacity:.85"></i>没检测到摄像头设备，可先用虚拟形象试穿';
  } catch (e) {
    el.innerHTML = '<i class="dot"></i>点上面两个按钮后，浏览器会询问摄像头权限，选择"允许"';
  }
}
camCheck();
/* ?start=photo / ?start=live 时，打开即请求摄像头（浏览器会弹权限提示） */
(function autoStart() {
  const st = new URLSearchParams(location.search).get('start');
  if (st !== 'photo' && st !== 'live') return;
  setTimeout(() => {
    if (st === 'photo') { go('photo'); if (window.PHOTO) PHOTO.start(); }
    else { go('live'); renderLiveItems(); if (window.LIVE) LIVE.start(); }
  }, 300);
})();
if (window.TRYON) {
  const setTag = () => {
    const el = $('#modelTag'); if (!el) return;
    const n = TRYON.providerName();
    el.textContent = '· ' + (n.startsWith('本地') ? '本地预览' : n);
  };
  setTag();
  document.addEventListener('click', setTag);
}
if (new URLSearchParams(location.search).get('kiosk')) kioskMode();

/* ------------------------------ 演示/截图用状态跳转 ------------------------------ */
window.__setState = function (o) {
  o = o || {};
  if (o.avatar) S.avatar = o.avatar;
  if (o.sel) {
    const first = o.sel.map(id => MUYE.byId(id)).filter(Boolean)[0];
    S.look = first ? first.id : null;
  }
  if (o.cat) S.cat = o.cat;
  renderAvatars(); renderTabs(); renderItems(); renderSel();
  const b = body();
  $('#curAvatarName').textContent = `${b.name} · ${b.height}cm · ${b.shape}`;
  if (o.scr === 'result') { S.code = randCode(); S.genMs = 400; S.genResult = null; S.genOk = null; showResult(); if (o.flat) setView('flat'); }
  else if (o.scr === 'live') { go('live'); S.liveId = o.liveId || S.liveId; renderLiveItems(); if (window.LIVE) LIVE.start(); }
  else if (o.scr === 'gen') { S.genMs = o.ms || 18000; startGen(); if (o.at) setTimeout(() => { T.genAt = o.at; }, 0); }
  else if (o.scr === 'fail') { S.code = randCode(); showFail(); }
  else if (o.scr === 'rec') { renderRec(); go('rec'); }
  else if (o.scr === 'privacy') { go('avatar'); openPrivacy(); }
  else if (o.scr === 'real') { go('avatar'); openRealTry(); }
  else { go(o.scr || 'attract'); }
  return S.scr;
};

/* URL 参数直达某个状态：?scr=outfit&sel=t1,b1&kiosk=1 */
(function initFromURL() {
  const q = new URLSearchParams(location.search);
  if (!q.get('scr') && !q.get('sel') && !q.get('avatar')) return;
  __setState({
    scr: q.get('scr'),
    avatar: q.get('avatar'),
    sel: q.get('sel') ? q.get('sel').split(',') : null,
    cat: q.get('cat'),
    flat: q.get('flat') === '1',
  });
})();







