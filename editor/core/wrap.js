export function computeWrap(text, wrapCols) {
  if (wrapCols <= 0 || text.length <= wrapCols) {
    return [0];
  }
  const breakPoints = [0];
  let i = 0;
  const n = text.length;
  while (i < n) {
    let next = Math.min(i + wrapCols, n);
    if (next < n) {
      let soft = -1;
      for (let k = next; k > i; k--) {
        const c = text[k];
        if (c === " " || c === "\t") {
          soft = k;
          break;
        }
      }
      if (soft > i) {
        next = soft + 1;
      }
    }
    breakPoints.push(next);
    i = next;
  }
  return breakPoints;
}

export function wrapRowsForText(text, wrapCols) {
  const breaks = computeWrap(text, wrapCols);
  return breaks.length - 1 + (text.length <= wrapCols ? 1 : 0);
}

export function colToRowCol(breaks, col) {
  let row = 0;
  for (let i = 0; i < breaks.length - 1; i++) {
    if (col < breaks[i + 1]) {
      return { row: i, colInRow: col - breaks[i] };
    }
    row = i + 1;
  }
  return { row: breaks.length - 2, colInRow: col - breaks[breaks.length - 2] };
}

export function rowColToCol(breaks, row, colInRow) {
  const start = breaks[row] || 0;
  const next = breaks[row + 1];
  const maxCol = next !== undefined ? next - start : colInRow;
  return start + Math.min(colInRow, maxCol);
}

export function wrapAllLines(lines, wrapCols) {
  const result = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text.length <= wrapCols) {
      result[i] = { breaks: null, rows: 1 };
    } else {
      const breaks = computeWrap(text, wrapCols);
      result[i] = { breaks, rows: breaks.length - 1 };
    }
  }
  return result;
}

export function buildRowIndex(lines, wrapCols) {
  const lineInfo = wrapAllLines(lines, wrapCols);
  const lineToFirstRow = new Uint32Array(lines.length);
  const lineToRows = new Uint16Array(lines.length);
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    lineToFirstRow[i] = total;
    lineToRows[i] = lineInfo[i].rows;
    total += lineInfo[i].rows;
  }
  return { lineInfo, lineToFirstRow, lineToRows, totalRows: total };
}

export function findLineAtRow(lineToFirstRow, lineToRows, row) {
  let lo = 0;
  let hi = lineToFirstRow.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (lineToFirstRow[mid] <= row) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}