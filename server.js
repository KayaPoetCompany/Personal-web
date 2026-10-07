// Jednoduchý server pro statický web ze složky public/ – bez závislostí.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ─── Dočasný zámek před spuštěním naostro ────────────────────────────────────
// Zapnutý, dokud je nastavená proměnná SITE_PASSWORD (jméno: preview). Až bude
// web připravený pro veřejnost, stačí proměnnou v Railway smazat — nic jiného se nemění.
const SITE_PASSWORD = process.env.SITE_PASSWORD;
const EXPECTED = SITE_PASSWORD
  ? Buffer.from('Basic ' + Buffer.from(`preview:${SITE_PASSWORD}`).toString('base64'))
  : null;

function authorized(req) {
  if (!EXPECTED) return true;
  const got = Buffer.from(req.headers.authorization || '');
  return got.length === EXPECTED.length && crypto.timingSafeEqual(got, EXPECTED);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  if (!authorized(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Karel Pospisilik", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    return res.end('Authentication required.');
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  // Nikdy nevydat nic mimo public/.
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Stránka nenalezena.');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      // HTML vždy čerstvé, obrázky můžou chvíli zůstat v cache prohlížeče.
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      // Dokud je web zamčený, nechceme ho ve vyhledávačích.
      ...(EXPECTED ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Web běží na portu ${PORT}${EXPECTED ? ' (zamčeno heslem)' : ''}`);
});
