/* Tablet comforts: fullscreen, orientation, wake lock, gesture guards,
   service-worker registration. Shared by every game in this project. */

let wake = null;

export async function keepAwake() {
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
}
export function releaseWake() { try { wake?.release(); } catch {} wake = null; }

export async function goImmersive() {
  try {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {}
  try { await screen.orientation?.lock?.('landscape'); } catch {}
  keepAwake();
}

/** Stop the browser turning a game swipe into a scroll, zoom or back gesture. */
export function guardGestures() {
  ['gesturestart', 'gesturechange', 'dblclick'].forEach(t =>
    document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}

const isDev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/**
 * Register the offline worker — but never on localhost. A cache-first worker
 * in front of a dev server hides every edit you make behind the last build,
 * and cleaning up after it costs more than it saves.
 */
export function registerSW(path = 'sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (isDev) {
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    caches?.keys?.().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
    return;
  }
  addEventListener('load', () => navigator.serviceWorker.register(path).catch(() => {}));
}
