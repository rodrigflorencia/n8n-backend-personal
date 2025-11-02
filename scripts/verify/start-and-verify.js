const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const port = parseInt(process.env.VERIFY_PORT || '3456', 10);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const skipDbDefault = process.env.SKIP_DB === undefined ? '1' : process.env.SKIP_DB; // default skip DB

function waitForServer(url, timeoutMs = 15000, intervalMs = 250) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await axios.get(`${url}/health`, { timeout: 1000 });
        if (res.status === 200 && res.data?.status === 'ok') return resolve();
      } catch (_) {}
      if (Date.now() - start >= timeoutMs) return reject(new Error('Server did not become healthy in time'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function main() {
  console.log(`Starting server on port ${port}...`);
  const childEnv = { ...process.env, PORT: String(port) };
  const server = spawn('node', ['src/app.js'], { stdio: 'inherit', env: childEnv });

  const cleanup = () => {
    if (!server.killed) {
      try { server.kill(); } catch (_) {}
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    await waitForServer(baseUrl);
    console.log(`Server is healthy at ${baseUrl}`);
  } catch (e) {
    console.error('Health check failed:', e.message);
    cleanup();
    process.exit(1);
    return;
  }

  console.log('Running verification suite...');
  await new Promise((resolve) => setTimeout(resolve, 200));

  const verifyEnv = {
    ...process.env,
    BASE_URL: baseUrl,
    SKIP_DB: skipDbDefault,
  };

  const runner = spawn('node', [path.join('scripts', 'verify', 'run.js')], { stdio: 'inherit', env: verifyEnv });
  runner.on('close', (code) => {
    cleanup();
    process.exit(code || 0);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
