export const METRICS_DEFAULT = Object.freeze({
  lineHeight: 22,
  charWidth: 7.8,
  padTop: 8,
  padLeft: 56,
});

export function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  starts.push(text.length + 1);
  const out = new Uint32Array(starts.length);
  for (let i = 0; i < starts.length; i++) out[i] = starts[i];
  return out;
}

export function rebuildLineStarts(lines) {
  const lineCount = lines.length;
  const starts = new Uint32Array(lineCount + 1);
  let offset = 0;
  for (let i = 0; i < lineCount; i++) {
    starts[i] = offset;
    offset += lines[i].length + 1;
  }
  starts[lineCount] = offset;
  return starts;
}

export function offsetToLineCol(lineStarts, offset) {
  const n = lineStarts.length - 1;
  if (n <= 0) return { line: 0, col: 0 };
  if (offset < 0) offset = 0;
  const limit = lineStarts[n] - 1;
  if (offset > limit) offset = limit;

  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, col: offset - lineStarts[lo] };
}

export function lineColToOffset(lineStarts, line, col) {
  const n = lineStarts.length - 1;
  if (line < 0) line = 0;
  if (line >= n) line = n - 1;
  if (col < 0) col = 0;
  const lineStart = lineStarts[line];
  const nextLineStart = lineStarts[line + 1];
  const lineLen = nextLineStart - lineStart - 1;
  if (col > lineLen) col = lineLen;
  return lineStart + col;
}

export function lineColToPixel(line, col, metrics = METRICS_DEFAULT) {
  return {
    x: metrics.padLeft + col * metrics.charWidth,
    y: metrics.padTop + line * metrics.lineHeight,
  };
}

export function pixelToLineCol(x, y, lineStarts, lines, metrics = METRICS_DEFAULT) {
  const rawLine = Math.floor((y - metrics.padTop) / metrics.lineHeight);
  const lineCount = lineStarts.length - 1;
  let line = rawLine;
  if (line < 0) line = 0;
  if (line >= lineCount) line = lineCount - 1;

  const lineLen = lines[line].length;
  const rawCol = Math.round((x - metrics.padLeft) / metrics.charWidth);
  let col = rawCol;
  if (col < 0) col = 0;
  if (col > lineLen) col = lineLen;

  return { line, col };
}

export function clampOffset(offset, totalLength) {
  if (offset < 0) return 0;
  if (offset > totalLength) return totalLength;
  return offset;
}

export function normalizeOffsets(a, b, lineStarts) {
  let aOff, bOff;
  if (typeof a === "number") aOff = a;
  else aOff = lineColToOffset(lineStarts, a.line, a.col);
  if (typeof b === "number") bOff = b;
  else bOff = lineColToOffset(lineStarts, b.line, b.col);
  return aOff <= bOff ? { start: aOff, end: bOff } : { start: bOff, end: aOff };
}

export function normalizeLineCols(a, b) {
  const aBeforeB = a.line < b.line || (a.line === b.line && a.col <= b.col);
  return aBeforeB
    ? { start: { ...a }, end: { ...b } }
    : { start: { ...b }, end: { ...a } };
}

export function compareLineCol(a, b) {
  if (a.line !== b.line) return a.line < b.line ? -1 : 1;
  if (a.col !== b.col) return a.col < b.col ? -1 : 1;
  return 0;
}

export function lineColEquals(a, b) {
  return a.line === b.line && a.col === b.col;
}