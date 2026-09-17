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

export function registerSW(path = 'sw.js') {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => navigator.serviceWorker.register(path).catch(() => {}));
}
