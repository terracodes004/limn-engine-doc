import { compareLineCol, lineColEquals } from "./coordinates.js";

export class Caret {
  constructor(line = 0, col = 0) {
    this.line = line;
    this.col = col;
    this.anchor = null;
  }
  
  static at(line, col) {
    return new Caret(line, col);
  }
  
  clone() {
    const c = new Caret(this.line, this.col);
    if (this.anchor) c.anchor = { line: this.anchor.line, col: this.anchor.col };
    return c;
  }
  
  equals(other) {
    if (!lineColEquals(this, other)) return false;
    if (!this.anchor && !other.anchor) return true;
    if (!this.anchor || !other.anchor) return false;
    return this.anchor.line === other.anchor.line && this.anchor.col === other.anchor.col;
  }
  
  isEmpty() {
    return this.anchor === null;
  }
  
  hasSelection() {
    if (!this.anchor) return false;
    return this.anchor.line !== this.line || this.anchor.col !== this.col;
  }
  
  start() {
    if (!this.anchor) return { line: this.line, col: this.col };
    const cmp = compareLineCol(this.anchor, { line: this.line, col: this.col });
    return cmp <= 0 ?
      { line: this.anchor.line, col: this.anchor.col } :
      { line: this.line, col: this.col };
  }
  
  end() {
    if (!this.anchor) return { line: this.line, col: this.col };
    const cmp = compareLineCol(this.anchor, { line: this.line, col: this.col });
    return cmp <= 0 ?
      { line: this.line, col: this.col } :
      { line: this.anchor.line, col: this.anchor.col };
  }
  
  setPosition(line, col) {
    this.line = line;
    this.col = col;
  }
  
  setAnchor(line, col) {
    this.anchor = { line, col };
  }
  
  clearAnchor() {
    this.anchor = null;
  }
  
  collapseToStart() {
    const s = this.start();
    this.line = s.line;
    this.col = s.col;
    this.anchor = null;
  }
  
  collapseToEnd() {
    const e = this.end();
    this.line = e.line;
    this.col = e.col;
    this.anchor = null;
  }
  
  cloneCollapsedAt(line, col) {
    return new Caret(line, col);
  }
  
  collapseTo(line, col) {
    this.line = line;
    this.col = col;
    this.anchor = null;
  }
}

export function caretsOverlap(a, b) {
  if (!a.hasSelection() && !b.hasSelection()) {
    return lineColEquals(a, b);
  }
  const aStart = a.start();
  const aEnd = a.end();
  const bStart = b.start();
  const bEnd = b.end();
  if (compareLineCol(aEnd, bStart) < 0) return false;
  if (compareLineCol(bEnd, aStart) < 0) return false;
  return true;
}

export function mergeOverlappingCarets(carets) {
  if (carets.length <= 1) return carets.slice();
  
  const sorted = carets
    .map((c) => c.clone())
    .sort((a, b) => {
      const as = a.start();
      const bs = b.start();
      return compareLineCol(as, bs);
    });
  
  const merged = [];
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const curEnd = current.end();
    const nextStart = next.start();
    
    if (compareLineCol(curEnd, nextStart) >= 0) {
      const nextEnd = next.end();
      if (compareLineCol(nextEnd, curEnd) > 0) {
        current.setPosition(nextEnd.line, nextEnd.col);
        current.setAnchor(current.start().line, current.start().col);
      }
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  
  return merged;
}

export function sortCarets(carets) {
  return carets
    .slice()
    .sort((a, b) => compareLineCol(a, b));
}

export function sortCaretsDescending(carets) {
  return carets
    .slice()
    .sort((a, b) => compareLineCol(b, a));
}