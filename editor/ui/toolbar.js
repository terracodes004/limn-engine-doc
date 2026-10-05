export class Toolbar {
  constructor(options) {
    options = options || {};
    this.onUndo = options.onUndo || null;
    this.onRedo = options.onRedo || null;
    this.onTab = options.onTab || null;
    this.onEnter = options.onEnter || null;
    this.onMenu = options.onMenu || null;
    
    this._el = null;
    this._undoBtn = null;
    this._redoBtn = null;
  }
  
  mount(parent) {
    const bar = document.createElement("div");
    bar.className = "limn-toolbar";
    
    this._undoBtn = this._makeBtn("↶", "Undo", () => {
      if (this.onUndo) this.onUndo();
    });
    this._redoBtn = this._makeBtn("↷", "Redo", () => {
      if (this.onRedo) this.onRedo();
    });
    const tabBtn = this._makeBtn("⇥", "Tab", () => {
      if (this.onTab) this.onTab();
    });
    const enterBtn = this._makeBtn("↵", "Enter", () => {
      if (this.onEnter) this.onEnter();
    });
    const menuBtn = this._makeBtn("⋯", "More", () => {
      if (this.onMenu) this.onMenu();
    });
    
    bar.appendChild(this._undoBtn);
    bar.appendChild(this._redoBtn);
    bar.appendChild(tabBtn);
    bar.appendChild(enterBtn);
    bar.appendChild(menuBtn);
    
    parent.appendChild(bar);
    this._el = bar;
  }
  
  _makeBtn(glyph, title, onClick) {
    const b = document.createElement("button");
    b.className = "limn-toolbar-btn";
    b.type = "button";
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    
    let lastFire = 0;
    const fire = (e) => {
      if (e) e.preventDefault();
      const now = Date.now();
      if (now - lastFire < 300) return;
      lastFire = now;
      onClick();
    };
    
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("touchend", fire, { passive: false });
    b.addEventListener("click", fire);
    return b;
  }
  
  show() {
    if (this._el) this._el.classList.remove("hidden");
  }
  
  hide() {
    if (this._el) this._el.classList.add("hidden");
  }
  
  setUndoEnabled(v) {
    if (this._undoBtn) this._undoBtn.disabled = !v;
  }
  
  setRedoEnabled(v) {
    if (this._redoBtn) this._redoBtn.disabled = !v;
  }
  
  height() {
    return this._el && !this._el.classList.contains("hidden") ? 52 : 0;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}