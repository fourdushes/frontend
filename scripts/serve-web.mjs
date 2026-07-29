import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT || 8082);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4v': 'video/x-m4v',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
  const requested = normalize(join(root, pathname));
  const safePath = requested.startsWith(root) ? requested : join(root, 'index.html');
  const assetPath = existsSync(safePath) && statSync(safePath).isFile()
    ? safePath
    : join(root, 'index.html');

  response.setHeader('Content-Type', mimeTypes[extname(assetPath)] || 'application/octet-stream');
  response.setHeader('Cache-Control', assetPath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
  createReadStream(assetPath).pipe(response);
}).listen(port, () => {
  console.log(`HearO web preview: http://localhost:${port}`);
});
