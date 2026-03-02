import { WebGPURenderer } from "three/webgpu";

function canUseWebGPU() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

function hasSessionLock(sessionLockKey) {
  if (!sessionLockKey || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(sessionLockKey) === "1";
  } catch (_error) {
    return false;
  }
}

function setSessionLock(sessionLockKey) {
  if (!sessionLockKey || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(sessionLockKey, "1");
  } catch (_error) {
    // ignore storage failures
  }
}

function getPixelRatioCap(cfg) {
  var cap = cfg && Number.isFinite(cfg.pixelRatioCap) ? cfg.pixelRatioCap : 1;
  return Math.min(window.devicePixelRatio || 1, cap);
}

export function installLegacyWebgpuFactory(options) {
  if (typeof window === "undefined") return function () {};
  options = options || {};
  var forceAttempt = !!options.forceAttempt;
  var sessionLockKey = options.sessionLockKey || "oo_renderer_webgpu_lock";

  var previousFactory = typeof window.__ooRendererFactory === "function"
    ? window.__ooRendererFactory
    : null;

  window.__ooRendererFactory = function (THREE, qualityConfig) {
    window.__ooRendererFallbackReason = null;

    // Headless Playwright/CI environments can hang on WebGPU init.
    // Keep deterministic automation by forcing WebGL fallback there.
    if (navigator.webdriver) {
      window.__ooRendererFallbackReason = "webgpu-disabled-webdriver";
      return previousFactory ? previousFactory(THREE, qualityConfig) : null;
    }

    if (!forceAttempt && hasSessionLock(sessionLockKey)) {
      window.__ooRendererFallbackReason = "webgpu-session-lock";
      return previousFactory ? previousFactory(THREE, qualityConfig) : null;
    }

    if (!canUseWebGPU()) {
      window.__ooRendererFallbackReason = "webgpu-unavailable";
      return previousFactory ? previousFactory(THREE, qualityConfig) : null;
    }

    try {
      var renderer = new WebGPURenderer({ antialias: !!qualityConfig.antialias });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(getPixelRatioCap(qualityConfig));
      if (typeof renderer.setClearColor === "function") renderer.setClearColor(0x0a0e1a);
      var baseRender = renderer.render.bind(renderer);

      var initialized = false;
      var initFailed = false;
      renderer.init().then(function () {
        initialized = true;
      }).catch(function (error) {
        initFailed = true;
        window.__ooRendererFallbackReason = "webgpu-init-failed";
        setSessionLock(sessionLockKey);
        console.warn("[webgpu] Renderer init() failed", error);
      });

      renderer.render = function (scene, camera) {
        if (!initialized || initFailed) return;
        baseRender(scene, camera);
      };

      return {
        backend: "webgpu",
        renderer: renderer,
        setQualityPixelRatio: function (cfg) {
          renderer.setPixelRatio(getPixelRatioCap(cfg));
        },
        resize: function (width, height) {
          renderer.setSize(width, height);
        },
        getCanvas: function () {
          return renderer.domElement;
        }
      };
    } catch (error) {
      window.__ooRendererFallbackReason = "webgpu-init-failed";
      setSessionLock(sessionLockKey);
      console.warn("[webgpu] Failed to initialize WebGPURenderer, falling back to WebGL", error);
      return previousFactory ? previousFactory(THREE, qualityConfig) : null;
    }
  };

  return function restore() {
    if (previousFactory) window.__ooRendererFactory = previousFactory;
    else delete window.__ooRendererFactory;
  };
}
