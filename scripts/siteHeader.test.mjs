import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function compile(relativePath) {
  return ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const navigation = { exports: {} };
new Function("exports", compile("../src/data/navigation/siteNavItems.ts"))(navigation.exports);
const { siteNavItems } = navigation.exports;
const hookSource = compile("../src/hooks/useSiteHeader.ts");

function headerFixture(initialScroll = 0) {
  const state = [];
  const effects = [];
  const listeners = new Map();
  const frames = new Map();
  let nextFrame = 1;
  let resizeCallback;
  let disconnected = false;
  // Booking occupies 6,200px: only a small fraction fits in the old observer band.
  const tops = [0, 1000, 2000, 8200, 9000];
  const sections = siteNavItems.map((item, index) => ({
    id: item.href.slice(1),
    getBoundingClientRect: () => ({ top: tops[index] - window.scrollY }),
  }));
  const window = {
    scrollY: initialScroll,
    innerHeight: 900,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const document = {
    body: {},
    documentElement: { scrollHeight: 10000 },
    querySelector: selector => sections.find(section => `#${section.id}` === selector),
  };
  const react = {
    useState(initial) {
      const index = state.length;
      state.push(initial);
      return [initial, value => { state[index] = value; }];
    },
    useEffect: callback => effects.push(callback),
  };
  class ResizeObserver {
    constructor(callback) { resizeCallback = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const exports = {};
  new Function("require", "exports", "window", "document", "ResizeObserver", hookSource)(
    name => name === "react" ? react : navigation.exports,
    exports, window, document, ResizeObserver,
  );
  exports.useSiteHeader();
  const cleanups = effects.map(effect => effect());
  function flush() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback());
  }
  return {
    get active() { return state[1]; },
    get scrolled() { return state[0]; },
    window, document, tops, listeners, frames,
    get disconnected() { return disconnected; },
    scrollTo(y) { window.scrollY = y; listeners.get("scroll")?.(); flush(); },
    resizeLayout() { resizeCallback(); flush(); },
    cleanup() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test("Book activates and stays active throughout a tall booking section", () => {
  const header = headerFixture();
  assert.equal(header.active, "#home");
  header.scrollTo(1800);
  assert.equal(header.active, "#schedule");
  header.scrollTo(6000);
  assert.equal(header.active, "#schedule");
  header.scrollTo(8000);
  assert.equal(header.active, "#announcements");
  header.scrollTo(2500);
  assert.equal(header.active, "#schedule");
  header.cleanup();
});

test("a restored scroll position inside booking selects Book immediately", () => {
  const header = headerFixture(4000);
  assert.equal(header.active, "#schedule");
  assert.equal(header.scrolled, true);
  header.scrollTo(0);
  assert.equal(header.active, "#home");
  assert.equal(header.scrolled, false);
  header.cleanup();
});

test("layout changes and mobile viewport resizing update the active tab", () => {
  const header = headerFixture(1800);
  assert.equal(header.active, "#schedule");
  header.tops[2] = 2400;
  header.resizeLayout();
  assert.equal(header.active, "#amenities");
  header.window.innerHeight = 600;
  header.listeners.get("resize")();
  header.scrollTo(2300);
  assert.equal(header.active, "#schedule");
  header.cleanup();
});

test("the final section is selected at the bottom even when it is short", () => {
  const header = headerFixture();
  header.tops[4] = 9500;
  header.scrollTo(9100);
  assert.equal(header.active, "#find-us");
  header.cleanup();
});

test("scroll updates are batched and pending work is removed on unmount", () => {
  const header = headerFixture();
  header.listeners.get("scroll")();
  header.listeners.get("scroll")();
  assert.equal(header.frames.size, 1);
  header.cleanup();
  assert.equal(header.listeners.size, 0);
  assert.equal(header.frames.size, 0);
  assert.equal(header.disconnected, true);
});
