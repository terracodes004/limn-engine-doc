export class StatusBar {
  constructor(options) {
    options = options || {};
    this.onGotoLine = options.onGotoLine || null;
    this.onCycleTabSize = options.onCycleTabSize || null;
    this.onPickLanguage = options.onPickLanguage || null;
    this.onToggleLineEnding = options.onToggleLineEnding || null;
    this.onShowStats = options.onShowStats || null;
    this.onToggleWrap = options.onToggleWrap || null;
    this.onShowDiagnostics = options.onShowDiagnostics || null;
    this.onToggleMinimap = options.onToggleMinimap || null;
    this.onScrollTop = options.onScrollTop || null;
    
    this._el = null;
    this._topEl = null;
    this._posEl = null;
    this._selEl = null;
    this._spEl = null;
    this._langEl = null;
    this._lfEl = null;
    this._savedEl = null;
    this._statsEl = null;
    this._wrapEl = null;
    this._diagEl = null;
    this._minimapEl = null;
    
    this._cursor = { line: 0, col: 0 };
    this._sel = 0;
    this._tabSize = 4;
    this._lang = "JavaScript";
    this._lineEnding = "LF";
    this._savedState = "ready";
    this._stats = "—";
    this._wrap = true;
    this._errors = 0;
    this._warnings = 0;
    this._minimap = true;
    this._cursors = 1;
  }
  
  mount(parent) {
    const bar = document.createElement("div");
    bar.className = "limn-statusbar";
    
    const left = document.createElement("div");
    left.className = "limn-statusbar-left";
    
    const topEl = this._makeItem("↑", "Scroll to top", () => {
      if (this.onScrollTop) this.onScrollTop();
    });
    topEl.classList.add("scrolltop");
    left.appendChild(topEl);
    this._topEl = topEl;
    
    const posEl = this._makeItem("Ln 1, Col 1", "Position — tap to go to line", () => {
      if (this.onGotoLine) this.onGotoLine();
    });
    left.appendChild(posEl);
    this._posEl = posEl;
    
    const selEl = this._makeItem("0 selected", "Selection", null);
    selEl.classList.add("hidden");
    left.appendChild(selEl);
    this._selEl = selEl;
    
    const statsEl = this._makeItem("—", "Statistics — tap for details", () => {
      if (this.onShowStats) this.onShowStats(statsEl);
    });
    left.appendChild(statsEl);
    this._statsEl = statsEl;
    
    bar.appendChild(left);
    
    const right = document.createElement("div");
    right.className = "limn-statusbar-right";
    
    const diagEl = this._makeItem("✓", "Diagnostics — tap for details", () => {
      if (this.onShowDiagnostics) this.onShowDiagnostics(diagEl);
    });
    diagEl.classList.add("diag-ok");
    right.appendChild(diagEl);
    this._diagEl = diagEl;
    
    const wrapEl = this._makeItem("Wrap: on", "Word wrap — tap to toggle", () => {
      if (this.onToggleWrap) this.onToggleWrap();
    });
    right.appendChild(wrapEl);
    this._wrapEl = wrapEl;
    
    const minimapEl = this._makeItem("▤ on", "Minimap — tap to toggle", () => {
      if (this.onToggleMinimap) this.onToggleMinimap();
    });
    minimapEl.classList.add("minimap-on");
    right.appendChild(minimapEl);
    this._minimapEl = minimapEl;
    
    const spEl = this._makeItem("Sp: 4", "Tab size — tap to change", () => {
      if (this.onCycleTabSize) this.onCycleTabSize();
    });
    right.appendChild(spEl);
    this._spEl = spEl;
    
    const langEl = this._makeItem("JavaScript", "Language — tap to change", () => {
      if (this.onPickLanguage) this.onPickLanguage();
    });
    right.appendChild(langEl);
    this._langEl = langEl;
    
    const lfEl = this._makeItem("LF", "Line ending — tap to toggle", () => {
      if (this.onToggleLineEnding) this.onToggleLineEnding();
    });
    right.appendChild(lfEl);
    this._lfEl = lfEl;
    
    const savedEl = this._makeItem("Ready", "Status", null);
    savedEl.classList.add("status-saved");
    right.appendChild(savedEl);
    this._savedEl = savedEl;
    
    bar.appendChild(right);
    
    parent.appendChild(bar);
    this._el = bar;
  }
  
  _makeItem(text, title, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "limn-statusbar-item";
    el.textContent = text;
    el.title = title || "";
    el.setAttribute("aria-label", title || text);
    
    if (onClick) {
      let lastFire = 0;
      const fire = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastFire < 250) return;
        lastFire = now;
        onClick(e);
      };
      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener("touchend", fire, { passive: false });
      el.addEventListener("click", fire);
    } else {
      el.disabled = true;
      el.classList.add("static");
    }
    return el;
  }
  
  setCursor(line, col) {
    this._cursor = { line: line || 0, col: col || 0 };
    if (!this._posEl) return;
    let text = "Ln " + (this._cursor.line + 1) + ", Col " + (this._cursor.col + 1);
    if (this._cursors > 1) {
      text += " · " + this._cursors + " cursors";
    }
    this._posEl.textContent = text;
  }
  
  setCursors(n) {
    this._cursors = n || 1;
    if (!this._posEl) return;
    const cursor = this._cursor || { line: 0, col: 0 };
    let text = "Ln " + (cursor.line + 1) + ", Col " + (cursor.col + 1);
    if (this._cursors > 1) {
      text += " · " + this._cursors + " cursors";
    }
    this._posEl.textContent = text;
  }
  
  setSelection(count) {
    this._sel = count || 0;
    if (!this._selEl) return;
    if (this._sel > 0) {
      this._selEl.textContent = this._sel + " selected";
      this._selEl.classList.remove("hidden");
    } else {
      this._selEl.classList.add("hidden");
    }
  }
  
  setTabSize(size) {
    this._tabSize = size || 4;
    if (this._spEl) this._spEl.textContent = "Sp: " + this._tabSize;
  }
  
  setLanguage(name) {
    this._lang = name || "Plain Text";
    if (this._langEl) this._langEl.textContent = this._lang;
  }
  
  setLineEnding(le) {
    this._lineEnding = (le || "lf").toUpperCase() === "CRLF" ? "CRLF" : "LF";
    if (this._lfEl) this._lfEl.textContent = this._lineEnding;
  }
  
  setSaved(state) {
    this._savedState = state;
    if (!this._savedEl) return;
    this._savedEl.classList.remove("status-saved", "status-dirty", "status-saving");
    if (state === "saved") {
      this._savedEl.textContent = "Saved";
      this._savedEl.classList.add("status-saved");
    } else if (state === "dirty") {
      this._savedEl.textContent = "Unsaved";
      this._savedEl.classList.add("status-dirty");
    } else if (state === "saving") {
      this._savedEl.textContent = "Saving…";
      this._savedEl.classList.add("status-saving");
    } else {
      this._savedEl.textContent = "Ready";
      this._savedEl.classList.add("status-saved");
    }
  }
  
  setStats(text) {
    this._stats = text || "—";
    if (this._statsEl) this._statsEl.textContent = this._stats;
  }
  
  setWordWrap(on) {
    this._wrap = !!on;
    if (this._wrapEl) {
      this._wrapEl.textContent = on ? "Wrap: on" : "Wrap: off";
      this._wrapEl.classList.toggle("wrap-on", !!on);
      this._wrapEl.classList.toggle("wrap-off", !on);
    }
  }
  
  setMinimap(on) {
    this._minimap = !!on;
    if (this._minimapEl) {
      this._minimapEl.textContent = on ? "▤ on" : "▤ off";
      this._minimapEl.classList.toggle("minimap-on", !!on);
      this._minimapEl.classList.toggle("minimap-off", !on);
    }
  }
  
  setDiagnostics(errors, warnings) {
    this._errors = errors || 0;
    this._warnings = warnings || 0;
    if (!this._diagEl) return;
    this._diagEl.classList.remove("diag-ok", "diag-warn", "diag-err");
    if (this._errors > 0) {
      this._diagEl.textContent = this._errors + " ✕";
      this._diagEl.classList.add("diag-err");
    } else if (this._warnings > 0) {
      this._diagEl.textContent = this._warnings + " !";
      this._diagEl.classList.add("diag-warn");
    } else {
      this._diagEl.textContent = "✓";
      this._diagEl.classList.add("diag-ok");
    }
  }
  
  height() {
    return this._el ? 26 : 0;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}