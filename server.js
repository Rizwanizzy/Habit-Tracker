import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.join(__dirname, 'dist')

const PORT = Number(process.env.PORT) || 3000
const HOST = '0.0.0.0'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      return
    }

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
    }

    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    } else {
      headers['Cache-Control'] = 'no-cache'
    }

    res.writeHead(statusCode, headers)
    fs.createReadStream(filePath).pipe(res)
  })
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  // Health check
  if (req.url === '/_healthz' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
    return
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = decodeURIComponent(parsedUrl.pathname)

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(DIST_DIR, safePath)

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    fs.access(filePath, fs.constants.F_OK, (accessErr) => {
      if (!accessErr) {
        sendFile(res, filePath, 200)
      } else {
        // SPA fallback to index.html for client-side routing
        const indexPath = path.join(DIST_DIR, 'index.html')
        fs.access(indexPath, fs.constants.F_OK, (indexErr) => {
          if (!indexErr) {
            sendFile(res, indexPath, 200)
          } else {
            res.writeHead(503, { 'Content-Type': 'text/plain' })
            res.end('Application is building or dist directory is missing. Please run "npm run build".')
          }
        })
      }
    })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`)
})
