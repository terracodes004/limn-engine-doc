import { Minimap } from "../ui/minimap.js";
import { TextBuffer } from "./buffer.js";
import { Viewport } from "./viewport.js";
import { Highlighter } from "./highlighter.js";
import { javascript } from "./lang-javascript.js";
import { Caret } from "./caret.js";
import { VS_DARK } from "./theme.js";

const out = document.getElementById("out");
let passed = 0;
let failed = 0;

function log(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  out.appendChild(div);
}

function group(name) {
  log(`<span class="group">── ${name} ──</span>`);
}

function check(name, fn) {
  try {
    fn();
    passed++;
    log(`<span class="pass">  ✓ ${name}</span>`);
  } catch (e) {
    failed++;
    log(`<span class="fail">  ✗ ${name}</span>\n    ${e.message}`);
  }
}

function eq(a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`expected ${sb}, got ${sa}`);
}

function assert(cond, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

function makeComponent(text) {
  const buffer = new TextBuffer(text);
  const viewport = new Viewport();
  const highlighter = new Highlighter(javascript);
  const carets = [new Caret(0, 0)];
  viewport.setSize(640, 400);
  let maxLen = 0;
  for (let i = 0; i < buffer.lineCount(); i++) {
    maxLen = Math.max(maxLen, buffer.lineLength(i));
  }
  viewport.setContentSize(buffer.lineCount(), maxLen);

  return {
    editor: {
      buffer,
      viewport,
      highlighter,
      carets,
      renderer: { theme: VS_DARK },
    },
    _shouldIgnoreEditorTouch: () => false,
    renderForce: () => {},
  };
}

group("constructor");

check("default width is 72", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  eq(m.width, 72);
});

check("custom width honored", () => {
  const c = makeComponent("a");
  const m = new Minimap(c, { width: 100 });
  eq(m.width, 100);
});

check("starts visible", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  eq(m.isVisible(), true);
});

group("ink cache");

check("_ensureInk populates arrays", () => {
  const c = makeComponent("short\nmuch much longer line here\nx");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 3, VS_DARK, c.editor);
  assert(m._ink instanceof Float32Array);
  eq(m._ink.length, 3);
  assert(m._inkColors.length === 3);
});

check("blank line has zero ink", () => {
  const c = makeComponent("a\n\nb");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 3, VS_DARK, c.editor);
  eq(m._ink[1], 0);
});

check("ink ratios normalized to 1", () => {
  const c = makeComponent("aaaaaaaaaa\nb");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 2, VS_DARK, c.editor);
  assert(m._ink[0] <= 1);
  assert(m._ink[0] > m._ink[1]);
});

check("_inkVersion tracks buffer version", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  const v1 = m._inkVersion;
  c.editor.buffer.insert(0, 1, "b");
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  const v2 = m._inkVersion;
  assert(v2 > v1);
});

check("theme change invalidates ink", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  const altTheme = JSON.parse(JSON.stringify(VS_DARK));
  altTheme.name = "alt";
  altTheme.colors.lineNumber = "#ff00ff";
  m._ensureInk(c.editor.buffer, 1, altTheme, c.editor);
  eq(m._inkTheme, "alt");
});

group("semantic colors");

check("comment-heavy line gets comment color", () => {
  const c = makeComponent("// this is a comment");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  eq(m._inkColors[0], VS_DARK.tokens.comment);
});

check("string-heavy line gets string color", () => {
  const c = makeComponent("\"aaaaaaaaaaaaaaaaaaaa\"");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  eq(m._inkColors[0], VS_DARK.tokens.string);
});

check("keyword-heavy line gets keyword color", () => {
  const c = makeComponent("const let var function return if else");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  eq(m._inkColors[0], VS_DARK.tokens.keyword);
});

check("empty line gets default lineNumber color", () => {
  const c = makeComponent("");
  const m = new Minimap(c);
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  eq(m._inkColors[0], VS_DARK.colors.lineNumber);
});

check("semantic disabled falls back to uniform gray", () => {
  const c = makeComponent("// comment");
  const m = new Minimap(c, { semantic: false });
  m._ensureInk(c.editor.buffer, 1, VS_DARK, c.editor);
  eq(m._inkColors[0], VS_DARK.colors.lineNumber);
});

group("hit test");

check("_yToLine top of minimap is line 0", () => {
  const c = makeComponent("a\nb\nc\nd\ne");
  const m = new Minimap(c);
  m._lineHeight = 10;
  eq(m._yToLine(1), 0);
});

check("_yToLine mid hits middle line", () => {
  const c = makeComponent("a\nb\nc\nd\ne");
  const m = new Minimap(c);
  m._lineHeight = 10;
  eq(m._yToLine(31), 3);
});

check("_yToLine below bottom clamps to last", () => {
  const c = makeComponent("a\nb\nc\nd\ne");
  const m = new Minimap(c);
  m._lineHeight = 10;
  eq(m._yToLine(9999), 4);
});

check("_yToLine negative clamps to zero", () => {
  const c = makeComponent("a\nb");
  const m = new Minimap(c);
  m._lineHeight = 10;
  eq(m._yToLine(-50), 0);
});

group("guard behavior");

check("_shouldIgnoreEditorTouch blocks pointerdown", () => {
  const c = makeComponent("a");
  c._shouldIgnoreEditorTouch = () => true;
  const m = new Minimap(c);
  m._dragging = false;
  let prevented = false;
  const fakeEvent = {
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
    pointerId: 1,
    clientY: 100,
  };
  m._onPointerDown(fakeEvent);
  eq(m._dragging, false);
  eq(prevented, false);
});

check("_shouldIgnoreEditorTouch false permits pointerdown", () => {
  const c = makeComponent("a\nb\nc");
  const m = new Minimap(c);
  m._root = {
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 72, height: 400 }),
  };
  m._lineHeight = 10;
  let prevented = false;
  const fakeEvent = {
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
    pointerId: 1,
    clientY: 50,
  };
  m._onPointerDown(fakeEvent);
  eq(m._dragging, true);
  eq(prevented, true);
});

check("pointerdown when not visible does nothing", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  m._visible = false;
  let prevented = false;
  const fakeEvent = {
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
    pointerId: 1,
    clientY: 50,
  };
  m._onPointerDown(fakeEvent);
  eq(m._dragging, false);
  eq(prevented, false);
});

check("pointermove without pointerdown does nothing", () => {
  const c = makeComponent("a\nb\nc");
  const m = new Minimap(c);
  m._root = {
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 72, height: 400 }),
  };
  m._dragging = false;
  m._lineHeight = 10;
  let prevented = false;
  const fakeEvent = {
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
    pointerId: 1,
    clientY: 50,
  };
  m._onPointerMove(fakeEvent);
  eq(prevented, false);
});

check("pointerup releases drag state", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  m._root = {
    releasePointerCapture: () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 72, height: 400 }),
  };
  m._dragging = true;
  m._pointerId = 5;
  m._onPointerUp({
    preventDefault: () => {},
    stopPropagation: () => {},
    pointerId: 5,
  });
  eq(m._dragging, false);
  eq(m._pointerId, null);
});

check("setLayout updates DOM style", () => {
  const c = makeComponent("a");
  const m = new Minimap(c);
  const el = { style: {} };
  m._root = el;
  m.setLayout(100, 200, 72, 400);
  eq(el.style.left, "100px");
  eq(el.style.top, "200px");
  eq(el.style.width, "72px");
  eq(el.style.height, "400px");
});

check("setLayout does not mutate this.width", () => {
  const c = makeComponent("a");
  const m = new Minimap(c, { width: 72 });
  m._root = { style: {} };
  m.setLayout(0, 0, 999, 400);
  eq(m.width, 72);
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
    `${passed} passed, ${failed} failed</span>`
);