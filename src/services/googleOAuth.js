const axios = require('axios');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildRedirectUri(baseUrl) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${baseUrl.replace(/\/$/, '')}/oauth/google/callback`;
}

function buildAuthUrl(baseUrl, userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = buildRedirectUri(baseUrl);
  const state = jwt.sign({ uid: userId, t: Date.now() }, process.env.JWT_SECRET || 'change-me', { expiresIn: '10m' });
  const scope = [
    'https://www.googleapis.com/auth/drive.readonly',
   
  ].join(' ');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(baseUrl, code, stateJwt) {
  let uid;
  try {
    const decoded = jwt.verify(stateJwt, process.env.JWT_SECRET || 'change-me');
    uid = decoded.uid;
  } catch (e) {
    throw new Error('INVALID_STATE');
  }
  const redirectUri = buildRedirectUri(baseUrl);
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const resp = await axios.post('https://oauth2.googleapis.com/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  const { access_token, refresh_token, expires_in, scope } = resp.data;
  const expires_at = Math.floor(Date.now() / 1000) + (expires_in || 3600);
  const upsert = await supabase
    .from('user_credentials')
    .upsert({
      user_id: uid,
      provider: 'google',
      access_token,
      refresh_token: refresh_token || null,
      expires_at,
      scopes: scope || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,provider' });
  if (upsert.error) throw new Error(upsert.error.message);
  return { user_id: uid, access_token };
}

async function refreshAccessToken(userId, refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const resp = await axios.post('https://oauth2.googleapis.com/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  const { access_token, expires_in } = resp.data;
  const expires_at = Math.floor(Date.now() / 1000) + (expires_in || 3600);
  const upd = await supabase
    .from('user_credentials')
    .update({ access_token, expires_at, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('provider', 'google');
  if (upd.error) throw new Error(upd.error.message);
  return access_token;
}

async function getUserAccessToken(userId) {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!data.access_token && !data.refresh_token) return null;
  if (data.access_token && data.expires_at && data.expires_at - 60 > now) {
    return data.access_token;
  }
  if (!data.refresh_token) return null;
  return await refreshAccessToken(userId, data.refresh_token);
}

module.exports = {
  buildAuthUrl,
  exchangeCode,
  getUserAccessToken
};
