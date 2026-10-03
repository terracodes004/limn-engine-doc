import { LimnEditor } from "./editor.js";

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

group("construction");

check("new editor is empty", () => {
  const e = new LimnEditor();
  eq(e.getValue(), "");
  eq(e.getCursor().line, 0);
  eq(e.getCursor().col, 0);
});

check("editor accepts initial value", () => {
  const e = new LimnEditor({ value: "hello\nworld" });
  eq(e.getValue(), "hello\nworld");
  eq(e.buffer.lineCount(), 2);
});

check("editor respects tabSize option", () => {
  const e = new LimnEditor({ tabSize: 2 });
  e.handleTab(false);
  eq(e.getValue(), "  ");
});

group("setValue / getValue");

check("setValue replaces content", () => {
  const e = new LimnEditor({ value: "old" });
  e.setValue("new\ncontent");
  eq(e.getValue(), "new\ncontent");
  eq(e.buffer.lineCount(), 2);
});

check("setValue resets cursor", () => {
  const e = new LimnEditor({ value: "abc" });
  e.setCursor(0, 3);
  e.setValue("xyz");
  eq(e.getCursor().line, 0);
  eq(e.getCursor().col, 0);
});

check("setValue clears undo history", () => {
  const e = new LimnEditor({ value: "abc" });
  e.insert("X");
  assert(e.history.canUndo());
  e.setValue("abc");
  assert(!e.history.canUndo());
});

group("onChange callback");

check("onChange fires after insert", () => {
  let captured = null;
  const e = new LimnEditor({ onChange: (v) => { captured = v; } });
  e.insert("hi");
  eq(captured, "hi");
});

check("onChange fires after setValue", () => {
  let captured = null;
  const e = new LimnEditor({ onChange: (v) => { captured = v; } });
  e.setValue("x");
  eq(captured, "x");
});

group("onCursor callback");

check("onCursor fires after insert", () => {
  let captured = null;
  const e = new LimnEditor({ onCursor: (c) => { captured = c; } });
  e.insert("hi");
  eq(captured.line, 0);
  eq(captured.col, 2);
});

group("insert / newline / backspace / delete");

check("insert text at start", () => {
  const e = new LimnEditor({ value: "world" });
  e.insert("hello ");
  eq(e.getValue(), "hello world");
  eq(e.getCursor().col, 6);
});

check("newline splits line", () => {
  const e = new LimnEditor({ value: "abcdef" });
  e.setCursor(0, 3);
  e.newline();
  eq(e.getValue(), "abc\ndef");
});

check("backspace at end removes char", () => {
  const e = new LimnEditor({ value: "hello" });
  e.setCursor(0, 5);
  e.backspace();
  eq(e.getValue(), "hell");
});

check("delete removes char under cursor", () => {
  const e = new LimnEditor({ value: "hello" });
  e.setCursor(0, 1);
  e.delete();
  eq(e.getValue(), "hllo");
});

group("cursor movement");

check("moveLeft decrements col", () => {
  const e = new LimnEditor({ value: "abc" });
  e.setCursor(0, 2);
  e.moveLeft(false);
  eq(e.getCursor().col, 1);
});

check("moveRight increments col", () => {
  const e = new LimnEditor({ value: "abc" });
  e.setCursor(0, 0);
  e.moveRight(false);
  eq(e.getCursor().col, 1);
});

check("moveUp clamps col", () => {
  const e = new LimnEditor({ value: "ab\nabcdef" });
  e.setCursor(1, 5);
  e.moveUp(false);
  eq(e.getCursor().line, 0);
  eq(e.getCursor().col, 2);
});

check("moveDown preserves col", () => {
  const e = new LimnEditor({ value: "ab\nabcdef" });
  e.setCursor(0, 1);
  e.moveDown(false);
  eq(e.getCursor().line, 1);
  eq(e.getCursor().col, 1);
});

check("moveHome goes to first non-whitespace", () => {
  const e = new LimnEditor({ value: "    hello" });
  e.setCursor(0, 9);
  e.moveHome(false);
  eq(e.getCursor().col, 4);
});

check("moveEnd goes to line end", () => {
  const e = new LimnEditor({ value: "hello" });
  e.setCursor(0, 0);
  e.moveEnd(false);
  eq(e.getCursor().col, 5);
});

check("moveDocStart goes to 0,0", () => {
  const e = new LimnEditor({ value: "a\nb\nc" });
  e.setCursor(2, 1);
  e.moveDocStart(false);
  eq(e.getCursor().line, 0);
  eq(e.getCursor().col, 0);
});

check("moveDocEnd goes to last char", () => {
  const e = new LimnEditor({ value: "a\nb\ncde" });
  e.moveDocEnd(false);
  eq(e.getCursor().line, 2);
  eq(e.getCursor().col, 3);
});

group("selection");

check("selectAll selects whole document", () => {
  const e = new LimnEditor({ value: "abc\ndef" });
  e.selectAll();
  const sel = e.getSelection();
  eq(sel.length, 1);
  eq(sel[0].start, { line: 0, col: 0 });
  eq(sel[0].end, { line: 1, col: 3 });
  assert(sel[0].hasSelection);
});

check("clickAt places cursor", () => {
  const e = new LimnEditor({ value: "hello\nworld", width: 800, height: 600 });
  const gw = e.renderer.gutterWidth;
  const pt = e.renderer.padTop;
  e.clickAt(gw + 16, pt + 1, false);
  const cur = e.getCursor();
  eq(cur.line, 0);
  eq(cur.col, 0);
});

check("dragTo extends selection", () => {
  const e = new LimnEditor({ value: "hello world", width: 800, height: 600 });
  const gw = e.renderer.gutterWidth;
  const pt = e.renderer.padTop;
  const cw = e.renderer.charWidth;
  e.clickAt(gw + 16, pt + 1, false);
  e.dragTo(gw + 16 + 5 * cw, pt + 1);
  const sel = e.getSelection();
  assert(sel[0].hasSelection);
  eq(sel[0].start.col, 0);
  eq(sel[0].end.col, 5);
});

group("undo / redo");

check("undo reverts insert", () => {
  const e = new LimnEditor({ value: "abc" });
  e.insert("X");
  eq(e.getValue(), "Xabc");
  e.undo();
  eq(e.getValue(), "abc");
});

check("redo re-applies insert", () => {
  const e = new LimnEditor({ value: "abc" });
  e.insert("X");
  e.undo();
  e.redo();
  eq(e.getValue(), "Xabc");
});

check("multi-caret insert is one undo", () => {
  const e = new LimnEditor({ value: "ac" });
  e.setCursor(0, 1);
  e.addCaretAt(0, 2);
  e.insert("X");
  eq(e.getValue(), "aXcX");
  e.undo();
  eq(e.getValue(), "ac");
});

group("tab / auto-pairs");

check("tab inserts spaces", () => {
  const e = new LimnEditor({ value: "a", tabSize: 4 });
  e.handleTab(false);
  eq(e.getValue(), "    a");
});

check("typing open paren auto-inserts close", () => {
  const e = new LimnEditor({ value: "" });
  const handled = e.tryAutoPair("(");
  eq(handled, true);
  eq(e.getValue(), "()");
  eq(e.getCursor().col, 1);
});

check("typing close paren skips over existing", () => {
  const e = new LimnEditor({ value: "()" });
  e.setCursor(0, 1);
  e.tryAutoPair(")");
  eq(e.getValue(), "()");
  eq(e.getCursor().col, 2);
});

group("comment toggle");

check("toggleComment adds // to current line", () => {
  const e = new LimnEditor({ value: "hello" });
  e.toggleComment();
  eq(e.getValue(), "// hello");
});

check("toggleComment removes when all commented", () => {
  const e = new LimnEditor({ value: "// hello" });
  e.toggleComment();
  eq(e.getValue(), "hello");
});

group("scrolling");

check("setScroll clamps negative to zero", () => {
  const e = new LimnEditor({ value: "a\nb\nc", width: 800, height: 200 });
  e.setScroll(-100, -100);
  const s = e.getScroll();
  eq(s.top, 0);
  eq(s.left, 0);
});

check("ensureCursorVisible scrolls when cursor below view", () => {
  const lines = [];
  for (let i = 0; i < 100; i++) lines.push("line " + i);
  const e = new LimnEditor({ value: lines.join("\n"), width: 800, height: 200 });
  e.setCursor(50, 0);
  e._ensureCursorVisible();
  assert(e.getScroll().top > 0);
});

group("getLayout");

check("layout reports line height", () => {
  const e = new LimnEditor();
  const layout = e.getLayout();
  assert(layout.lineHeight > 0);
  assert(layout.gutterWidth > 0);
});

group("render with mock context");

class MockContext {
  constructor(w, h) {
    this.canvas = { width: w, height: h };
    this._fill = "";
    this._font = "";
  }
  get fillStyle() { return this._fill; }
  set fillStyle(v) { this._fill = v; }
  get font() { return this._font; }
  set font(v) { this._font = v; }
  get textAlign() { return ""; }
  set textAlign(v) {}
  get textBaseline() { return ""; }
  set textBaseline(v) {}
  save() {}
  restore() {}
  fillRect() {}
  fillText() {}
  measureText(t) { return { width: t.length * 8 }; }
}

check("render draws without error", () => {
  const e = new LimnEditor({ value: "const x = 1;", width: 800, height: 600 });
  const ctx = new MockContext(800, 600);
  e.render(ctx);
  assert(true);
});

check("render clears dirty flag", () => {
  const e = new LimnEditor({ value: "abc", width: 800, height: 600 });
  e.invalidate();
  const ctx = new MockContext(800, 600);
  e.render(ctx);
  eq(e.needsRender(), false);
});

group("change callback chain");

check("multiple inserts fire multiple onChange", () => {
  let count = 0;
  const e = new LimnEditor({ onChange: () => { count++; } });
  e.insert("a");
  e.insert("b");
  e.insert("c");
  eq(count, 3);
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
  `${passed} passed, ${failed} failed</span>`
);