export class Folding {
  constructor() {
    this.collapsed = new Set();
    this.ranges = [];
    this._cacheVersion = -1;
    this._cacheLines = null;
  }

  reset() {
    this.collapsed.clear();
    this.ranges = [];
    this._cacheVersion = -1;
    this._cacheLines = null;
  }

  computeRanges(buffer) {
    const version = buffer._version;
    const lineCount = buffer.lineCount();
    if (this._cacheVersion === version && this._cacheLines === buffer.lines && this.ranges.length > 0) {
      return this.ranges;
    }
    const ranges = [];
    for (let i = 0; i < lineCount; i++) {
      const text = buffer.getLine(i);
      const end = findFoldEnd(buffer, i, text);
      if (end > i) {
        ranges.push({ startLine: i, endLine: end });
      }
    }
    this.ranges = ranges;
    this._cacheVersion = version;
    this._cacheLines = buffer.lines;
    return ranges;
  }

  isCollapsed(line) {
    return this.collapsed.has(line);
  }

  toggle(line, buffer) {
    const ranges = this.computeRanges(buffer);
    const range = ranges.find((r) => r.startLine === line);
    if (!range) return false;
    if (this.collapsed.has(line)) {
      this.collapsed.delete(line);
    } else {
      this.collapsed.add(line);
    }
    return true;
  }

  collapseAll(buffer) {
    const ranges = this.computeRanges(buffer);
    for (const r of ranges) this.collapsed.add(r.startLine);
    return ranges.length;
  }

  unfoldAll() {
    const n = this.collapsed.size;
    this.collapsed.clear();
    return n;
  }

  expandContaining(line, buffer) {
    const ranges = this.computeRanges(buffer);
    let changed = false;
    for (const r of ranges) {
      if (r.startLine < line && line <= r.endLine && this.collapsed.has(r.startLine)) {
        this.collapsed.delete(r.startLine);
        changed = true;
      }
    }
    return changed;
  }

  isFoldedLine(line) {
    return this.collapsed.has(line);
  }

  isHiddenByFold(line) {
    for (const start of this.collapsed) {
      const range = this.ranges.find((r) => r.startLine === start);
      if (!range) continue;
      if (line > range.startLine && line <= range.endLine) return true;
    }
    return false;
  }

  getFoldableAt(line, buffer) {
    const ranges = this.computeRanges(buffer);
    for (const r of ranges) {
      if (r.startLine === line) return r;
    }
    return null;
  }
}

function findFoldEnd(buffer, startLine, lineText) {
  const trimmed = lineText.replace(/\s+$/, "");
  const braceIdx = firstBraceOnLine(trimmed);
  if (braceIdx === -1) return -1;
  const openChar = trimmed[braceIdx];
  const closeChar = openChar === "{" ? "}" : openChar === "[" ? "]" : ")";
  let depth = 0;
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  const lineCount = buffer.lineCount();

  for (let li = startLine; li < lineCount; li++) {
    const text = buffer.getLine(li);
    const startCol = li === startLine ? braceIdx : 0;
    inLineComment = false;
    for (let ci = startCol; ci < text.length; ci++) {
      const c = text[ci];
      const next = text[ci + 1];

      if (inLineComment) break;
      if (inBlockComment) {
        if (c === "*" && next === "/") { inBlockComment = false; ci++; }
        continue;
      }
      if (inStr) {
        if (c === "\\") { ci++; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === "/" && next === "/") { inLineComment = true; break; }
      if (c === "/" && next === "*") { inBlockComment = true; ci++; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === openChar) depth++;
      else if (c === closeChar) {
        depth--;
        if (depth === 0) {
          if (li > startLine) return li;
          return -1;
        }
      }
    }
  }
  return -1;
}

function firstBraceOnLine(trimmed) {
  let inStr = null;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{" || c === "[") return i;
  }
  return -1;
}

export function visibleLineToActual(viewport, line, folding) {
  if (!folding || folding.collapsed.size === 0) return line;
  return line;
}