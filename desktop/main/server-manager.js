const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const { app } = require('electron');

let serverProcess = null;

function findFreePort(preferred = 5001) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(preferred, () => { s.close(() => resolve(preferred)); });
    s.on('error', () => {
      const s2 = net.createServer();
      s2.listen(0, () => { const p = s2.address().port; s2.close(() => resolve(p)); });
    });
  });
}

function waitForPort(port, maxWait = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const c = net.createConnection({ port }, () => { c.destroy(); resolve(); });
      c.on('error', () => {
        if (Date.now() - start > maxWait) return reject(new Error(`Server did not start on port ${port} within ${maxWait}ms`));
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function startServer() {
  const port = await findFreePort(5001);

  // In dev: server lives at ../../server relative to main.js
  // In prod (packaged): server is in process.resourcesPath/server
  const isDev = !app.isPackaged;
  const serverDir = isDev
    ? path.join(__dirname, '../../server')
    : path.join(process.resourcesPath, 'server');

  const serverEntry = path.join(serverDir, 'server.js');

  // Ensure server has its node_modules in dev; in prod they are bundled
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    ELECTRON: 'true',
    // Point server static files to built client
    CLIENT_DIST: isDev
      ? path.join(__dirname, '../../client/dist')
      : path.join(process.resourcesPath, 'client/dist'),
  };

  serverProcess = spawn('node', [serverEntry], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', d => console.log('[server]', d.toString().trim()));
  serverProcess.stderr?.on('data', d => console.error('[server err]', d.toString().trim()));

  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
    serverProcess = null;
  });

  await waitForPort(port);
  return port;
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

module.exports = { startServer, stopServer };
