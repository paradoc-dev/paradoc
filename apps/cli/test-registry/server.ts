/**
 * ACME Test Registry Server
 *
 * A simple HTTP server that serves the ACME registry for testing.
 *
 * The CLI test suite starts it in-process through `startTestRegistry()` on a
 * port the operating system picks, so parallel runs in different worktrees do
 * not collide (see tests/setup/test-registry-server.ts).
 *
 * Run it by hand with: npx tsx test-registry/server.ts [--port <port>]
 * The port defaults to 4567. Port 0 asks the operating system for a free one.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The port a manual run listens on when no `--port` is given. */
export const MANUAL_PORT = 4567;
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

function createRegistryServer(logRequests: boolean): http.Server {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url || '/', `http://${HOST}`).pathname;

    if (logRequests) console.log(`${req.method} ${pathname}`);

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
      serveFile(pathname.slice(1), res);
    } else if (pathname.startsWith('/files/')) {
      // Layer file requests: /files/{filename}
      serveFile(pathname.slice(1), res);
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
}

export interface TestRegistry {
  /** Base URL of the running registry, e.g. `http://localhost:53124`. */
  url: string;
  /** Stops the server. */
  close: () => Promise<void>;
}

/**
 * Starts the registry and resolves once it listens.
 *
 * `port` 0 (the default) asks the operating system for a free port; the
 * returned `url` carries the port it chose.
 */
export function startTestRegistry(
  options: { port?: number; logRequests?: boolean } = {},
): Promise<TestRegistry> {
  const server = createRegistryServer(options.logRequests ?? false);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, HOST, () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('The test registry server gave no TCP port.'));
        return;
      }
      resolve({
        url: `http://${HOST}:${address.port}`,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
            server.closeAllConnections();
          }),
      });
    });
  });
}

function manualPort(argv: string[]): number {
  const index = argv.indexOf('--port');
  if (index === -1) return MANUAL_PORT;
  const port = Number(argv[index + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`--port must be an integer from 0 to 65535, got "${argv[index + 1] ?? ''}"`);
  }
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const registry = await startTestRegistry({ port: manualPort(process.argv.slice(2)), logRequests: true });
  console.log(`ACME Test Registry running at ${registry.url}

Endpoints:
  GET /registry.json     - Registry index
  GET /r/{name}.json     - Individual artifacts
  GET /files/{filename}  - Layer files

Press Ctrl+C to stop`);

  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    void registry.close().then(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  });
}
