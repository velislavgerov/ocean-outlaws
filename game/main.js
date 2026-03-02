const searchParams = new URLSearchParams(window.location.search);
const useWebgpuBootstrap = searchParams.has('bootstrap') || searchParams.has('webgpuBootstrap');
const rendererParam = (searchParams.get('renderer') || '').toLowerCase();
const requestedRenderer = rendererParam === 'webgl' || rendererParam === 'webgpu' ? rendererParam : 'auto';
const forceWebGL = requestedRenderer === 'webgl';
const forceWebGPU = requestedRenderer === 'webgpu';
const WEBGPU_SESSION_LOCK_KEY = 'oo_renderer_webgpu_lock';
const WEBGPU_PREFLIGHT_TIMEOUT_MS = 1600;

function hasWebgpuSessionLock() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(WEBGPU_SESSION_LOCK_KEY) === '1';
  } catch (_error) {
    return false;
  }
}

function setWebgpuSessionLock() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(WEBGPU_SESSION_LOCK_KEY, '1');
    }
  } catch (_error) {
    // ignore storage failures
  }
}

async function preflightWebgpu() {
  if (forceWebGL) {
    return { ok: false, reason: 'webgl-forced', lock: false };
  }
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { ok: false, reason: 'webgpu-unavailable', lock: false };
  }
  if (navigator.webdriver) {
    return { ok: false, reason: 'webgpu-disabled-webdriver', lock: false };
  }
  if (!forceWebGPU && hasWebgpuSessionLock()) {
    return { ok: false, reason: 'webgpu-session-lock', lock: false };
  }

  try {
    let timeoutId = null;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ timeout: true }), WEBGPU_PREFLIGHT_TIMEOUT_MS);
    });
    const adapterPromise = navigator.gpu.requestAdapter().then((adapter) => ({ adapter: adapter })).catch(() => ({ adapter: null }));
    const result = await Promise.race([adapterPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (result && result.timeout) {
      return { ok: false, reason: 'webgpu-preflight-timeout', lock: true };
    }
    if (!result || !result.adapter) {
      return { ok: false, reason: 'webgpu-adapter-unavailable', lock: false };
    }
    return { ok: true, reason: null, lock: false };
  } catch (_error) {
    return { ok: false, reason: 'webgpu-preflight-failed', lock: false };
  }
}

async function init() {
  window.__ooRequestedRenderer = requestedRenderer;
  window.__ooRendererFallbackReason = null;

  if (useWebgpuBootstrap) {
    await import('./webgpu/bootstrap.js');
    return;
  }

  const preflight = await preflightWebgpu();
  if (!preflight.ok) {
    window.__ooRendererFallbackReason = preflight.reason;
    if (preflight.lock) setWebgpuSessionLock();
  }

  if (forceWebGL || !preflight.ok) {
    delete window.__ooRendererFactory;
  } else {
    const { installLegacyWebgpuFactory } = await import('./webgpu/legacyRendererFactory.js');
    installLegacyWebgpuFactory({
      forceAttempt: forceWebGPU,
      sessionLockKey: WEBGPU_SESSION_LOCK_KEY
    });
  }

  const bootstrapCanvas = document.querySelector('#canvas');
  const bootstrapFallback = document.querySelector('#fallback');
  if (bootstrapCanvas) bootstrapCanvas.remove();
  if (bootstrapFallback) bootstrapFallback.remove();

  await import('./js/main.js');
}

init().catch((error) => {
  console.error('Entry bootstrap failed', error);
});
