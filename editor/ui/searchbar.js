export class SearchBar {
  constructor(options) {
    options = options || {};
    this.onFind = options.onFind || null;
    this.onFindNext = options.onFindNext || null;
    this.onFindPrev = options.onFindPrev || null;
    this.onReplaceOne = options.onReplaceOne || null;
    this.onReplaceAll = options.onReplaceAll || null;
    this.onClose = options.onClose || null;
    this.onQueryChange = options.onQueryChange || null;
    
    this._el = null;
    this._findInput = null;
    this._replaceInput = null;
    this._countEl = null;
    this._replaceRow = null;
    this._caseBtn = null;
    this._wordBtn = null;
    this._regexBtn = null;
    this._open = false;
    this._options = { caseSensitive: false, wholeWord: false, regex: false };
  }
  
  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-search";
    
    const row1 = document.createElement("div");
    row1.className = "limn-search-row";
    
    const findInput = document.createElement("input");
    findInput.type = "text";
    findInput.className = "limn-search-input";
    findInput.placeholder = "Find";
    findInput.setAttribute("autocomplete", "off");
    findInput.setAttribute("autocorrect", "off");
    findInput.setAttribute("autocapitalize", "off");
    findInput.setAttribute("spellcheck", "false");
    findInput.addEventListener("input", () => {
      if (this.onQueryChange) this.onQueryChange(this._readState());
    });
    findInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          if (this.onFindPrev) this.onFindPrev();
        } else {
          if (this.onFindNext) this.onFindNext();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        if (this.onClose) this.onClose();
      }
    });
    row1.appendChild(findInput);
    this._findInput = findInput;
    
    const caseBtn = this._toggleBtn("Aa", "Match case", () => {
      this._options.caseSensitive = !this._options.caseSensitive;
      this._syncToggles();
      if (this.onQueryChange) this.onQueryChange(this._readState());
    });
    row1.appendChild(caseBtn);
    this._caseBtn = caseBtn;
    
    const wordBtn = this._toggleBtn("W", "Whole word", () => {
      this._options.wholeWord = !this._options.wholeWord;
      this._syncToggles();
      if (this.onQueryChange) this.onQueryChange(this._readState());
    });
    row1.appendChild(wordBtn);
    this._wordBtn = wordBtn;
    
    const regexBtn = this._toggleBtn(".*", "Regex", () => {
      this._options.regex = !this._options.regex;
      this._syncToggles();
      if (this.onQueryChange) this.onQueryChange(this._readState());
    });
    row1.appendChild(regexBtn);
    this._regexBtn = regexBtn;
    
    const count = document.createElement("span");
    count.className = "limn-search-count";
    count.textContent = "0/0";
    row1.appendChild(count);
    this._countEl = count;
    
    const prevBtn = this._iconBtn("↑", "Previous", () => {
      if (this.onFindPrev) this.onFindPrev();
    });
    row1.appendChild(prevBtn);
    
    const nextBtn = this._iconBtn("↓", "Next", () => {
      if (this.onFindNext) this.onFindNext();
    });
    row1.appendChild(nextBtn);
    
    const closeBtn = this._iconBtn("✕", "Close", () => {
      this.close();
      if (this.onClose) this.onClose();
    });
    row1.appendChild(closeBtn);
    
    el.appendChild(row1);
    
    const row2 = document.createElement("div");
    row2.className = "limn-search-row limn-search-replace-row";
    
    const replaceInput = document.createElement("input");
    replaceInput.type = "text";
    replaceInput.className = "limn-search-input";
    replaceInput.placeholder = "Replace";
    replaceInput.setAttribute("autocomplete", "off");
    replaceInput.setAttribute("autocorrect", "off");
    replaceInput.setAttribute("autocapitalize", "off");
    replaceInput.setAttribute("spellcheck", "false");
    replaceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (this.onReplaceOne) this.onReplaceOne();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        if (this.onClose) this.onClose();
      }
    });
    row2.appendChild(replaceInput);
    this._replaceInput = replaceInput;
    
    const replaceOneBtn = document.createElement("button");
    replaceOneBtn.type = "button";
    replaceOneBtn.className = "limn-search-btn";
    replaceOneBtn.textContent = "Replace";
    replaceOneBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.onReplaceOne) this.onReplaceOne();
    });
    row2.appendChild(replaceOneBtn);
    
    const replaceAllBtn = document.createElement("button");
    replaceAllBtn.type = "button";
    replaceAllBtn.className = "limn-search-btn";
    replaceAllBtn.textContent = "All";
    replaceAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.onReplaceAll) this.onReplaceAll();
    });
    row2.appendChild(replaceAllBtn);
    
    el.appendChild(row2);
    this._replaceRow = row2;
    
    parent.appendChild(el);
    this._el = el;
  }
  
  _toggleBtn(glyph, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "limn-search-toggle";
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  
  _iconBtn(glyph, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "limn-search-icon";
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  
  _syncToggles() {
    if (this._caseBtn) this._caseBtn.classList.toggle("active", this._options.caseSensitive);
    if (this._wordBtn) this._wordBtn.classList.toggle("active", this._options.wholeWord);
    if (this._regexBtn) this._regexBtn.classList.toggle("active", this._options.regex);
  }
  
  _readState() {
    return {
      query: this._findInput ? this._findInput.value : "",
      replacement: this._replaceInput ? this._replaceInput.value : "",
      options: {
        caseSensitive: this._options.caseSensitive,
        wholeWord: this._options.wholeWord,
        regex: this._options.regex,
      },
    };
  }
  
  open(withReplace) {
    if (!this._el) return;
    this._el.classList.add("open");
    if (withReplace) {
      this._el.classList.add("with-replace");
    } else {
      this._el.classList.remove("with-replace");
    }
    this._open = true;
    setTimeout(() => {
      if (this._findInput) this._findInput.focus();
    }, 30);
  }
  
  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    if (this._findInput) this._findInput.blur();
  }
  
  isOpen() {
    return this._open;
  }
  
  setCount(current, total) {
    if (this._countEl) {
      this._countEl.textContent = (current || 0) + "/" + (total || 0);
    }
  }
  
  getQuery() {
    return this._findInput ? this._findInput.value : "";
  }
  
  getReplacement() {
    return this._replaceInput ? this._replaceInput.value : "";
  }
  
  getOptions() {
    return {
      caseSensitive: this._options.caseSensitive,
      wholeWord: this._options.wholeWord,
      regex: this._options.regex,
    };
  }
  
  height() {
    if (!this._el || !this._el.classList.contains("open")) return 0;
    return this._el.classList.contains("with-replace") ? 96 : 52;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}