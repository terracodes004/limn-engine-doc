import {
  rebuildLineStarts,
  offsetToLineCol,
  lineColToOffset,
} from "./coordinates.js";

export class TextBuffer {
  constructor(text = "") {
    this.lines = text.split("\n");
    this.lineStarts = rebuildLineStarts(this.lines);
    this._length = -1;
    this._version = 0;
  }

  lineCount() {
    return this.lines.length;
  }

  getLine(n) {
    if (n < 0 || n >= this.lines.length) return "";
    return this.lines[n];
  }

  lineLength(n) {
    if (n < 0 || n >= this.lines.length) return 0;
    return this.lines[n].length;
  }

  getText() {
    return this.lines.join("\n");
  }

  length() {
    if (this._length < 0) {
      let n = 0;
      for (let i = 0; i < this.lines.length; i++) {
        n += this.lines[i].length + 1;
      }
      this._length = n - 1;
    }
    return this._length;
  }

  offsetToLineCol(offset) {
    return offsetToLineCol(this.lineStarts, offset);
  }

  lineColToOffset(line, col) {
    return lineColToOffset(this.lineStarts, line, col);
  }

  insert(line, col, text) {
    if (!text) return { line, col };

    const targetLine = this.lines[line] || "";
    const safeCol = Math.max(0, Math.min(col, targetLine.length));
    const before = targetLine.slice(0, safeCol);
    const after = targetLine.slice(safeCol);

    const newLines = text.split("\n");

    if (newLines.length === 1) {
      this.lines[line] = before + text + after;
      this._invalidate();
      return { line, col: safeCol + text.length };
    }

    newLines[0] = before + newLines[0];
    newLines[newLines.length - 1] = newLines[newLines.length - 1] + after;

    this.lines.splice(line, 1, ...newLines);
    this._invalidate();

    return {
      line: line + newLines.length - 1,
      col: newLines[newLines.length - 1].length - after.length,
    };
  }

  remove(fromLine, fromCol, toLine, toCol) {
    if (fromLine > toLine || (fromLine === toLine && fromCol > toCol)) {
      const t = [fromLine, fromCol];
      fromLine = toLine; fromCol = toCol;
      toLine = t[0]; toCol = t[1];
    }

    const startLine = this.lines[fromLine] || "";
    const endLine = this.lines[toLine] || "";
    const safeFromCol = Math.max(0, Math.min(fromCol, startLine.length));
    const safeToCol = Math.max(0, Math.min(toCol, endLine.length));

    let removed;

    if (fromLine === toLine) {
      removed = startLine.slice(safeFromCol, safeToCol);
      this.lines[fromLine] =
        startLine.slice(0, safeFromCol) + endLine.slice(safeToCol);
    } else {
      removed =
        startLine.slice(safeFromCol) +
        "\n" +
        this.lines
          .slice(fromLine + 1, toLine)
          .map((l) => l + "\n")
          .join("") +
        endLine.slice(0, safeToCol);

      this.lines[fromLine] =
        startLine.slice(0, safeFromCol) + endLine.slice(safeToCol);
      this.lines.splice(fromLine + 1, toLine - fromLine);
    }

    this._invalidate();
    return removed;
  }

  slice(fromLine, fromCol, toLine, toCol) {
    if (fromLine > toLine || (fromLine === toLine && fromCol > toCol)) {
      const t = [fromLine, fromCol];
      fromLine = toLine; fromCol = toCol;
      toLine = t[0]; toCol = t[1];
    }
    const startLine = this.lines[fromLine] || "";
    const endLine = this.lines[toLine] || "";
    if (fromLine === toLine) {
      return startLine.slice(fromCol, toCol);
    }
    let out = startLine.slice(fromCol) + "\n";
    for (let i = fromLine + 1; i < toLine; i++) out += this.lines[i] + "\n";
    out += endLine.slice(0, toCol);
    return out;
  }

  setText(text) {
    this.lines = text.split("\n");
    this._invalidate();
  }

  clone() {
    const b = new TextBuffer("");
    b.lines = this.lines.slice();
    b.lineStarts = this.lineStarts.slice();
    b._length = this._length;
    b._version = this._version;
    return b;
  }

  _invalidate() {
    this.lineStarts = rebuildLineStarts(this.lines);
    this._length = -1;
    this._version++;
  }
}