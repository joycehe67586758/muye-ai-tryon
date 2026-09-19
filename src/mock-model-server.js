/* 本地"换装模型"服务（联调用）：实现 TRYON 的自定义端点协议
   它把收到的服装图合成到人像上并返回，用来证明接入链路真的通。
   用法：node mock-model-server.js  [端口默认 5199] */
const http = require('http');
const PORT = Number(process.argv[2] || 5199);

http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, cors).end('POST only'); return; }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 24e6) req.destroy(); });
  req.on('end', () => {
    try {
      const j = JSON.parse(body);
      const has = k => !!(j[k] && String(j[k]).startsWith('data:'));
      console.log(`[mock-model] 收到请求 · human=${has('human_image')} garment=${has('garment_image')} ` +
        `desc="${j.garment_description || ''}" body=${JSON.stringify(j.body || {})} seed=${j.seed}`);
      if (!has('human_image') || !has('garment_image')) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: '需要 human_image 与 garment_image 两个 dataURL' }));
        return;
      }
      /* 这里替换成真正的模型调用：ComfyUI 工作流 / CatVTON / IDM-VTON 推理。
         联调时把服装图回传（模拟"生成出来的试穿图"），并带上请求里的体型参数。 */
      setTimeout(() => {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
          .end(JSON.stringify({
            image_base64: j.garment_image,
            meta: { provider: 'mock-model-server', mode: 'echo', body: j.body || {}, seed: j.seed },
          }));
      }, 1800);
    } catch (e) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`mock 换装模型服务已启动：POST http://localhost:${PORT}/generate`));
