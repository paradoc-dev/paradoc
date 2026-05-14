/**
 * ACME Test Registry Server
 *
 * A simple HTTP server that serves the ACME registry for testing.
 * Run with: npx tsx test-registry/server.ts
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4567;
const HOST = 'localhost';

// MIME types for different file extensions
const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.txt': 'text/plain',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(filePath: string, res: http.ServerResponse): void {
  const absolutePath = path.join(__dirname, filePath);

  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: filePath }));
    return;
  }

  const content = fs.readFileSync(absolutePath);
  const mimeType = getMimeType(filePath);

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(content);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  console.log(`${req.method} ${pathname}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Route requests
  if (pathname === '/registry.json') {
    serveFile('registry.json', res);
  } else if (pathname.startsWith('/r/')) {
    // Artifact requests: /r/{name}.json
    const artifactFile = pathname.slice(1); // Remove leading /
    serveFile(artifactFile, res);
  } else if (pathname.startsWith('/files/')) {
    // Layer file requests: /files/{filename}
    const layerFile = pathname.slice(1); // Remove leading /
    serveFile(layerFile, res);
  } else if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'ACME Registry',
      description: 'Test registry for Paradoc CLI development',
      endpoints: {
        index: '/registry.json',
        artifacts: '/r/{name}.json',
        files: '/files/{filename}',
      },
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    ACME Test Registry                     ║
╠══════════════════════════════════════════════════════════╣
║  Server running at: http://${HOST}:${PORT}                   ║
║                                                          ║
║  Endpoints:                                              ║
║    GET /registry.json     - Registry index               ║
║    GET /r/{name}.json     - Individual artifacts         ║
║    GET /files/{filename}  - Layer files                  ║
║                                                          ║
║  Press Ctrl+C to stop                                    ║
╚══════════════════════════════════════════════════════════╝
`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
