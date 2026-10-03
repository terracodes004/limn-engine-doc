export const DECORATION_TYPE = {
  BRACKET_MATCH: "bracket-match",
  SEARCH_MATCH: "search-match",
  SEARCH_CURRENT: "search-current",
  DIAGNOSTIC_ERROR: "diagnostic-error",
  DIAGNOSTIC_WARNING: "diagnostic-warning",
  OCCURRENCE: "occurrence",
  CURRENT_LINE: "current-line",
};

export class Decoration {
  constructor(type, fromLine, fromCol, toLine, toCol, style) {
    this.type = type;
    this.fromLine = fromLine;
    this.fromCol = fromCol;
    this.toLine = toLine;
    this.toCol = toCol;
    this.style = style || null;
  }
  
  static range(type, start, end, style) {
    return new Decoration(type, start.line, start.col, end.line, end.col, style);
  }
  
  static point(type, line, col, length, style) {
    return new Decoration(type, line, col, line, col + (length || 1), style);
  }
  
  containsPosition(line, col) {
    if (line < this.fromLine || line > this.toLine) return false;
    if (line === this.fromLine && col < this.fromCol) return false;
    if (line === this.toLine && col > this.toCol) return false;
    return true;
  }
}

export class DecorationSet {
  constructor() {
    this.items = [];
  }
  
  add(dec) {
    this.items.push(dec);
  }
  
  clear() {
    this.items.length = 0;
  }
  
  clearType(type) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].type === type) this.items.splice(i, 1);
    }
  }
  
  byType(type) {
    return this.items.filter((d) => d.type === type);
  }
  
  forLine(line) {
    return this.items.filter((d) => line >= d.fromLine && line <= d.toLine);
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
  
  size() {
    return this.items.length;
  }
  
  clone() {
    const s = new DecorationSet();
    for (const d of this.items) {
      s.add(new Decoration(d.type, d.fromLine, d.fromCol, d.toLine, d.toCol, d.style));
    }
    return s;
  }
}