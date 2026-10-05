import {
  computeWrap,
  colToRowCol,
  rowColToCol,
  buildRowIndex,
  findLineAtRow,
} from "./wrap.js";

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

group("computeWrap");

check("short text has one row", () => {
  eq(computeWrap("hello", 10), [0]);
});

check("text at width exactly", () => {
  eq(computeWrap("0123456789", 10), [0]);
});

check("text one over width breaks", () => {
  const breaks = computeWrap("01234567890", 10);
  assert(breaks.length >= 2);
  eq(breaks[0], 0);
});

check("long text breaks multiple times", () => {
  const breaks = computeWrap("aaaaaaaaaaaaaaaaaaaaaaaaaaaa", 10);
  assert(breaks.length >= 4);
});

check("break prefers space", () => {
  const breaks = computeWrap("hello world foo", 8);
  assert(breaks[1] <= 8);
  assert(breaks[1] > 0);
});

group("colToRowCol");

check("column 0 is row 0 col 0", () => {
  eq(colToRowCol([0, 5, 10], 0), { row: 0, colInRow: 0 });
});

check("column in first row", () => {
  eq(colToRowCol([0, 5, 10], 3), { row: 0, colInRow: 3 });
});

check("column in second row", () => {
  eq(colToRowCol([0, 5, 10], 7), { row: 1, colInRow: 2 });
});

group("rowColToCol");

check("row 0 col 0 is column 0", () => {
  eq(rowColToCol([0, 5, 10], 0, 0), 0);
});

check("row 1 col 2 is column 7", () => {
  eq(rowColToCol([0, 5, 10], 1, 2), 7);
});

check("clamps colInRow to row width", () => {
  eq(rowColToCol([0, 5, 10], 0, 100), 5);
});

group("buildRowIndex");

check("short lines occupy one row each", () => {
  const idx = buildRowIndex(["a", "b", "c"], 10);
  eq(idx.totalRows, 3);
  eq(Array.from(idx.lineToFirstRow), [0, 1, 2]);
  eq(Array.from(idx.lineToRows), [1, 1, 1]);
});

check("long line takes multiple rows", () => {
  const idx = buildRowIndex(["short", "aaaaaaaaaaaaaaaaaaaa"], 10);
  assert(idx.totalRows > 2);
  eq(idx.lineToFirstRow[0], 0);
  assert(idx.lineToFirstRow[1] >= 1);
  assert(idx.lineToRows[1] >= 2);
});

group("findLineAtRow");

check("row 0 is line 0", () => {
  const idx = buildRowIndex(["a", "b", "c"], 10);
  eq(findLineAtRow(idx.lineToFirstRow, idx.lineToRows, 0), 0);
});

check("row 2 is line 2", () => {
  const idx = buildRowIndex(["a", "b", "c"], 10);
  eq(findLineAtRow(idx.lineToFirstRow, idx.lineToRows, 2), 2);
});

check("row in wrapped line returns that line", () => {
  const idx = buildRowIndex(["short", "aaaaaaaaaaaaaaaaaaaaaa"], 10);
  const row = idx.lineToFirstRow[1] + 1;
  eq(findLineAtRow(idx.lineToFirstRow, idx.lineToRows, row), 1);
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
  `${passed} passed, ${failed} failed</span>`
);