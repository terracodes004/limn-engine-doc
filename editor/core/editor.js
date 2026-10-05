import { Caret } from "./caret.js";
import { Documents } from "./documents.js";
import { Renderer } from "./renderer.js";
import { EditorController } from "./input.js";
import { getTheme } from "./theme.js";
import { DecorationSet, Decoration, DECORATION_TYPE } from "./decorations.js";
import { buildBracketDecorations } from "./bracket-match.js";
import { getCompletions } from "./completions.js";
import { LANGUAGES } from "./languages.js";
import { analyze } from "./diagnostics.js";
import { extractAbbreviation, expandAbbreviation } from "./emmet.js";

export class LimnEditor {
  constructor(options) {
    options = options || {};

    this.decorations = new DecorationSet();
    this.renderer = new Renderer(getTheme(options.theme || "vs-dark"));
    this.renderer.tabSize = options.tabSize || 4;
    this.renderer.showIndentGuides = options.showIndentGuides !== false;

    this.width = options.width || 800;
    this.height = options.height || 600;
    this.cursorHidden = false;

    this.onChange = options.onChange || null;
    this.onCursor = options.onCursor || null;
    this.onSelectionChange = options.onSelectionChange || null;
    this.onDocumentsChange = options.onDocumentsChange || null;

    this._blinkPhase = 0;
    this._lastInput = Date.now();
    this._dirty = true;
    this._initialized = false;

    this.folding = null;

    this.diagnostics = [];
    this._diagnosticsLanguageKey = "plaintext";

    this.documents = new Documents({
      maxUndo: options.maxUndo || 500,
      onActiveChange: () => this._onActiveDocChange(),
      onListChange: () => { this._dirty = true; },
    });
    this.documents.add({ name: options.name || "untitled.js", value: options.value || "" });

    this._bindActiveDoc();
    this.viewport.setSize(this.width, this.height);
    this._syncViewportContent();

    this.controller = new EditorController(
      this.buffer,
      this.carets,
      this.history,
      {
        tabSize: options.tabSize || 4,
        autoIndent: options.autoIndent !== false,
        autoPairs: options.autoPairs !== false,
        onTransaction: (tx) => this._onTransaction(tx),
      }
    );

    this._initialized = true;
    this.updateDecorations();
    this.updateDiagnostics("javascript");
  }

  _bindActiveDoc() {
    const d = this.documents.active;
    if (!d) return;
    this.buffer = d.buffer;
    this.carets = d.carets;
    this.history = d.history;
    this.viewport = d.viewport;
    this.highlighter = d.highlighter;
    if (this.viewport) {
      this.viewport.folding = this.folding;
    }
    if (this.controller) {
      this.controller.buffer = this.buffer;
      this.controller.carets = this.carets;
      this.controller.history = this.history;
    }
  }

  _onActiveDocChange() {
    this._bindActiveDoc();
    if (!this._initialized) return;
    if (this.folding) this.folding.reset();
    if (this.viewport) this.viewport.folding = this.folding;
    this.viewport.setSize(this.width, this.height);
    this.viewport.invalidate();
    this._syncViewportContent();
    this.decorations.clear();
    this.updateDecorations();
    this._dirty = true;
    if (this.onDocumentsChange) this.onDocumentsChange(this.documents);
    if (this.onChange) this.onChange(this.getValue());
    this._emitCursor();
  }

  get activeDoc() {
    return this.documents.active;
  }

  newDocument(options) {
    this.documents.add(options || {});
    return this.documents.active;
  }

  switchToId(id) {
    return this.documents.switchToId(id);
  }

  switchToIndex(i) {
    return this.documents.switchTo(i);
  }

  closeDocument(id) {
    return this.documents.closeId(id);
  }

  closeDocumentByIndex(i) {
    return this.documents.close(i);
  }

  _onTransaction(tx) {
    this._dirty = true;
    this.viewport.invalidate();
    this._syncViewportContent();
    if (tx && tx.changes && tx.changes.length > 0) {
      const label = tx.label;
      if (label === "insert" || label === "newline" || label === "delete" ||
          label === "indent" || label === "comment" ||
          label === "block-comment" ||
          label === "duplicate" || label === "move-line" || label === "delete-line" ||
          label === "emmet" ||
          label === "format") {
        const firstLine = tx.changes[0].fromLine;
        this.highlighter.invalidateFrom(Math.max(0, firstLine - 1));
      }
    }
    const doc = this.activeDoc;
    if (doc && !doc.dirty) {
      doc.dirty = true;
      if (this.onDocumentsChange) this.onDocumentsChange(this.documents);
    }
    this.updateDecorations();
    this.updateDiagnostics(this._diagnosticsLanguageKey);
    if (this.onChange) this.onChange(this.getValue());
    if (this.onSelectionChange) this.onSelectionChange(this.getSelection());
  }

  _emitCursor() {
    this.updateDecorations();
    if (this.onCursor) this.onCursor(this.getCursor());
  }

  _syncViewportContent() {
    const lineCount = this.buffer.lineCount();
    let maxLen = 0;
    for (let i = 0; i < lineCount; i++) {
      const l = this.buffer.lineLength(i);
      if (l > maxLen) maxLen = l;
    }
    this.viewport.setContentSize(lineCount, maxLen);
    this.viewport.invalidate();
  }

  updateDecorations() {
    this.decorations.clearType(DECORATION_TYPE.BRACKET_MATCH);
    const primary = this.carets[0];
    if (!primary) return;
    const brs = buildBracketDecorations(this.buffer, primary.line, primary.col);
    for (const d of brs) this.decorations.add(d);
    this._dirty = true;
  }

  updateDiagnostics(languageKey) {
    const key = languageKey || "plaintext";
    this._diagnosticsLanguageKey = key;
    this.diagnostics = analyze(this.buffer, key);
    this._dirty = true;
    return this.diagnostics;
  }

  getDiagnosticsAtLine(line) {
    return this.diagnostics.filter((d) => d.line === line);
  }

  addSearchDecoration(fromLine, fromCol, toLine, toCol, isCurrent) {
    this.decorations.add(new Decoration(
      isCurrent ? DECORATION_TYPE.SEARCH_CURRENT : DECORATION_TYPE.SEARCH_MATCH,
      fromLine, fromCol, toLine, toCol, null
    ));
    this._dirty = true;
  }

  clearSearchDecorations() {
    this.decorations.clearType(DECORATION_TYPE.SEARCH_MATCH);
    this.decorations.clearType(DECORATION_TYPE.SEARCH_CURRENT);
    this._dirty = true;
  }

  setSize(width, height) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.viewport.setSize(width, height);
    this.viewport.invalidate();
    this._dirty = true;
  }

  getValue() {
    return this.buffer.getText();
  }

  setValue(text) {
    this.buffer.setText(String(text == null ? "" : text));
    this.carets = [new Caret(0, 0)];
    this.controller.carets = this.carets;
    this.history.clear();
    this.highlighter.invalidateAll();
    this.viewport.invalidate();
    this._syncViewportContent();
    this.decorations.clear();
    this.updateDecorations();
    this.updateDiagnostics(this._diagnosticsLanguageKey);
    this._dirty = true;
    if (this.onChange) this.onChange(this.getValue());
    this._emitCursor();
  }

  setTheme(name) {
    this.renderer.theme = getTheme(name);
    this._dirty = true;
  }

  getTheme() {
    return this.renderer.theme.name;
  }

  cycleTheme() {
    const names = ["vs-dark", "vs-light", "monokai"];
    const current = this.renderer.theme.name;
    const idx = names.indexOf(current);
    const next = names[(idx + 1) % names.length];
    this.setTheme(next);
    return next;
  }

  setShowIndentGuides(show) {
    this.renderer.showIndentGuides = !!show;
    this._dirty = true;
  }

  setFontSize(size) {
    const clamped = Math.max(10, Math.min(28, size));
    this.renderer.setFont(
      this.renderer.fontFamily,
      clamped,
      Math.round(clamped * 1.7)
    );
    this.viewport.invalidate();
    this._syncViewportContent();
    this._dirty = true;
    return clamped;
  }

  getFontSize() {
    return this.renderer.fontSize;
  }

  setWordWrap(on) {
    const vp = this.viewport;
    if (!vp) return;
    vp.wordWrap = !!on;
    vp.invalidate();
    this._dirty = true;
  }

  isWordWrap() {
    return this.viewport ? !!this.viewport.wordWrap : true;
  }

  setLanguageMode(key) {
    const doc = this.activeDoc;
    if (!doc) return;
    const lang = LANGUAGES[key];
    if (!lang) return;
    doc.highlighter.setLanguage(lang);
    doc.languageKey = key;
    this.highlighter = doc.highlighter;
    this.updateDiagnostics(key);
    this._dirty = true;
  }

  setFolding(folding) {
    this.folding = folding;
    if (this.viewport) {
      this.viewport.folding = folding;
      this.viewport.invalidate();
    }
    this._dirty = true;
  }

  toggleFold(line) {
    if (!this.folding) return false;
    const changed = this.folding.toggle(line, this.buffer);
    if (changed) {
      this.viewport.invalidate();
      this._syncViewportContent();
      this._ensureCursorVisible();
      this._dirty = true;
    }
    return changed;
  }

  foldAll() {
    if (!this.folding) return 0;
    const n = this.folding.collapseAll(this.buffer);
    if (n > 0) {
      this.viewport.invalidate();
      this._syncViewportContent();
      this._ensureCursorVisible();
      this._dirty = true;
    }
    return n;
  }

  unfoldAll() {
    if (!this.folding) return 0;
    const n = this.folding.unfoldAll();
    if (n > 0) {
      this.viewport.invalidate();
      this._syncViewportContent();
      this._ensureCursorVisible();
      this._dirty = true;
    }
    return n;
  }

  expandFoldContaining(line) {
    if (!this.folding) return false;
    const changed = this.folding.expandContaining(line, this.buffer);
    if (changed) {
      this.viewport.invalidate();
      this._syncViewportContent();
      this._dirty = true;
    }
    return changed;
  }

  getCompletions() {
    const primary = this.carets[0];
    if (!primary) return null;
    const language = this.highlighter ? this.highlighter.language : null;
    return getCompletions(this.buffer, primary.line, primary.col, language);
  }

  getCursor() {
    const c = this.carets[0];
    return { line: c.line, col: c.col, count: this.carets.length };
  }

  setCursor(line, col) {
    this.carets = [new Caret(line, col)];
    this.controller.carets = this.carets;
    if (this.folding) this.folding.expandContaining(line, this.buffer);
    if (!this.viewport._cache) this.viewport.computeVisible(this.buffer.lines);
    this.viewport.ensurePositionVisible(line, col);
    this._dirty = true;
    this._blinkPhase = 0;
    this._lastInput = Date.now();
    this._emitCursor();
  }

  getSelection() {
    return this.carets.map((c) => ({
      start: c.start(),
      end: c.end(),
      hasSelection: c.hasSelection(),
    }));
  }

  focus() {
    this._focused = true;
    this._dirty = true;
  }

  blur() {
    this._focused = false;
  }

  undo() {
    const doc = this.activeDoc;

    this.controller.undo();
    this.viewport.invalidate();
    this._syncViewportContent();
    this.updateDiagnostics(this._diagnosticsLanguageKey);

    const primary = this.carets[0];
    if (primary) {
      if (this.folding) this.folding.expandContaining(primary.line, this.buffer);
      if (!this.viewport._cache) this.viewport.computeVisible(this.buffer.lines);
      this.viewport.ensurePositionVisible(primary.line, primary.col);
      if (doc) {
        doc.scrollTop = this.viewport.scrollTop;
        doc.scrollLeft = this.viewport.scrollLeft;
      }
    }

    this._dirty = true;
    this._emitCursor();
  }

  redo() {
    const doc = this.activeDoc;

    this.controller.redo();
    this.viewport.invalidate();
    this._syncViewportContent();
    this.updateDiagnostics(this._diagnosticsLanguageKey);

    const primary = this.carets[0];
    if (primary) {
      if (this.folding) this.folding.expandContaining(primary.line, this.buffer);
      if (!this.viewport._cache) this.viewport.computeVisible(this.buffer.lines);
      this.viewport.ensurePositionVisible(primary.line, primary.col);
      if (doc) {
        doc.scrollTop = this.viewport.scrollTop;
        doc.scrollLeft = this.viewport.scrollLeft;
      }
    }

    this._dirty = true;
    this._emitCursor();
  }

  expandEmmet(languageKey) {
    if (languageKey && languageKey !== "html") return false;
    if (this.carets.length !== 1) return false;
    const caret = this.carets[0];
    if (caret.hasSelection()) return false;

    const line = caret.line;
    const col = caret.col;
    const lineText = this.buffer.getLine(line);
    if (!lineText) return false;

    const extracted = extractAbbreviation(lineText, col);
    if (!extracted) return false;

    const leadingWs = lineText.match(/^\s*/)[0];
    const result = expandAbbreviation(extracted.text, {
      indentUnit: "  ",
      baseIndent: leadingWs,
    });
    if (!result) return false;

    const change = {
      fromLine: line,
      fromCol: extracted.startCol,
      toLine: line,
      toCol: extracted.endCol,
      insert: result.text,
    };

    this.controller._commit([change], "emmet");

    const caretLine = line + result.cursorLine;
    const caretCol = result.cursorLine === 0
      ? extracted.startCol + result.cursorCol
      : result.cursorCol;

    const c = this.carets[0];
    c.line = caretLine;
    c.col = caretCol;
    c.anchor = null;
    this.controller.carets = this.carets;

    this.highlighter.invalidateFrom(Math.max(0, line - 1));
    this.viewport.invalidate();
    this._syncViewportContent();
    this.viewport.ensurePositionVisible(caretLine, caretCol);

    const doc = this.activeDoc;
    if (doc) {
      doc.scrollTop = this.viewport.scrollTop;
      doc.scrollLeft = this.viewport.scrollLeft;
    }

    this.notifyInput();
    this._emitCursor();
    return true;
  }

  scrollBy(dx, dy) {
    const changed = this.viewport.scrollBy(dx, dy);
    if (changed) {
      this._dirty = true;
      const doc = this.activeDoc;
      if (doc) {
        doc.scrollTop = this.viewport.scrollTop;
        doc.scrollLeft = this.viewport.scrollLeft;
      }
    }
    return changed;
  }

  setScroll(top, left) {
    const changed = this.viewport.setScroll(top, left);
    if (changed) {
      this._dirty = true;
      const doc = this.activeDoc;
      if (doc) {
        doc.scrollTop = this.viewport.scrollTop;
        doc.scrollLeft = this.viewport.scrollLeft;
      }
    }
    return changed;
  }

  getScroll() {
    return { top: this.viewport.scrollTop, left: this.viewport.scrollLeft };
  }

  scrollToLine(line, center) {
    if (line < 0) line = 0;
    const max = this.buffer.lineCount() - 1;
    if (line > max) line = max;
    if (this.folding) this.folding.expandContaining(line, this.buffer);
    if (!this.viewport._cache) this.viewport.computeVisible(this.buffer.lines);
    const changed = center
      ? this.viewport.scrollToLineCentered(line)
      : this.viewport.scrollToLine(line);
    if (changed) {
      this._dirty = true;
      const doc = this.activeDoc;
      if (doc) {
        doc.scrollTop = this.viewport.scrollTop;
        doc.scrollLeft = this.viewport.scrollLeft;
      }
    }
    return changed;
  }

  insert(text) {
    this.controller.insertText(text);
    this.notifyInput();
    this._emitCursor();
  }

  newline() {
    this.controller.insertNewline();
    this.notifyInput();
    this._emitCursor();
  }

  backspace() {
    this.controller.backspace();
    this.notifyInput();
    this._emitCursor();
  }

  delete() {
    this.controller.deleteForward();
    this.notifyInput();
    this._emitCursor();
  }

  moveLeft(extend) {
    this.controller.moveLeft(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveRight(extend) {
    this.controller.moveRight(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveUp(extend) {
    this.controller.moveUp(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveDown(extend) {
    this.controller.moveDown(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveWordLeft(extend) {
    this.controller.moveWordLeft(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveWordRight(extend) {
    this.controller.moveWordRight(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveHome(extend) {
    this.controller.moveHome(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveEnd(extend) {
    this.controller.moveEnd(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveDocStart(extend) {
    this.controller.moveDocStart(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  moveDocEnd(extend) {
    this.controller.moveDocEnd(extend);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  movePageUp(extend) {
    const pageLines = Math.max(1, Math.floor(this.height / this.renderer.lineHeight) - 2);
    this.controller.movePageUp(extend, pageLines);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  movePageDown(extend) {
    const pageLines = Math.max(1, Math.floor(this.height / this.renderer.lineHeight) - 2);
    this.controller.movePageDown(extend, pageLines);
    this._ensureCursorVisible();
    this._emitCursor();
  }

  selectAll() {
    this.controller.selectAll();
    this._dirty = true;
    this._emitCursor();
  }

  selectWord() {
    this.controller.selectWord();
    this._dirty = true;
    this._emitCursor();
  }

  selectLine() {
    this.controller.selectLine();
    this._dirty = true;
    this._emitCursor();
  }

  addCaretAt(line, col) {
    this.controller.addCaretAt(line, col);
    this._dirty = true;
    this._emitCursor();
  }

  handleTab(shift) {
    this.controller.handleTab(shift);
    this.notifyInput();
    this._emitCursor();
  }

  tryAutoPair(ch) {
    const handled = this.controller.tryAutoPair(ch);
    if (handled) {
      this.notifyInput();
      this._emitCursor();
    }
    return handled;
  }

  toggleComment() {
    this.controller.toggleComment();
    this._emitCursor();
  }

  toggleBlockComment(language) {
    this.controller.toggleBlockComment(language);
    this.notifyInput();
    this._emitCursor();
  }

  tryHtmlAutoClose(line, col) {
    const handled = this.controller.tryHtmlAutoClose(line, col);
    if (handled) {
      this.notifyInput();
      this._emitCursor();
    }
    return handled;
  }

  duplicateSelection() {
    const handled = this.controller.duplicateSelection();
    if (handled) {
      this.notifyInput();
      this._emitCursor();
    }
    return handled;
  }

  duplicateLine() {
    const primary = this.carets[0];
    if (primary && primary.hasSelection()) {
      this.controller.duplicateSelection();
      this.notifyInput();
      this._emitCursor();
      return;
    }
    this.controller.duplicateLine();
    this.notifyInput();
    this._emitCursor();
  }

  moveLineUp() {
    this.controller.moveLineUp();
    this.notifyInput();
    this._emitCursor();
  }

  moveLineDown() {
    this.controller.moveLineDown();
    this.notifyInput();
    this._emitCursor();
  }

  deleteLine() {
    this.controller.deleteLine();
    this.notifyInput();
    this._emitCursor();
  }

  copySelection() {
    const sel = this.getSelection();
    if (!sel.length || !sel[0].hasSelection) return "";
    const s = sel[0].start;
    const e = sel[0].end;
    return this.buffer.slice(s.line, s.col, e.line, e.col);
  }

  cutSelection() {
    const text = this.copySelection();
    if (!text) return "";
    this.backspace();
    return text;
  }

  pasteText(text) {
    if (!text) return;
    this.insert(text.replace(/\r\n/g, "\n"));
  }

  _ensureCursorVisible() {
    const primary = this.carets[0];
    if (primary) {
      if (this.folding) this.folding.expandContaining(primary.line, this.buffer);
      if (!this.viewport._cache) this.viewport.computeVisible(this.buffer.lines);
      this.viewport.ensurePositionVisible(primary.line, primary.col);
    }
    this._dirty = true;
    this._blinkPhase = 0;
    this._lastInput = Date.now();
    const doc = this.activeDoc;
    if (doc) {
      doc.scrollTop = this.viewport.scrollTop;
      doc.scrollLeft = this.viewport.scrollLeft;
    }
  }

  hitTest(mouseX, mouseY) {
    return this.renderer.hitTest(mouseX, mouseY, this.viewport, this.buffer);
  }

  clickAt(mouseX, mouseY, extend) {
    const pos = this.hitTest(mouseX, mouseY);
    if (extend && this.carets.length > 0) {
      const primary = this.carets[0];
      if (!primary.anchor) {
        primary.anchor = { line: primary.line, col: primary.col };
      }
      primary.line = pos.line;
      primary.col = pos.col;
    } else {
      this.carets = [new Caret(pos.line, pos.col)];
      this.controller.carets = this.carets;
    }
    this.viewport.ensurePositionVisible(pos.line, pos.col);
    this._dirty = true;
    this._blinkPhase = 0;
    this._lastInput = Date.now();
    this._emitCursor();
  }

  dragTo(mouseX, mouseY) {
    const pos = this.hitTest(mouseX, mouseY);
    const primary = this.carets[0];
    if (!primary.anchor) {
      primary.anchor = { line: primary.line, col: primary.col };
    }
    primary.line = pos.line;
    primary.col = pos.col;
    this.viewport.ensurePositionVisible(pos.line, pos.col);
    this._dirty = true;
    this._blinkPhase = 0;
    this._lastInput = Date.now();
    this._emitCursor();
    if (this.onSelectionChange) this.onSelectionChange(this.getSelection());
  }

  markClean() {
    this._dirty = false;
    if (this.activeDoc) {
      this.activeDoc.dirty = false;
      if (this.onDocumentsChange) this.onDocumentsChange(this.documents);
    }
  }

  isDirty() {
    return this._dirty;
  }

  getLayout() {
    return {
      lineHeight: this.renderer.lineHeight,
      charWidth: this.renderer.charWidth,
      gutterWidth: this.renderer.gutterWidth,
      padTop: this.renderer.padTop,
      width: this.width,
      height: this.height,
    };
  }

  render(ctx) {
    const active = this.carets[0];
    this.renderer.render(ctx, this.buffer, this.viewport, this.highlighter, {
      currentLine: active ? active.line : null,
      activeLine: active ? active.line : null,
      carets: this.carets,
      decorations: this.decorations.items,
      diagnostics: this.diagnostics,
      cursorVisible: this.cursorHidden ? false : this.isCursorVisible(),
    });
    this._dirty = false;
  }

  tickBlink(now) {
    if (now - this._lastInput > 500) {
      const since = now - this._lastInput - 500;
      this._blinkPhase = Math.floor(since / 530) % 2;
    } else {
      this._blinkPhase = 0;
    }
  }

  isCursorVisible() {
    return this._blinkPhase === 0;
  }

  notifyInput() {
    this._lastInput = Date.now();
    this._blinkPhase = 0;
  }

  invalidate() {
    this._dirty = true;
  }

  needsRender() {
    return this._dirty;
  }
}