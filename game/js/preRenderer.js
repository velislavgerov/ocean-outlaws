// preRenderer.js — forces shader compilation before gameplay starts
// Renders one frame with representative materials to avoid runtime stutter.
// Inspired by folio-2025 PreRenderer pattern.

import * as THREE from "three";

export function preCompileShaders(renderer, scene, camera) {
  if (!renderer || !scene || !camera) return;

  // Compile all materials currently in the scene
  if (typeof renderer.compile === "function") {
    renderer.compile(scene, camera);
  }

  // Force one render pass to trigger any lazy shader compilation
  renderer.render(scene, camera);
}
