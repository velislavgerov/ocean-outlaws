// rendererRuntime.js — injectable renderer runtime factory for incremental backend migration

function createDefaultWebGLRuntime(THREE, qualityConfig) {
  var renderer = new THREE.WebGLRenderer({ antialias: qualityConfig.antialias });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.pixelRatioCap));
  renderer.setClearColor(0x0a0e1a);

  return {
    backend: "webgl",
    renderer: renderer,
    setQualityPixelRatio: function (cfg) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
    },
    resize: function (width, height) {
      renderer.setSize(width, height);
    },
    getCanvas: function () {
      return renderer.domElement;
    }
  };
}

export function createRendererRuntime(THREE, qualityConfig) {
  var injectedFactory = null;
  if (typeof window !== "undefined" && typeof window.__ooRendererFactory === "function") {
    injectedFactory = window.__ooRendererFactory;
  }

  var runtime = null;
  if (injectedFactory) {
    try {
      runtime = injectedFactory(THREE, qualityConfig);
    } catch (err) {
      console.warn("[rendererRuntime] injected renderer factory failed, falling back to WebGL", err);
    }
  }

  if (!runtime || !runtime.renderer) {
    runtime = createDefaultWebGLRuntime(THREE, qualityConfig);
  }

  // Harden runtime surface so callers can rely on shared methods.
  if (typeof runtime.setQualityPixelRatio !== "function") {
    runtime.setQualityPixelRatio = function (cfg) {
      runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
    };
  }
  if (typeof runtime.resize !== "function") {
    runtime.resize = function (width, height) {
      runtime.renderer.setSize(width, height);
    };
  }
  if (typeof runtime.getCanvas !== "function") {
    runtime.getCanvas = function () {
      return runtime.renderer.domElement;
    };
  }

  return runtime;
}
