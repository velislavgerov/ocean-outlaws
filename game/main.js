const searchParams = new URLSearchParams(window.location.search);
const useWebgpuBootstrap = searchParams.has('bootstrap') || searchParams.has('webgpuBootstrap');
const requestedRenderer = (searchParams.get('renderer') || '').toLowerCase();
const forceWebGL = requestedRenderer === 'webgl';

async function init() {
  window.__ooRequestedRenderer = requestedRenderer || 'default';
  window.__ooRendererFallbackReason = null;

  if (useWebgpuBootstrap) {
    await import('./webgpu/bootstrap.js');
    return;
  }

  if (forceWebGL) {
    delete window.__ooRendererFactory;
  } else {
    const { installLegacyWebgpuFactory } = await import('./webgpu/legacyRendererFactory.js');
    installLegacyWebgpuFactory();
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
