import { TextBuffer } from "./buffer.js";
import { EditorChange, applyChanges } from "./transaction.js";
import { History } from "./history.js";

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

function doInsert(buffer, history, line, col, text, before, after, label) {
  const change = EditorChange.insert(line, col, text);
  history.record(buffer, change, before, after, label || "insert");
  if (history._batchDepth === 0) {
    applyChanges(buffer, [change]);
  }
  return change;
}

function doRemove(buffer, history, fromLine, fromCol, toLine, toCol, before, after, label) {
  const change = EditorChange.remove(fromLine, fromCol, toLine, toCol);
  history.record(buffer, change, before, after, label || "delete");
  if (history._batchDepth === 0) {
    applyChanges(buffer, [change]);
  }
  return change;
}

group("construction");

check("new history has nothing to undo or redo", () => {
  const h = new History();
  assert(!h.canUndo());
  assert(!h.canRedo());
});

group("record and undo — single insert");

check("record one insert, undo restores original", () => {
  const b = new TextBuffer("hello");
  const h = new History();
  doInsert(b, h, 0, 5, " world", { line: 0, col: 5 }, { line: 0, col: 11 });
  eq(b.getText(), "hello world");
  assert(h.canUndo());
  const result = h.undo(b);
  eq(b.getText(), "hello");
  assert(result);
  eq(result.selection, { line: 0, col: 5 });
});

check("undo then redo restores the edit", () => {
  const b = new TextBuffer("hello");
  const h = new History();
  doInsert(b, h, 0, 5, " world", { line: 0, col: 5 }, { line: 0, col: 11 });
  h.undo(b);
  eq(b.getText(), "hello");
  assert(h.canRedo());
  h.redo(b);
  eq(b.getText(), "hello world");
});

group("record and undo — single remove");

check("record one remove, undo restores deleted text", () => {
  const b = new TextBuffer("hello world");
  const h = new History();
  doRemove(b, h, 0, 5, 0, 11, { line: 0, col: 5 }, { line: 0, col: 5 });
  eq(b.getText(), "hello");
  h.undo(b);
  eq(b.getText(), "hello world");
});

check("remove across lines round-trips", () => {
  const b = new TextBuffer("abc\ndef");
  const h = new History();
  doRemove(b, h, 0, 1, 1, 2, { line: 0, col: 1 }, { line: 0, col: 1 });
  eq(b.getText(), "af");
  h.undo(b);
  eq(b.getText(), "abc\ndef");
});

group("multiple edits");

check("two edits, two undos, restores original", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  doInsert(b, h, 0, 0, "X", { line: 0, col: 0 }, { line: 0, col: 1 });
  doInsert(b, h, 0, 4, "Y", { line: 0, col: 4 }, { line: 0, col: 5 });
  eq(b.getText(), "XabcY");
  h.undo(b);
  eq(b.getText(), "Xabc");
  h.undo(b);
  eq(b.getText(), "abc");
  assert(!h.canUndo());
});

check("undo, redo, undo again works", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  doInsert(b, h, 0, 3, "X", { line: 0, col: 3 }, { line: 0, col: 4 });
  doInsert(b, h, 0, 4, "Y", { line: 0, col: 4 }, { line: 0, col: 5 });
  eq(b.getText(), "abcXY");
  h.undo(b);
  eq(b.getText(), "abcX");
  h.redo(b);
  eq(b.getText(), "abcXY");
  h.undo(b);
  eq(b.getText(), "abcX");
});

check("new edit after undo clears redo stack", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  doInsert(b, h, 0, 3, "X", { line: 0, col: 3 }, { line: 0, col: 4 });
  h.undo(b);
  assert(h.canRedo());
  doInsert(b, h, 0, 0, "Z", { line: 0, col: 0 }, { line: 0, col: 1 });
  assert(!h.canRedo());
});

group("undo empty history");

check("undo on empty history returns null", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  const result = h.undo(b);
  eq(result, null);
});

check("redo on empty history returns null", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  const result = h.redo(b);
  eq(result, null);
});

group("max entries");

check("history discards oldest when over max", () => {
  const b = new TextBuffer("");
  const h = new History(3);
  for (let i = 0; i < 5; i++) {
    doInsert(b, h, 0, i, String(i), { line: 0, col: i }, { line: 0, col: i + 1 }, "insert-" + i);
  }
  eq(b.getText(), "01234");
  eq(h.undoStack.length, 3);
  h.undo(b);
  h.undo(b);
  h.undo(b);
  assert(!h.canUndo());
  eq(b.getText(), "01");
});

group("clear");

check("clear empties both stacks", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  doInsert(b, h, 0, 3, "X", { line: 0, col: 3 }, { line: 0, col: 4 });
  assert(h.canUndo());
  h.clear();
  assert(!h.canUndo());
  assert(!h.canRedo());
});

group("batch");

check("beginBatch + endBatch treats multiple changes as one undo", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  h.beginBatch();
  doInsert(b, h, 0, 0, "X", { line: 0, col: 0 }, { line: 0, col: 1 });
  doInsert(b, h, 0, 3, "Y", { line: 0, col: 3 }, { line: 0, col: 4 });
  h.endBatch(b, { line: 0, col: 0 }, { line: 0, col: 4 }, "batch");
  eq(b.getText(), "XabcY");
  h.undo(b);
  eq(b.getText(), "abc");
  assert(!h.canUndo());
});

check("nested batch calls count once", () => {
  const b = new TextBuffer("abc");
  const h = new History();
  h.beginBatch();
  h.beginBatch();
  doInsert(b, h, 0, 0, "X", { line: 0, col: 0 }, { line: 0, col: 1 });
  h.endBatch(b, { line: 0, col: 0 }, { line: 0, col: 1 }, "inner");
  h.endBatch(b, { line: 0, col: 0 }, { line: 0, col: 1 }, "outer");
  h.undo(b);
  eq(b.getText(), "abc");
});

group("fuzz");

check("200 random ops undo to original", () => {
  const original = "the quick brown fox";
  const b = new TextBuffer(original);
  const h = new History();
  for (let i = 0; i < 200; i++) {
    const line = Math.floor(Math.random() * b.lineCount());
    const len = b.lineLength(line);
    if (Math.random() < 0.6) {
      const col = Math.floor(Math.random() * (len + 1));
      const text = Math.random() < 0.2 ? "\n" : "x";
      doInsert(b, h, line, col, text, { line, col }, { line, col: col + text.length }, "insert-" + i);
    } else if (len > 0) {
      const from = Math.floor(Math.random() * len);
      const to = from + Math.floor(Math.random() * (len - from + 1));
      if (to > from) {
        doRemove(b, h, line, from, line, to, { line, col: from }, { line, col: from }, "delete-" + i);
      }
    }
  }
  while (h.canUndo()) h.undo(b);
  eq(b.getText(), original);
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
  `${passed} passed, ${failed} failed</span>`
);