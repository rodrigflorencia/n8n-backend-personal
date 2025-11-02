const { get, post, sleep, BASE_URL } = require('./lib/http');

function banner(msg) { console.log(`\n=== ${msg} ===`); }
function ok(msg) { console.log(`✔ ${msg}`); }
function fail(msg) { console.log(`✖ ${msg}`); }

async function acquireToken() {
  const tokenFromEnv = process.env.TEST_ACCESS_TOKEN;
  if (tokenFromEnv) return { token: tokenFromEnv, obtained: 'env' };

  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (email && password) {
    const res = await post('/api/auth/login', { email, password });
    if (res.status === 200 && res.data && res.data.access_token) {
      return { token: res.data.access_token, obtained: 'login' };
    }
    throw new Error(`Login failed: status=${res.status}, body=${JSON.stringify(res.data)}`);
  }
  return { token: null, obtained: 'none' };
}

async function stepHealth() {
  banner('STEP 1: Health check');
  const res = await get('/health');
  if (res.status !== 200 || res.data?.status !== 'ok') {
    throw new Error(`Unexpected health response: ${res.status} ${JSON.stringify(res.data)}`);
  }
  ok(`Health OK at ${BASE_URL}`);
}

async function stepProtected(token) {
  banner('STEP 2: Protected endpoints');
  if (!token) {
    console.log('No TEST_ACCESS_TOKEN provided and no TEST_EMAIL/TEST_PASSWORD set. Skipping protected tests.');
    return { skipped: true };
  }
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const skipDb = process.env.SKIP_DB === '1';

  // /api/workflows
  const wf = await get('/api/workflows', auth);
  if (wf.status !== 200 || !Array.isArray(wf.data?.workflows)) {
    throw new Error(`/api/workflows failed: ${wf.status} ${JSON.stringify(wf.data)}`);
  }
  // Validate structure
  const first = wf.data.workflows[0];
  if (first && (typeof first.type !== 'string' || typeof first.description !== 'string')) {
    throw new Error(`/api/workflows schema mismatch`);
  }
  ok('GET /api/workflows');

  // /api/invoice/prefs (GET) - DB dependent
  if (!skipDb) {
    const prefs = await get('/api/invoice/prefs', auth);
    if (prefs.status !== 200) {
      throw new Error(`/api/invoice/prefs (GET) failed: ${prefs.status}`);
    }
    ok('GET /api/invoice/prefs');
  } else {
    console.log('Skipping /api/invoice/prefs (GET) due to SKIP_DB=1');
  }

  // /api/execute-workflow (POST) -> expect 400 when workflow_type missing
  const exec = await post('/api/execute-workflow', {}, { headers: auth.headers });
  if (exec.status !== 400) {
    throw new Error(`/api/execute-workflow expected 400 on missing workflow_type, got ${exec.status}`);
  }
  ok('POST /api/execute-workflow -> 400 when missing workflow_type');

  // OAuth status (DB dependent)
  if (!skipDb) {
    const oauthStatus = await get('/api/oauth/google/status', auth);
    if (oauthStatus.status !== 200 || typeof oauthStatus.data?.connected !== 'boolean') {
      throw new Error(`/api/oauth/google/status failed: ${oauthStatus.status}`);
    }
    ok('GET /api/oauth/google/status');
  } else {
    console.log('Skipping /api/oauth/google/status due to SKIP_DB=1');
  }

  const oauthUrl = await get('/api/oauth/google/url', auth);
  if (oauthUrl.status !== 200 || typeof oauthUrl.data?.auth_url !== 'string') {
    throw new Error(`/api/oauth/google/url failed: ${oauthUrl.status}`);
  }
  ok('GET /api/oauth/google/url');

  // Optional write test
  if (process.env.TEST_WRITE === '1') {
    if (!skipDb) {
      const setPrefs = await post('/api/invoice/prefs', { drive_folder_id: null, spreadsheet_id: null, range: null }, { headers: auth.headers });
      if (setPrefs.status !== 200) {
        throw new Error(`/api/invoice/prefs (POST) failed: ${setPrefs.status}`);
      }
      ok('POST /api/invoice/prefs (optional write)');
    } else {
      console.log('Skipping write test (/api/invoice/prefs POST) due to SKIP_DB=1');
    }
  } else {
    console.log('Skipping write test (/api/invoice/prefs POST). Set TEST_WRITE=1 to enable.');
  }
}

async function stepRateLimit(token) {
  banner('STEP 3: Rate limit (optional)');
  if (process.env.VERIFY_RATELIMIT !== '1') {
    console.log('Skipping rate limit test. Set VERIFY_RATELIMIT=1 to enable.');
    return { skipped: true };
  }
  if (!token) {
    console.log('Rate limit test requires token. Provide TEST_ACCESS_TOKEN or TEST_EMAIL/TEST_PASSWORD.');
    return { skipped: true };
  }
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const attempts = parseInt(process.env.VERIFY_RATELIMIT_N || '12', 10);
  let got429 = false;
  for (let i = 1; i <= attempts; i++) {
    const res = await get('/api/client-info', auth);
    if (res.status === 429) { got429 = true; break; }
    await sleep(50);
  }
  if (!got429) throw new Error('Did not hit 429 during rate limit test');
  ok('Rate limit triggered (429)');
}

(async () => {
  const started = Date.now();
  let failures = 0;

  try { await stepHealth(); } catch (e) { failures++; fail(e.message); }

  let tokenInfo; 
  try {
    tokenInfo = await acquireToken();
    if (tokenInfo.token) ok(`Auth token acquired via ${tokenInfo.obtained}`);
    else console.log('No token available; protected tests may be skipped.');
  } catch (e) { failures++; fail(`Auth acquisition failed: ${e.message}`); }

  try { await stepProtected(tokenInfo?.token); } catch (e) { failures++; fail(e.message); }
  try { await stepRateLimit(tokenInfo?.token); } catch (e) { failures++; fail(e.message); }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  banner(`DONE in ${secs}s`);
  if (failures > 0) {
    console.log(`Failures: ${failures}`);
    process.exitCode = 1;
  } else {
    console.log('All checks passed');
  }
})();
