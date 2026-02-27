import { WebGPURenderer } from "three/webgpu";

function canUseWebGPU() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

function getPixelRatioCap(cfg) {
  var cap = cfg && Number.isFinite(cfg.pixelRatioCap) ? cfg.pixelRatioCap : 1;
  return Math.min(window.devicePixelRatio || 1, cap);
}

export function installLegacyWebgpuFactory() {
  if (typeof window === "undefined") return function () {};

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
      console.warn("[webgpu] Failed to initialize WebGPURenderer, falling back to WebGL", error);
      return previousFactory ? previousFactory(THREE, qualityConfig) : null;
    }
  };

  return function restore() {
    if (previousFactory) window.__ooRendererFactory = previousFactory;
    else delete window.__ooRendererFactory;
  };
}
