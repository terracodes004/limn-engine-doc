import { TextBuffer } from "./buffer.js";
import { Caret } from "./caret.js";
import { History } from "./history.js";
import { Viewport } from "./viewport.js";
import { Highlighter } from "./highlighter.js";
import { languageForFilename } from "./languages.js";

let _nextId = 1;

export class Document {
  constructor(options) {
    options = options || {};
    this.id = _nextId++;
    this.name = options.name || "untitled.js";
    this.buffer = new TextBuffer(options.value || "");
    this.carets = [new Caret(0, 0)];
    this.history = new History(options.maxUndo || 500);
    this.viewport = new Viewport();
    const lang = options.language || languageForFilename(this.name);
    this.highlighter = new Highlighter(lang);
    this.languageKey = null;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.dirty = false;
    this.onChange = null;
  }
  
  getValue() {
    return this.buffer.getText();
  }
  
  setValue(text) {
    this.buffer.setText(String(text == null ? "" : text));
    this.carets = [new Caret(0, 0)];
    this.history.clear();
    this.highlighter.invalidateAll();
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.dirty = false;
  }
  
  getCursor() {
    const c = this.carets[0];
    return { line: c.line, col: c.col };
  }
  
  setCursor(line, col) {
    this.carets = [new Caret(line, col)];
  }
  
  setName(newName) {
    this.name = newName;
    const lang = languageForFilename(newName);
    if (lang && this.highlighter.language !== lang) {
      this.highlighter.language = lang;
      this.highlighter.invalidateAll();
    }
  }
}

export class Documents {
  constructor(options) {
    options = options || {};
    this.items = [];
    this.activeIndex = -1;
    this.maxUndo = options.maxUndo || 500;
    this.onActiveChange = options.onActiveChange || null;
    this.onListChange = options.onListChange || null;
  }
  
  get active() {
    return this.activeIndex >= 0 ? this.items[this.activeIndex] : null;
  }
  
  count() {
    return this.items.length;
  }
  
  add(options) {
    const doc = new Document({
      name: (options && options.name) || this._uniqueName(),
      value: (options && options.value) || "",
      maxUndo: this.maxUndo,
      language: options && options.language,
    });
    this.items.push(doc);
    this.activeIndex = this.items.length - 1;
    if (this.onListChange) this.onListChange(this.items);
    if (this.onActiveChange) this.onActiveChange(doc, this.activeIndex);
    return doc;
  }
  
  _uniqueName() {
    let n = 1;
    const existing = new Set(this.items.map((d) => d.name));
    let name = "untitled-" + n + ".js";
    while (existing.has(name)) {
      n++;
      name = "untitled-" + n + ".js";
    }
    return name;
  }
  
  switchTo(index) {
    if (index < 0 || index >= this.items.length) return false;
    if (index === this.activeIndex) return false;
    const prev = this.active;
    if (prev) {
      prev.scrollTop = prev.viewport.scrollTop;
      prev.scrollLeft = prev.viewport.scrollLeft;
    }
    this.activeIndex = index;
    const next = this.active;
    next.viewport.setScroll(next.scrollTop, next.scrollLeft);
    if (this.onActiveChange) this.onActiveChange(next, index);
    return true;
  }
  
  switchToId(id) {
    const idx = this.items.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    return this.switchTo(idx);
  }
  
  close(index) {
    if (index < 0 || index >= this.items.length) return false;
    const wasActive = index === this.activeIndex;
    this.items.splice(index, 1);
    
    if (this.items.length === 0) {
      this.activeIndex = -1;
    } else if (wasActive) {
      this.activeIndex = Math.min(index, this.items.length - 1);
    } else if (index < this.activeIndex) {
      this.activeIndex--;
    }
    
    if (this.onListChange) this.onListChange(this.items);
    if (this.onActiveChange) this.onActiveChange(this.active, this.activeIndex);
    return true;
  }
  
  closeId(id) {
    const idx = this.items.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    return this.close(idx);
  }
  
  rename(index, newName) {
    if (index < 0 || index >= this.items.length) return false;
    const name = String(newName || "").trim();
    if (!name) return false;
    this.items[index].setName(name);
    if (this.onListChange) this.onListChange(this.items);
    return true;
  }
  
  renameActive(newName) {
    return this.rename(this.activeIndex, newName);
  }
  
  markDirty(index) {
    if (index === undefined) index = this.activeIndex;
    if (index < 0 || index >= this.items.length) return;
    const doc = this.items[index];
    if (!doc.dirty) {
      doc.dirty = true;
      if (this.onListChange) this.onListChange(this.items);
    }
  }
  
  markClean(index) {
    if (index === undefined) index = this.activeIndex;
    if (index < 0 || index >= this.items.length) return;
    const doc = this.items[index];
    if (doc.dirty) {
      doc.dirty = false;
      if (this.onListChange) this.onListChange(this.items);
    }
  }
  
  findByName(name) {
    return this.items.find((d) => d.name === name) || null;
  }
  
  indexOfName(name) {
    return this.items.findIndex((d) => d.name === name);
  }
  
  getByIndex(index) {
    if (index < 0 || index >= this.items.length) return null;
    return this.items[index];
  }
  
  getById(id) {
    return this.items.find((d) => d.id === id) || null;
  }
}