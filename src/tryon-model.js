/* =========================================================================
   换装模型接入层（可插拔）
   - custom : 你自己的换装服务（ComfyUI / CatVTON / IDM-VTON 包一层 HTTP 即可）
   - fal    : fal.ai 托管的 IDM-VTON / CatVTON（填 key 即可用）
   - mock   : 不配任何东西时的本地回落（用已生成好的真人穿着照，保证演示不空手）

   自定义端点协议（POST，JSON）：
     请求 { human_image, garment_image, garment_description, body:{height,shape,size}, seed }
     响应 { image_base64: "data:image/...;base64,xxx" }  或  { image_url: "https://..." }
   ========================================================================= */
const TRYON = (() => {
  const KEY = 'muye_tryon_cfg';
  let cfg = { provider: 'mock', endpoint: '', key: '', model: 'fal-ai/cat-vton', timeout: 90000, bodyScan: true };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const listeners = [];

  const src2dataURL = src => new Promise((res, rej) => {
    if (!src) return rej(new Error('缺少图片'));
    if (src.startsWith('data:')) return res(src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      res(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => rej(new Error('图片读取失败 ' + src));
    img.src = src;
  });

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))]);
  }

  /* 核心：传入人像 + 服装 + 体型参数，拿回照片级试穿图 */
  async function generate(opt) {
    const t0 = Date.now();
    const req = {
      human_image: opt.human,
      garment_image: opt.garment,
      garment_description: opt.desc || '',
      body: opt.body || {},
      seed: Math.floor(Math.random() * 1e6),
    };
    const payload = () => ({
      ...req,
      human_image: opt.human, garment_image: opt.garment,
    });
    emit({ phase: 'start', provider: cfg.provider });
    try {
      let out;
      if (cfg.provider === 'custom' && cfg.endpoint) {
        emit({ phase: 'upload' });
        const data = await withTimeout(fetch(cfg.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(await materialize()),
        }).then(async r => {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
          return r.json();
        }), cfg.timeout);
        out = out2img(data);
      } else if (cfg.provider === 'fal') {
        const body = await materialize();
        const data = await withTimeout(fetch('https://fal.run/' + (cfg.model || 'fal-ai/cat-vton'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + cfg.key },
          body: JSON.stringify({
            human_image_url: body.human_image,
            garment_image_url: body.garment_image,
            garment_description: body.garment_description,
          }),
        }).then(async r => {
          if (!r.ok) throw new Error('fal ' + r.status + ' ' + (await r.text()).slice(0, 200));
          return r.json();
        }), cfg.timeout);
        out = (data.image && data.image.url) || data.image_url || (data.images && data.images[0] && data.images[0].url);
        if (!out) throw new Error('fal 返回里没有图片: ' + JSON.stringify(data).slice(0, 160));
      } else {
        /* mock：本地回落，保证演示不空手 */
        emit({ phase: 'render' });
        await new Promise(r => setTimeout(r, 1200));
        out = opt.fallback;
        if (!out) throw new Error('没有可用的回落图');
      }
      emit({ phase: 'done', ms: Date.now() - t0, provider: cfg.provider });
      return { ok: true, image: out, ms: Date.now() - t0, provider: cfg.provider };
    } catch (e) {
      emit({ phase: 'error', error: e.message });
      return { ok: false, error: e.message, ms: Date.now() - t0, provider: cfg.provider, fallback: opt.fallback };
    }
    async function materialize() {
      const [human, garment] = await Promise.all([
        opt.human && opt.human.startsWith('data:') ? opt.human : src2dataURL(opt.human),
        opt.garment && opt.garment.startsWith('data:') ? opt.garment : src2dataURL(opt.garment),
      ]);
      return { ...req, human_image: human, garment_image: garment };
    }
  }

  function out2img(d) {
    if (d.image_base64) return d.image_base64.startsWith('data:') ? d.image_base64 : 'data:image/jpeg;base64,' + d.image_base64;
    if (d.image_url) return d.image_url;
    if (d.image) return d.image;
    if (d.output && d.output[0]) return d.output[0];
    throw new Error('端点返回格式不对，需要 image_base64 或 image_url');
  }

  function emit(e) { listeners.forEach(f => { try { f(e); } catch (x) {} }); }

  /* 让模型"按体型生成"：把人像换成对应体型的数字模特 */
  function humanFor(bodyId, models) {
    if (!cfg.bodyScan) return models[0].img;
    const m = models.find(x => x.id === bodyId);
    return (m || models[0]).img;
  }

  return {
    generate, humanFor,
    get config() { return { ...cfg }; },
    setConfig(c) { Object.assign(cfg, c); save(); },
    on(f) { listeners.push(f); },
    providerName() { return { mock: '本地预览（未接入模型）', custom: '自建换装服务', fal: 'fal.ai 托管模型' }[cfg.provider] || cfg.provider; },
  };
})();
window.TRYON = TRYON;
