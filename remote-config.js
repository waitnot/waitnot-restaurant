'use strict';

/**
 * remote-config.js — WaitNot Staff Desktop v3.11.0-w
 *
 * Fetches server configuration from a stable remote URL so the backend
 * domain can be changed without rebuilding the exe.
 *
 * Flow on startup:
 *   1. Try to load cached config from %APPDATA%/waitnot-staff-dashboard/waitnot-config.json
 *   2. Attempt to fetch fresh config from REMOTE_CONFIG_URL (jsDelivr CDN)
 *   3. Validate the fetched config (must be HTTPS, must have api_url field)
 *   4. If valid + changed, save to local cache and update in-memory state
 *   5. All other modules call getApiHost() / getApiUrl() — always returns the
 *      most current value (remote > cache > hardcoded fallback)
 *
 * Fallback chain (most → least preferred):
 *   Remote config (live)  →  Cached config (last known good)  →  Built-in default
 *
 * The built-in default is the CURRENT production server at build time.
 * It only activates if both network AND disk cache fail — i.e. first-ever
 * launch with no internet.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

// Stable URL that will never change even when the backend moves.
// We use jsDelivr CDN pointing at the desktop-app branch of the repo.
const REMOTE_CONFIG_URL =
  'https://cdn.jsdelivr.net/gh/waitnot/waitnot-restaurant@desktop-app/config.json';

// Fallback — used ONLY if both remote fetch AND cache file fail.
// Update this to the latest known-good server when building a new release.
const FALLBACK_API_URL = 'https://waitnot-restaurant-2.onrender.com';

const FETCH_TIMEOUT_MS   = 8000;   // 8s timeout for remote fetch
const CACHE_FILENAME     = 'waitnot-config.json';
const MIN_REFRESH_MS     = 5 * 60 * 1000;  // don't re-fetch more than once per 5 min

// ─── State ────────────────────────────────────────────────────────────────────

let _apiUrl       = FALLBACK_API_URL;   // active API URL (changes after successful fetch)
let _source       = 'fallback';         // 'fallback' | 'cache' | 'remote'
let _lastFetchAt  = 0;                  // epoch ms of last successful remote fetch
let _userDataPath = null;               // set by init()
let _ready        = false;              // true after init() completes first load

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCachePath() {
  if (!_userDataPath) return null;
  return path.join(_userDataPath, CACHE_FILENAME);
}

function isValidConfig(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.api_url !== 'string') return false;
  if (!obj.api_url.startsWith('https://'))  return false;
  // Must not be empty after trimming
  return obj.api_url.trim().length > 10;
}

function readCache() {
  try {
    const p = getCachePath();
    if (!p || !fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(raw);
    if (!isValidConfig(obj)) return null;
    console.log(`[remote-config] Cache loaded: ${obj.api_url}`);
    return obj;
  } catch (e) {
    console.warn('[remote-config] Cache read error:', e.message);
    return null;
  }
}

function writeCache(obj) {
  try {
    const p = getCachePath();
    if (!p) return;
    fs.writeFileSync(p, JSON.stringify({ ...obj, _cachedAt: new Date().toISOString() }, null, 2));
    console.log('[remote-config] Cache saved ✅');
  } catch (e) {
    console.warn('[remote-config] Cache write error:', e.message);
  }
}

// ─── Remote fetch ─────────────────────────────────────────────────────────────

function fetchRemoteConfig() {
  return new Promise((resolve) => {
    const url  = new URL(REMOTE_CONFIG_URL);
    const req  = https.request({
      hostname: url.hostname,
      path    : url.pathname + url.search,
      method  : 'GET',
      headers : { Accept: 'application/json', 'User-Agent': 'WaitNot-Staff/3.11' },
      rejectUnauthorized: true,   // strict TLS — CDN has valid cert
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.warn(`[remote-config] HTTP ${res.statusCode} from CDN`);
          return resolve(null);
        }
        try {
          const obj = JSON.parse(body);
          resolve(obj);
        } catch {
          console.warn('[remote-config] JSON parse error from CDN response');
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[remote-config] Fetch error:', err.message);
      resolve(null);
    });

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      console.warn(`[remote-config] Fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
      resolve(null);
    });

    req.end();
  });
}

// ─── Apply config ─────────────────────────────────────────────────────────────

function applyConfig(obj, source) {
  const newUrl = obj.api_url.replace(/\/$/, ''); // strip trailing slash
  const changed = newUrl !== _apiUrl;
  _apiUrl  = newUrl;
  _source  = source;
  if (changed) {
    console.log(`[remote-config] API URL updated (${source}): ${_apiUrl}`);
  }
  return changed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise — call once from main.js after app is ready.
 * @param {string} userDataPath  app.getPath('userData')
 */
async function init(userDataPath) {
  _userDataPath = userDataPath;

  // Step 1: load cache so we have something immediately
  const cached = readCache();
  if (cached) {
    applyConfig(cached, 'cache');
  }

  // Step 2: try remote fetch
  await refresh();

  _ready = true;
  console.log(`[remote-config] Ready — source=${_source} url=${_apiUrl}`);
  return { apiUrl: _apiUrl, source: _source };
}

/**
 * Refresh config from remote. Skips if called too recently.
 * Called automatically on startup and can be triggered manually.
 */
async function refresh() {
  const now = Date.now();
  if (now - _lastFetchAt < MIN_REFRESH_MS && _lastFetchAt > 0) {
    console.log('[remote-config] Skipping refresh — too soon');
    return false;
  }

  const obj = await fetchRemoteConfig();
  if (!obj) return false;

  if (!isValidConfig(obj)) {
    console.warn('[remote-config] Remote config failed validation:', JSON.stringify(obj));
    return false;
  }

  _lastFetchAt = Date.now();
  const changed = applyConfig(obj, 'remote');
  if (changed || _source !== 'remote') {
    writeCache(obj);
  }
  return changed;
}

/**
 * Returns the current API hostname only (e.g. "waitnot-restaurant-2.onrender.com").
 * Used by sync-engine.js and upload-engine.js for https.request({ hostname }).
 */
function getApiHost() {
  try {
    return new URL(_apiUrl).hostname;
  } catch {
    return new URL(FALLBACK_API_URL).hostname;
  }
}

/**
 * Returns the full API origin URL (e.g. "https://waitnot-restaurant-2.onrender.com").
 * Used by main.js for CORS header injection and Socket.IO URL patch.
 */
function getApiUrl() {
  return _apiUrl || FALLBACK_API_URL;
}

/**
 * Returns a status object for diagnostics / About dialog.
 */
function getStatus() {
  return {
    apiUrl      : _apiUrl,
    apiHost     : getApiHost(),
    source      : _source,
    lastFetchAt : _lastFetchAt ? new Date(_lastFetchAt).toISOString() : null,
    ready       : _ready,
  };
}

module.exports = { init, refresh, getApiHost, getApiUrl, getStatus };
