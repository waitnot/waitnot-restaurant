/**
 * Secure storage utility.
 * On Android (Capacitor): uses native SharedPreferences — survives cache clears.
 * On web/desktop: falls back to localStorage.
 */

const isNative = () => typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() || window.location?.protocol === 'capacitor:'
);

async function getNativePlugin() {
  if (!isNative()) return null;
  if (window.Capacitor?.Plugins?.SecureStorage) return window.Capacitor.Plugins.SecureStorage;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    return registerPlugin('SecureStorage');
  } catch (_) { return null; }
}

export async function secureSet(key, value) {
  if (isNative()) {
    try {
      const p = await getNativePlugin();
      if (p) { await p.set({ key, value: String(value) }); return; }
    } catch (_) {}
  }
  localStorage.setItem(key, value);
}

export async function secureGet(key) {
  if (isNative()) {
    try {
      const p = await getNativePlugin();
      if (p) {
        const { value } = await p.get({ key });
        return value;
      }
    } catch (_) {}
  }
  return localStorage.getItem(key);
}

export async function secureRemove(key) {
  if (isNative()) {
    try {
      const p = await getNativePlugin();
      if (p) { await p.remove({ key }); }
    } catch (_) {}
  }
  localStorage.removeItem(key);
}
