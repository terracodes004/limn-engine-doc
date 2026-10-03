import { METRICS_DEFAULT } from "./coordinates.js";
import { buildRowIndex, findLineAtRow, colToRowCol, rowColToCol } from "./wrap.js";

export class Viewport {
  constructor(metrics) {
    this.metrics = Object.assign({}, METRICS_DEFAULT, metrics || {});
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.width = 0;
    this.height = 0;
    this.totalLines = 0;
    this.maxLineLength = 0;
    this.visibleFirstRow = 0;
    this.visibleLastRow = 0;
    this.visibleFirstLine = 0;
    this.visibleLastLine = 0;
    this.wordWrap = true;
    this.folding = null;
    this._dirty = true;
    this._cache = null;
    this._cacheKey = null;
  }
  
  setSize(width, height) {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this._dirty = true;
  }
  
  setContentSize(totalLines, maxLineLength) {
    this.totalLines = Math.max(1, totalLines);
    this.maxLineLength = Math.max(0, maxLineLength);
    this._dirty = true;
  }
  
  setScroll(top, left) {
    const maxTop = Math.max(0, this.contentHeight() - this.height);
    const newTop = Math.max(0, Math.min(top, maxTop));
    const newLeft = 0;
    if (newTop === this.scrollTop && newLeft === this.scrollLeft) return false;
    this.scrollTop = newTop;
    this.scrollLeft = newLeft;
    this._dirty = true;
    return true;
  }
  
  scrollBy(dx, dy) {
    return this.setScroll(this.scrollTop + dy, 0);
  }
  
  getWrapCols() {
    if (!this.wordWrap) return 100000;
    const usable = this.width - this.metrics.padLeft;
    if (usable <= 0) return 1;
    return Math.max(10, Math.floor(usable / this.metrics.charWidth) - 1);
  }
  
  _hasFolds() {
    return this.folding && this.folding.collapsed && this.folding.collapsed.size > 0;
  }
  
  _isHidden(line) {
    if (!this._hasFolds()) return false;
    return this.folding.isHiddenByFold(line);
  }
  
  _buildFoldedRowIndex(lines) {
    const wrapCols = this.getWrapCols();
    const base = buildRowIndex(lines, wrapCols);
    const lineCount = lines.length;
    const lineToFirstRow = new Uint32Array(lineCount);
    const lineToRows = new Uint16Array(lineCount);
    let total = 0;
    for (let i = 0; i < lineCount; i++) {
      if (this._isHidden(i)) {
        lineToFirstRow[i] = total;
        lineToRows[i] = 0;
        continue;
      }
      lineToFirstRow[i] = total;
      lineToRows[i] = base.lineToRows[i];
      total += base.lineToRows[i];
    }
    return {
      lineInfo: base.lineInfo,
      lineToFirstRow: lineToFirstRow,
      lineToRows: lineToRows,
      totalRows: total,
    };
  }
  
  _ensureCache(lines) {
    const wrapCols = this.getWrapCols();
    const foldKey = this._hasFolds() ? Array.from(this.folding.collapsed).sort((a, b) => a - b).join(",") : "";
    const key = lines.length + ":" + wrapCols + ":" + (this.wordWrap ? "w" : "n") + ":" + foldKey;
    if (this._cache && this._cacheKey === key) {
      return this._cache;
    }
    let cache;
    if (this._hasFolds()) {
      cache = this._buildFoldedRowIndex(lines);
    } else {
      cache = buildRowIndex(lines, wrapCols);
    }
    this._cache = cache;
    this._cacheKey = key;
    return cache;
  }
  
  computeVisible(lines) {
    const cache = this._ensureCache(lines);
    const lh = this.metrics.lineHeight;
    const padTop = this.metrics.padTop;
    
    let firstRow = Math.floor((this.scrollTop - padTop) / lh) - 2;
    if (firstRow < 0) firstRow = 0;
    
    const visibleCount = Math.ceil(this.height / lh) + 4;
    let lastRow = firstRow + visibleCount;
    if (lastRow > cache.totalRows - 1) lastRow = cache.totalRows - 1;
    if (lastRow < 0) lastRow = 0;
    
    let firstLine;
    let lastLine;
    if (this._hasFolds()) {
      firstLine = this._findLineAtRow(cache, firstRow, true);
      lastLine = this._findLineAtRow(cache, lastRow, false);
    } else {
      firstLine = findLineAtRow(cache.lineToFirstRow, cache.lineToRows, firstRow);
      lastLine = findLineAtRow(cache.lineToFirstRow, cache.lineToRows, lastRow);
    }
    
    this.visibleFirstRow = firstRow;
    this.visibleLastRow = lastRow;
    this.visibleFirstLine = firstLine;
    this.visibleLastLine = lastLine;
    this._dirty = false;
    
    return { first: firstLine, last: lastLine, firstRow, lastRow, cache };
  }
  
  _findLineAtRow(cache, row, isFirst) {
    const n = cache.lineToFirstRow.length;
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (cache.lineToRows[i] === 0) continue;
      const start = cache.lineToFirstRow[i];
      const rows = cache.lineToRows[i];
      if (start <= row && row < start + rows) {
        if (isFirst) return i;
        best = i;
      }
    }
    if (best !== -1) return best;
    for (let i = n - 1; i >= 0; i--) {
      if (cache.lineToRows[i] !== 0) return i;
    }
    return 0;
  }
  
  lineToY(line, cache) {
    if (!cache) cache = this._cache;
    if (!cache) return this.metrics.padTop - this.scrollTop;
    if (this._isHidden(line)) {
      let visible = line;
      while (visible >= 0 && this._isHidden(visible)) visible--;
      if (visible < 0) return this.metrics.padTop - this.scrollTop;
      const firstRow = cache.lineToFirstRow[visible] || 0;
      return this.metrics.padTop + firstRow * this.metrics.lineHeight - this.scrollTop;
    }
    const firstRow = cache.lineToFirstRow[line] || 0;
    return this.metrics.padTop + firstRow * this.metrics.lineHeight - this.scrollTop;
  }
  
  rowToY(row) {
    return this.metrics.padTop + row * this.metrics.lineHeight - this.scrollTop;
  }
  
  colToX(col) {
    return this.metrics.padLeft + col * this.metrics.charWidth - this.scrollLeft;
  }
  
  pixelToLocal(x, y) {
    return {
      x: x + this.scrollLeft,
      y: y + this.scrollTop,
    };
  }
  
  ensureLineVisible(line, cache) {
    if (!cache) cache = this._cache;
    if (!cache) return false;
    if (this._isHidden(line)) {
      let visible = line;
      while (visible >= 0 && this._isHidden(visible)) visible--;
      if (visible < 0) visible = line;
      line = visible;
    }
    const lh = this.metrics.lineHeight;
    const padTop = this.metrics.padTop;
    const rowStart = cache.lineToFirstRow[line] || 0;
    const rowCount = cache.lineToRows[line] || 1;
    const top = rowStart * lh + padTop;
    const bottom = top + rowCount * lh;
    const viewTop = this.scrollTop;
    const viewBottom = viewTop + this.height;
    const margin = lh * 2;
    
    if (top < viewTop + margin) {
      return this.setScroll(top - margin, 0);
    }
    if (bottom > viewBottom - margin) {
      return this.setScroll(bottom - this.height + margin, 0);
    }
    return false;
  }
  
  ensureColVisible(col) {
    return false;
  }
  
  ensurePositionVisible(line, col, cache) {
    return this.ensureLineVisible(line, cache);
  }
  
  scrollToLine(line) {
    const cache = this._cache;
    if (!cache) return false;
    if (this._isHidden(line)) {
      let visible = line;
      while (visible >= 0 && this._isHidden(visible)) visible--;
      if (visible < 0) visible = line;
      line = visible;
    }
    const row = cache.lineToFirstRow[line] || 0;
    return this.setScroll(row * this.metrics.lineHeight, 0);
  }
  
  scrollToLineCentered(line) {
    const cache = this._cache;
    if (!cache) return false;
    if (this._isHidden(line)) {
      let visible = line;
      while (visible >= 0 && this._isHidden(visible)) visible--;
      if (visible < 0) visible = line;
      line = visible;
    }
    const row = cache.lineToFirstRow[line] || 0;
    const target = row * this.metrics.lineHeight - this.height / 2;
    return this.setScroll(target, 0);
  }
  
  contentHeight() {
    const cache = this._cache;
    const rows = cache ? cache.totalRows : this.totalLines;
    return rows * this.metrics.lineHeight + this.metrics.padTop * 2;
  }
  
  contentWidth() {
    return this.width;
  }
  
  invalidate() {
    this._dirty = true;
    this._cache = null;
    this._cacheKey = null;
  }
}