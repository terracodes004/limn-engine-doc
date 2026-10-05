export class AppBar {
  constructor(options) {
    options = options || {};
    this.onFiles = options.onFiles || null;
    this.onSearch = options.onSearch || null;
    this.onNew = options.onNew || null;
    this.onMenu = options.onMenu || null;
    this.onSymbols = options.onSymbols || null;
    this.onTitle = options.onTitle || null;
    
    this._el = null;
    this._titleEl = null;
    this._menuBtn = null;
    this._filesBtn = null;
  }
  
  mount(parent) {
    const bar = document.createElement("div");
    bar.className = "limn-appbar";
    
    const filesBtn = this._makeIconBtn("☰", "Files", () => {
      if (this.onFiles) this.onFiles();
    });
    bar.appendChild(filesBtn);
    this._filesBtn = filesBtn;
    
    const title = document.createElement("div");
    title.className = "limn-appbar-title";
    title.textContent = "";
    title.addEventListener("click", () => {
      if (this.onTitle) this.onTitle();
    });
    bar.appendChild(title);
    this._titleEl = title;
    
    const spacer = document.createElement("span");
    spacer.className = "limn-appbar-spacer";
    bar.appendChild(spacer);
    
    const symBtn = this._makeIconBtn("ƒ", "Jump to symbol", () => {
      if (this.onSymbols) this.onSymbols();
    });
    bar.appendChild(symBtn);
    
    const searchBtn = this._makeIconBtn("🔍", "Find", () => {
      if (this.onSearch) this.onSearch();
    });
    bar.appendChild(searchBtn);
    
    const newBtn = this._makeIconBtn("＋", "New file", () => {
      if (this.onNew) this.onNew();
    });
    bar.appendChild(newBtn);
    
    const menuBtn = this._makeIconBtn("⋯", "More", () => {
      if (this.onMenu) this.onMenu();
    });
    bar.appendChild(menuBtn);
    this._menuBtn = menuBtn;
    
    parent.appendChild(bar);
    this._el = bar;
  }
  
  _makeIconBtn(glyph, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "limn-appbar-btn";
    b.textContent = glyph;
    b.title = title;
    b.setAttribute("aria-label", title);
    
    let lastFire = 0;
    const fire = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = Date.now();
      if (now - lastFire < 280) return;
      lastFire = now;
      onClick();
    };
    
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("touchend", fire, { passive: false });
    b.addEventListener("click", fire);
    return b;
  }
  
  setTitle(text) {
    if (this._titleEl) this._titleEl.textContent = text || "";
  }
  
  setFilesActive(active) {
    if (!this._filesBtn) return;
    this._filesBtn.classList.toggle("active", !!active);
  }
  
  show() {
    if (this._el) this._el.classList.remove("hidden");
  }
  
  hide() {
    if (this._el) this._el.classList.add("hidden");
  }
  
  height() {
    if (!this._el || this._el.classList.contains("hidden")) return 0;
    return 48;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}