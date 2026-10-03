import { EditorChange } from "./transaction.js";
import { Caret, mergeOverlappingCarets } from "./caret.js";
import {
  KEY,
  findWordLeft,
  findWordRight,
  firstNonWhitespace,
  indentOf,
  computeIndent,
  PAIRS,
  CLOSERS,
  isQuote,
  isOpenBracket,
  isCloseBracket,
} from "./keymap.js";

export class EditorController {
  constructor(buffer, carets, history, options) {
    this.buffer = buffer;
    this.carets = carets;
    this.history = history;
    this.tabSize = (options && options.tabSize) || 4;
    this.useSpaces = !options || options.useSpaces !== false;
    this.autoIndent = !options || options.autoIndent !== false;
    this.autoPairs = !options || options.autoPairs !== false;
    this.onTransaction = (options && options.onTransaction) || null;
  }

  primary() {
    return this.carets[0];
  }

  setCarets(carets) {
    this.carets = mergeOverlappingCarets(carets);
    if (this.carets.length === 0) this.carets = [new Caret(0, 0)];
  }

  _selectionBefore() {
    return this.carets.map((c) => c.clone());
  }

  _selectionAfter() {
    return this.carets.map((c) => c.clone());
  }

  _commit(changes, label) {
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (let i = 0; i < changes.length; i++) {
        this.history.record(this.buffer, changes[i], before, null, label);
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), label);
    } else {
      for (let i = 0; i < changes.length; i++) {
        this.history.record(this.buffer, changes[i], before, null, label);
      }
      this._applyAll(changes);
    }

    const after = this._selectionAfter();
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: after,
        label,
      });
    }
    return { changes, selectionBefore: before, selectionAfter: after, label };
  }

  _applyAll(changes) {
    const sorted = changes.slice().sort((a, b) => {
      if (a.fromLine !== b.fromLine) return b.fromLine - a.fromLine;
      return b.fromCol - a.fromCol;
    });
    for (const c of sorted) {
      this.buffer.remove(c.fromLine, c.fromCol, c.toLine, c.toCol);
      if (c.insert) this.buffer.insert(c.fromLine, c.fromCol, c.insert);
    }
  }

  _tryAutoDedent() {
    if (this.carets.length !== 1) return null;
    const caret = this.carets[0];
    if (caret.hasSelection()) return null;
    const line = caret.line;
    const col = caret.col;
    const text = this.buffer.getLine(line);
    if (!text) return null;
    const leadingWs = indentOf(text);
    if (leadingWs.length === 0) return null;
    if (col !== leadingWs.length) return null;
    return { line, indentLength: leadingWs.length };
  }

  insertText(text) {
    if (!text) return;

    let dedentInfo = null;
    if (text === "}" && this.autoIndent) {
      dedentInfo = this._tryAutoDedent();
    }

    if (dedentInfo) {
      const changes = [];

      changes.push(
        EditorChange.remove(dedentInfo.line, 0, dedentInfo.line, dedentInfo.indentLength)
      );
      changes.push(
        EditorChange.insert(dedentInfo.line, 0, text)
      );

      this._commit(changes, "insert");

      const caret = this.carets[0];
      caret.line = dedentInfo.line;
      caret.col = text.length;
      caret.anchor = null;
      this.setCarets(this.carets);
      return;
    }

    const changes = [];

    const sorted = this.carets
      .map((c, i) => ({ caret: c, index: i }))
      .sort((a, b) => {
        if (a.caret.line !== b.caret.line) return b.caret.line - a.caret.line;
        return b.caret.col - a.caret.col;
      });

    for (const { caret } of sorted) {
      if (caret.hasSelection()) {
        const start = caret.start();
        const end = caret.end();
        changes.push(
          EditorChange.replace(start.line, start.col, end.line, end.col, text)
        );
      } else {
        changes.push(EditorChange.insert(caret.line, caret.col, text));
      }
    }

    this._commit(changes, "insert");

    const lines = text.split("\n");
    const lineDelta = lines.length - 1;
    const lastLineLen = lines[lines.length - 1].length;

    const sortedCarets = this.carets
      .slice()
      .sort((a, b) => {
        if (a.line !== b.line) return b.line - a.line;
        return b.col - a.col;
      });

    for (const c of sortedCarets) {
      const wasSelection = c.anchor !== null;
      if (wasSelection) {
        const s = c.start();
        c.line = s.line;
        c.col = s.col;
        c.anchor = null;
      }
      if (lineDelta === 0) {
        c.col += text.length;
      } else {
        c.line += lineDelta;
        c.col = lastLineLen;
      }
    }

    this.setCarets(this.carets);
  }

  insertNewline() {
    const changes = [];
    const newPositions = [];

    for (const caret of this.carets) {
      let fromLine = caret.line;
      let fromCol = caret.col;
      let toLine = caret.line;
      let toCol = caret.col;

      if (caret.hasSelection()) {
        const s = caret.start();
        const e = caret.end();
        fromLine = s.line;
        fromCol = s.col;
        toLine = e.line;
        toCol = e.col;
      }

      const indent = this.autoIndent
        ? computeIndent(this.buffer, fromLine, this.tabSize)
        : "";

      const text = this.buffer.getLine(fromLine);
      const before = text.slice(0, fromCol);
      const after = text.slice(fromCol);
      const closeChar = after[0];
      const lastChar = before.replace(/\s+$/, "").slice(-1);

      let insert;
      let cursorLine;
      let cursorCol;

      if (
        this.autoPairs &&
        isOpenBracket(lastChar) &&
        CLOSERS[closeChar] === lastChar
      ) {
        const extraIndent = " ".repeat(this.tabSize);
        insert = "\n" + indent + extraIndent + "\n" + indent;
        cursorLine = fromLine + 1;
        cursorCol = indent.length + extraIndent.length;
      } else {
        insert = "\n" + indent;
        cursorLine = fromLine + 1;
        cursorCol = indent.length;
      }

      changes.push(
        EditorChange.replace(fromLine, fromCol, toLine, toCol, insert)
      );
      newPositions.push({ line: cursorLine, col: cursorCol });
    }

    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "newline");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "newline");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "newline");
      }
      this._applyAll(changes);
    }

    for (let i = 0; i < this.carets.length; i++) {
      const pos = newPositions[i];
      this.carets[i].line = pos.line;
      this.carets[i].col = pos.col;
      this.carets[i].anchor = null;
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "newline",
      });
    }
  }

  backspace() {
    const changes = [];
    const newPositions = [];

    for (const caret of this.carets) {
      if (caret.hasSelection()) {
        const s = caret.start();
        const e = caret.end();
        changes.push(EditorChange.remove(s.line, s.col, e.line, e.col));
        newPositions.push({ line: s.line, col: s.col });
        continue;
      }

      const { line, col } = caret;

      if (col > 0) {
        const text = this.buffer.getLine(line);
        const before = text[col - 1];
        const after = text[col];

        if (this.autoPairs && PAIRS[before] !== undefined && after === PAIRS[before]) {
          changes.push(EditorChange.remove(line, col - 1, line, col + 1));
          newPositions.push({ line, col: col - 1 });
          continue;
        }

        if (this.autoPairs && isQuote(before) && after === before) {
          changes.push(EditorChange.remove(line, col - 1, line, col + 1));
          newPositions.push({ line, col: col - 1 });
          continue;
        }

        changes.push(EditorChange.remove(line, col - 1, line, col));
        newPositions.push({ line, col: col - 1 });
      } else if (line > 0) {
        const prevLen = this.buffer.lineLength(line - 1);
        changes.push(EditorChange.remove(line - 1, prevLen, line, 0));
        newPositions.push({ line: line - 1, col: prevLen });
      } else {
        continue;
      }
    }

    if (changes.length === 0) return;

    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "delete");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "delete");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "delete");
      }
      this._applyAll(changes);
    }

    for (let i = 0; i < this.carets.length; i++) {
      const pos = newPositions[i];
      this.carets[i].line = pos.line;
      this.carets[i].col = pos.col;
      this.carets[i].anchor = null;
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "delete",
      });
    }
  }

  deleteForward() {
    const changes = [];
    const newPositions = [];

    for (const caret of this.carets) {
      if (caret.hasSelection()) {
        const s = caret.start();
        const e = caret.end();
        changes.push(EditorChange.remove(s.line, s.col, e.line, e.col));
        newPositions.push({ line: s.line, col: s.col });
        continue;
      }

      const { line, col } = caret;
      const len = this.buffer.lineLength(line);

      if (col < len) {
        const text = this.buffer.getLine(line);
        const here = text[col];
        const next = text[col + 1];

        if (this.autoPairs && PAIRS[here] !== undefined && next === PAIRS[here]) {
          changes.push(EditorChange.remove(line, col, line, col + 2));
          newPositions.push({ line, col });
          continue;
        }

        if (this.autoPairs && isQuote(here) && next === here) {
          changes.push(EditorChange.remove(line, col, line, col + 2));
          newPositions.push({ line, col });
          continue;
        }

        changes.push(EditorChange.remove(line, col, line, col + 1));
        newPositions.push({ line, col });
      } else if (line < this.buffer.lineCount() - 1) {
        changes.push(EditorChange.remove(line, col, line + 1, 0));
        newPositions.push({ line, col });
      } else {
        continue;
      }
    }

    if (changes.length === 0) return;

    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "delete");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "delete");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "delete");
      }
      this._applyAll(changes);
    }

    for (let i = 0; i < this.carets.length; i++) {
      const pos = newPositions[i];
      this.carets[i].line = pos.line;
      this.carets[i].col = pos.col;
      this.carets[i].anchor = null;
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "delete",
      });
    }
  }

  moveLeft(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      if (col > 0) {
        caret.col = col - 1;
      } else if (line > 0) {
        caret.line = line - 1;
        caret.col = this.buffer.lineLength(line - 1);
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveRight(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      const len = this.buffer.lineLength(line);
      if (col < len) {
        caret.col = col + 1;
      } else if (line < this.buffer.lineCount() - 1) {
        caret.line = line + 1;
        caret.col = 0;
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveUp(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      if (line > 0) {
        const prevLen = this.buffer.lineLength(line - 1);
        caret.line = line - 1;
        caret.col = Math.min(col, prevLen);
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveDown(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      if (line < this.buffer.lineCount() - 1) {
        const nextLen = this.buffer.lineLength(line + 1);
        caret.line = line + 1;
        caret.col = Math.min(col, nextLen);
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveWordLeft(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      if (col > 0) {
        const text = this.buffer.getLine(line);
        caret.col = findWordLeft(text, col);
      } else if (line > 0) {
        caret.line = line - 1;
        caret.col = this.buffer.lineLength(line - 1);
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveWordRight(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      const len = this.buffer.lineLength(line);
      if (col < len) {
        const text = this.buffer.getLine(line);
        caret.col = findWordRight(text, col);
      } else if (line < this.buffer.lineCount() - 1) {
        caret.line = line + 1;
        caret.col = 0;
      }
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveHome(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      const text = this.buffer.getLine(line);
      const first = firstNonWhitespace(text);
      caret.col = col === first ? 0 : first;
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveEnd(extend) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      const len = this.buffer.lineLength(line);
      caret.col = len;
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  movePageUp(extend, pageSize) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      caret.line = Math.max(0, line - pageSize);
      caret.col = Math.min(col, this.buffer.lineLength(caret.line));
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  movePageDown(extend, pageSize) {
    for (const caret of this.carets) {
      const { line, col } = caret;
      caret.line = Math.min(this.buffer.lineCount() - 1, line + pageSize);
      caret.col = Math.min(col, this.buffer.lineLength(caret.line));
      if (extend) {
        if (!caret.anchor) caret.anchor = { line, col };
      } else {
        caret.anchor = null;
      }
    }
    this.setCarets(this.carets);
  }

  moveDocStart(extend) {
    for (const caret of this.carets) {
      if (extend && !caret.anchor) {
        caret.anchor = { line: caret.line, col: caret.col };
      } else if (!extend) {
        caret.anchor = null;
      }
      caret.line = 0;
      caret.col = 0;
    }
    this.setCarets(this.carets);
  }

  moveDocEnd(extend) {
    for (const caret of this.carets) {
      if (extend && !caret.anchor) {
        caret.anchor = { line: caret.line, col: caret.col };
      } else if (!extend) {
        caret.anchor = null;
      }
      caret.line = this.buffer.lineCount() - 1;
      caret.col = this.buffer.lineLength(caret.line);
    }
    this.setCarets(this.carets);
  }

  selectAll() {
    const last = this.buffer.lineCount() - 1;
    this.carets.length = 1;
    const c = this.carets[0] || new Caret(0, 0);
    this.carets[0] = c;
    c.line = last;
    c.col = this.buffer.lineLength(last);
    c.anchor = { line: 0, col: 0 };
  }

  selectWord() {
    const caret = this.carets[0];
    const { line, col } = caret;
    const text = this.buffer.getLine(line);

    if (text.length === 0) {
      caret.anchor = { line, col: 0 };
      caret.col = 0;
      this.setCarets(this.carets);
      return;
    }

    let start = col;
    let end = col;

    if (start >= text.length) start = text.length - 1;

    if (/[A-Za-z0-9_$]/.test(text[start])) {
      end = start + 1;
    } else {
      if (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) {
        start--;
        end = start + 1;
      } else {
        end = start;
      }
    }

    while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) start--;
    while (end < text.length && /[A-Za-z0-9_$]/.test(text[end])) end++;

    if (start === end) {
      caret.anchor = { line, col: start };
      caret.col = start;
    } else {
      caret.anchor = { line, col: start };
      caret.col = end;
    }
    this.setCarets(this.carets);
  }

  selectLine() {
    const caret = this.carets[0];
    const line = caret.line;
    const len = this.buffer.lineLength(line);
    caret.anchor = { line, col: 0 };
    caret.col = len;
    this.setCarets(this.carets);
  }

  handleTab(shift) {
    const anySelection = this.carets.some((c) => c.hasSelection());
    if (!anySelection && !shift) {
      const text = " ".repeat(this.tabSize);
      const changes = [];
      for (const caret of this.carets) {
        changes.push(EditorChange.insert(caret.line, caret.col, text));
      }
      this._commit(changes, "indent");
      for (const c of this.carets) c.col += text.length;
      return;
    }

    const touched = new Set();
    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.add(line);
    }

    const lines = Array.from(touched).sort((a, b) => b - a);
    const changes = [];
    const indentStr = " ".repeat(this.tabSize);

    for (const line of lines) {
      if (shift) {
        const text = this.buffer.getLine(line);
        const ind = indentOf(text);
        const remove = Math.min(this.tabSize, ind.length);
        if (remove > 0) {
          changes.push(EditorChange.remove(line, 0, line, remove));
        }
      } else {
        changes.push(EditorChange.insert(line, 0, indentStr));
      }
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "indent");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "indent");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "indent");
      }
      this._applyAll(changes);
    }

    for (const caret of this.carets) {
      if (shift) {
        caret.col = Math.max(0, caret.col - this.tabSize);
        if (caret.anchor) caret.anchor.col = Math.max(0, caret.anchor.col - this.tabSize);
      } else {
        caret.col += indentStr.length;
        if (caret.anchor) caret.anchor.col += indentStr.length;
      }
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "indent",
      });
    }
  }

  tryAutoPair(ch) {
    if (!this.autoPairs) return false;

    const isOpen = PAIRS[ch] !== undefined;
    const isClose = CLOSERS[ch] !== undefined;
    const isQuoteCh = isQuote(ch);

    if (!isOpen && !isClose && !isQuoteCh) return false;

    const changes = [];
    const positions = [];

    for (const caret of this.carets) {
      if (caret.hasSelection() && isOpen) {
        const s = caret.start();
        const e = caret.end();
        const text = this.buffer.slice(s.line, s.col, e.line, e.col);
        changes.push(
          EditorChange.replace(s.line, s.col, e.line, e.col, ch + text + PAIRS[ch])
        );
        positions.push({ line: e.line, col: e.col + 2 });
        continue;
      }

      if (caret.hasSelection() && isQuoteCh) {
        const s = caret.start();
        const e = caret.end();
        const text = this.buffer.slice(s.line, s.col, e.line, e.col);
        changes.push(
          EditorChange.replace(s.line, s.col, e.line, e.col, ch + text + ch)
        );
        positions.push({ line: e.line, col: e.col + 2 });
        continue;
      }

      if (caret.hasSelection()) {
        const s = caret.start();
        const e = caret.end();
        changes.push(EditorChange.replace(s.line, s.col, e.line, e.col, ch));
        positions.push({ line: s.line, col: s.col + 1 });
        continue;
      }

      const { line, col } = caret;
      const text = this.buffer.getLine(line);
      const next = text[col];

      if (isClose && next === ch) {
        positions.push({ line, col: col + 1 });
        changes.push(null);
        continue;
      }

      if (isQuoteCh && next === ch) {
        positions.push({ line, col: col + 1 });
        changes.push(null);
        continue;
      }

      if (isQuoteCh && next && /[A-Za-z0-9_$]/.test(next)) {
        return false;
      }

      if (isClose) {
        return false;
      }

      const closeChar = isQuoteCh ? ch : PAIRS[ch];
      changes.push(EditorChange.insert(line, col, ch + closeChar));
      positions.push({ line, col: col + 1 });
    }

    const realChanges = changes.filter((c) => c !== null);

    if (realChanges.length === 0) {
      for (let i = 0; i < this.carets.length; i++) {
        const p = positions[i];
        if (p) {
          this.carets[i].line = p.line;
          this.carets[i].col = p.col;
          this.carets[i].anchor = null;
        }
      }
      return true;
    }

    const before = this._selectionBefore();
    const multi = realChanges.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of realChanges) {
        this.history.record(this.buffer, c, before, null, "insert");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "insert");
    } else {
      for (const c of realChanges) {
        this.history.record(this.buffer, c, before, null, "insert");
      }
      this._applyAll(realChanges);
    }

    for (let i = 0; i < this.carets.length; i++) {
      const p = positions[i];
      if (p) {
        this.carets[i].line = p.line;
        this.carets[i].col = p.col;
        this.carets[i].anchor = null;
      }
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes: realChanges,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "insert",
      });
    }
    return true;
  }

  toggleComment() {
    const touched = new Set();
    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.add(line);
    }

    const lines = Array.from(touched).sort((a, b) => b - a);
    const allCommented = lines.every((l) => {
      const text = this.buffer.getLine(l);
      return /^\s*\/\//.test(text);
    });

    const changes = [];
    for (const line of lines) {
      const text = this.buffer.getLine(line);
      if (allCommented) {
        const m = text.match(/^(\s*)\/\/ ?/);
        if (m) {
          changes.push(EditorChange.remove(line, m[1].length, line, m[0].length));
        }
      } else {
        const ind = indentOf(text);
        changes.push(EditorChange.insert(line, ind.length, "// "));
      }
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "comment");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "comment");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "comment");
      }
      this._applyAll(changes);
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "comment",
      });
    }
  }

  toggleBlockComment(language) {
    const touched = new Set();
    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.add(line);
    }

    const lines = Array.from(touched).sort((a, b) => a - b);
    if (lines.length === 0) return;

    let openTag = "/*";
    let closeTag = "*/";
    if (language === "html") {
      openTag = "<!--";
      closeTag = "-->";
    } else if (language === "css" || language === "javascript" || language === "json") {
      openTag = "/*";
      closeTag = "*/";
    } else {
      return;
    }

    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];
    const firstText = this.buffer.getLine(firstLine);
    const lastText = this.buffer.getLine(lastLine);

    const alreadyWrapped =
      firstText.indexOf(openTag) !== -1 &&
      lastText.indexOf(closeTag) !== -1;

    const changes = [];

    if (alreadyWrapped) {
      const openIdx = firstText.indexOf(openTag);
      const closeIdx = lastText.lastIndexOf(closeTag);
      changes.push(EditorChange.remove(firstLine, openIdx, firstLine, openIdx + openTag.length));
      changes.push(EditorChange.remove(lastLine, closeIdx, lastLine, closeIdx + closeTag.length));
    } else {
      const firstIndent = indentOf(firstText);
      changes.push(EditorChange.insert(firstLine, firstIndent.length, openTag + " "));

      const lastLen = lastText.length;
      changes.push(EditorChange.insert(lastLine, lastLen, " " + closeTag));
    }

    if (changes.length === 0) return;

    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "block-comment");
      }
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "block-comment");
    } else {
      for (const c of changes) {
        this.history.record(this.buffer, c, before, null, "block-comment");
      }
      this._applyAll(changes);
    }

    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "block-comment",
      });
    }
  }

  tryHtmlAutoClose(line, col) {
    const text = this.buffer.getLine(line);
    if (!text) return false;

    let scanCol;
    if (text[col] === ">") {
      scanCol = col;
    } else if (text[col - 1] === ">") {
      scanCol = col - 1;
    } else {
      scanCol = col;
    }

    let lt = scanCol - 1;
    while (lt >= 0 && /[a-zA-Z0-9-]/.test(text[lt])) lt--;
    if (lt < 0 || text[lt] !== "<") return false;
    if (lt > 0 && text[lt - 1] === "/") return false;

    const tagName = text.slice(lt + 1, scanCol);
    if (!tagName || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tagName)) return false;

    const selfClosed = text.slice(lt, scanCol + 1).indexOf("/>") !== -1;
    if (selfClosed) return false;

    const voidTags = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr",
    ]);
    if (voidTags.has(tagName.toLowerCase())) return false;

    const after = text.slice(scanCol + 1);
    const nextNonWs = after.replace(/^\s+/, "");
    if (nextNonWs.startsWith("</" + tagName)) return false;
    if (nextNonWs.indexOf("</" + tagName + ">") !== -1) return false;

    const closeTag = "</" + tagName + ">";

    const insertAt = col;
    const primary = this.carets[0];
    primary.anchor = null;
    primary.line = line;
    primary.col = insertAt;
    this.insertText(closeTag);

    const newCaret = this.carets[0];
    newCaret.line = line;
    newCaret.col = insertAt;
    newCaret.anchor = null;
    this.setCarets(this.carets);

    return true;
  }

  addCaretAt(line, col) {
    const c = new Caret(line, col);
    this.carets.push(c);
    this.setCarets(this.carets);
  }

  duplicateSelection() {
    const caret = this.carets[0];
    if (!caret || !caret.hasSelection()) return false;

    const s = caret.start();
    const e = caret.end();
    const text = this.buffer.slice(s.line, s.col, e.line, e.col);
    if (!text) return false;

    const before = this._selectionBefore();

    const change = EditorChange.insert(e.line, e.col, text);
    this._commit([change], "duplicate");

    const caretAfter = this.carets[0];
    const length = text.length;
    const lines = text.split("\n");
    const lineCount = lines.length;

    let endLine;
    let endCol;
    if (lineCount === 1) {
      endLine = e.line;
      endCol = e.col + length;
    } else {
      endLine = e.line + lineCount - 1;
      endCol = lines[lineCount - 1].length;
    }

    const newAnchorLine = e.line;
    const newAnchorCol = e.col;

    caretAfter.line = endLine;
    caretAfter.col = endCol;
    caretAfter.anchor = { line: newAnchorLine, col: newAnchorCol };

    this.setCarets(this.carets);

    if (this.onTransaction) {
      this.onTransaction({
        changes: [change],
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "duplicate",
      });
    }
    return true;
  }

  duplicateLine() {
    const changes = [];
    const touched = new Map();

    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.set(line, true);
    }

    const lines = Array.from(touched.keys()).sort((a, b) => b - a);
    for (const line of lines) {
      const text = this.buffer.getLine(line);
      const insert = "\n" + text;
      changes.push(EditorChange.insert(line, text.length, insert));
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) this.history.record(this.buffer, c, before, null, "duplicate");
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "duplicate");
    } else {
      for (const c of changes) this.history.record(this.buffer, c, before, null, "duplicate");
      this._applyAll(changes);
    }

    for (const caret of this.carets) {
      caret.line += 1;
      if (caret.anchor) caret.anchor.line += 1;
    }
    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "duplicate",
      });
    }
  }

  moveLineUp() {
    const changes = [];
    const touched = new Map();

    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.set(line, true);
    }

    const lines = Array.from(touched.keys()).sort((a, b) => a - b);
    if (lines.length === 0) return;
    if (lines[0] === 0) return;

    for (const line of lines) {
      const above = this.buffer.getLine(line - 1);
      const here = this.buffer.getLine(line);
      changes.push(EditorChange.replace(line - 1, 0, line, here.length, here + "\n" + above));
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) this.history.record(this.buffer, c, before, null, "move-line");
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "move-line");
    } else {
      for (const c of changes) this.history.record(this.buffer, c, before, null, "move-line");
      this._applyAll(changes);
    }

    for (const caret of this.carets) {
      caret.line -= 1;
      if (caret.anchor) caret.anchor.line -= 1;
    }
    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "move-line",
      });
    }
  }

  moveLineDown() {
    const changes = [];
    const touched = new Map();

    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.set(line, true);
    }

    const lines = Array.from(touched.keys()).sort((a, b) => b - a);
    if (lines.length === 0) return;
    if (lines[0] === this.buffer.lineCount() - 1) return;

    for (const line of lines) {
      const here = this.buffer.getLine(line);
      const below = this.buffer.getLine(line + 1);
      changes.push(EditorChange.replace(line, 0, line + 1, below.length, below + "\n" + here));
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) this.history.record(this.buffer, c, before, null, "move-line");
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "move-line");
    } else {
      for (const c of changes) this.history.record(this.buffer, c, before, null, "move-line");
      this._applyAll(changes);
    }

    for (const caret of this.carets) {
      caret.line += 1;
      if (caret.anchor) caret.anchor.line += 1;
    }
    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "move-line",
      });
    }
  }

  deleteLine() {
    const changes = [];
    const touched = new Map();

    for (const caret of this.carets) {
      const s = caret.hasSelection() ? caret.start() : caret;
      const e = caret.hasSelection() ? caret.end() : caret;
      for (let line = s.line; line <= e.line; line++) touched.set(line, true);
    }

    const lines = Array.from(touched.keys()).sort((a, b) => b - a);

    for (const line of lines) {
      const isLast = line === this.buffer.lineCount() - 1;
      if (isLast && line > 0) {
        const prevLen = this.buffer.lineLength(line - 1);
        changes.push(EditorChange.remove(line - 1, prevLen, line, this.buffer.lineLength(line)));
      } else if (!isLast) {
        changes.push(EditorChange.remove(line, 0, line + 1, 0));
      } else {
        const len = this.buffer.lineLength(line);
        if (len > 0) {
          changes.push(EditorChange.remove(line, 0, line, len));
        }
      }
    }

    if (changes.length === 0) return;
    const before = this._selectionBefore();
    const multi = changes.length > 1;

    if (multi) {
      this.history.beginBatch();
      for (const c of changes) this.history.record(this.buffer, c, before, null, "delete-line");
      this.history.endBatch(this.buffer, before, this._selectionAfter(), "delete-line");
    } else {
      for (const c of changes) this.history.record(this.buffer, c, before, null, "delete-line");
      this._applyAll(changes);
    }

    for (const caret of this.carets) {
      const maxLine = this.buffer.lineCount() - 1;
      if (caret.line > maxLine) caret.line = maxLine;
      const len = this.buffer.lineLength(caret.line);
      if (caret.col > len) caret.col = len;
      if (caret.anchor) {
        if (caret.anchor.line > maxLine) caret.anchor.line = maxLine;
        const alen = this.buffer.lineLength(caret.anchor.line);
        if (caret.anchor.col > alen) caret.anchor.col = alen;
      }
    }
    this.setCarets(this.carets);
    if (this.onTransaction) {
      this.onTransaction({
        changes,
        selectionBefore: before,
        selectionAfter: this._selectionAfter(),
        label: "delete-line",
      });
    }
  }

  undo() {
    const entry = this.history.undo(this.buffer);
    if (!entry) return null;
    if (entry.selection) {
      this.carets = entry.selection.map((c) => c.clone());
      this.setCarets(this.carets);
    }
    if (this.onTransaction) {
      this.onTransaction({
        changes: [],
        selectionBefore: [],
        selectionAfter: this._selectionAfter(),
        label: "undo",
      });
    }
    return entry;
  }

  redo() {
    const entry = this.history.redo(this.buffer);
    if (!entry) return null;
    if (entry.selection) {
      this.carets = entry.selection.map((c) => c.clone());
      this.setCarets(this.carets);
    }
    if (this.onTransaction) {
      this.onTransaction({
        changes: [],
        selectionBefore: [],
        selectionAfter: this._selectionAfter(),
        label: "redo",
      });
    }
    return entry;
  }
}