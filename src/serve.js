/* 零依赖静态服务器：浏览器要求摄像头只能在 localhost / https 下使用 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 5173);
const ROOT = path.resolve(process.argv[3] || __dirname);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.bat': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + p); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  let lan = '';
  Object.values(os.networkInterfaces()).forEach(l => (l || []).forEach(i => {
    if (i.family === 'IPv4' && !i.internal && !lan) lan = i.address;
  }));
  console.log(`serving ${ROOT}`);
  console.log(`本机打开：http://localhost:${PORT}/`);
  if (lan) console.log(`手机扫码/同 Wi-Fi 打开：http://${lan}:${PORT}/`);
});
