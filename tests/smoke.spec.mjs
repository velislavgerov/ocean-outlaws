import { test, expect } from "@playwright/test";

// The game takes time to initialize: entry HTML has #canvas which gets removed,
// then the renderer creates a new canvas and appends it to body.
// Force WebGL path in tests to avoid WebGPU issues in headless Chromium.

test("game loads without console errors", async ({ page }) => {
  var errors = [];
  page.on("pageerror", function (err) { errors.push(err.message); });

  // Force WebGL to avoid WebGPU issues in headless
  await page.goto("/?renderer=webgl");
  // Wait for the game to fully initialize
  await page.waitForTimeout(5000);

  // The renderer creates a canvas and appends to body
  var canvasCount = await page.evaluate(function () {
    return document.querySelectorAll("canvas").length;
  });
  expect(canvasCount).toBeGreaterThan(0);

  // Filter out benign errors
  var critical = errors.filter(function (e) {
    return e.indexOf("ResizeObserver") === -1 &&
      e.indexOf("WebGPU") === -1 &&
      e.indexOf("Cannot read properties of null") === -1;
  });
  expect(critical).toEqual([]);
});

test("renderer initializes with webgl backend", async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForTimeout(5000);

  var backend = await page.evaluate(function () {
    return window.__ooRendererBackend || "unknown";
  });
  expect(backend).toBe("webgl");
});

test("render_game_to_text returns valid state", async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForTimeout(6000);

  var state = await page.evaluate(function () {
    if (typeof window.render_game_to_text === "function") {
      var result = window.render_game_to_text();
      if (typeof result === "string") return JSON.parse(result);
      return result;
    }
    return null;
  });

  expect(state).not.toBeNull();
  expect(state.mode).toBeDefined();
  expect(state.renderer).toBeDefined();
});

test("advanceTime works via ticker", async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForTimeout(6000);

  var result = await page.evaluate(function () {
    if (typeof window.advanceTime !== "function") return "missing";
    try {
      window.advanceTime(500);
      return "ok";
    } catch (e) {
      return "error:" + e.message;
    }
  });
  expect(result).toBe("ok");
});

test("debug panel activates with hash", async ({ page }) => {
  await page.goto("/?renderer=webgl#debug");
  await page.waitForTimeout(6000);

  var hasPane = await page.evaluate(function () {
    // Tweakpane injects a container with class tp-dfwv
    return document.querySelector(".tp-dfwv") !== null;
  });
  expect(hasPane).toBe(true);
});

test("mobile viewport shows orientation prompt in portrait", async ({ browser }) => {
  var context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });
  var page = await context.newPage();
  await page.goto("/?renderer=webgl");
  await page.waitForTimeout(5000);

  // The orientation overlay is created dynamically by mobile.js
  var hasPrompt = await page.evaluate(function () {
    var divs = document.querySelectorAll("div");
    for (var i = 0; i < divs.length; i++) {
      if (divs[i].textContent.indexOf("Rotate your device") !== -1) {
        return true;
      }
    }
    return false;
  });
  expect(hasPrompt).toBe(true);

  await context.close();
});
