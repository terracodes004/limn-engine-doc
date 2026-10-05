export class FloatingMenu {
  constructor(options) {
    options = options || {};
    this.items = options.items || [];
    this.rows = options.rows || [];
    this.onOpen = options.onOpen || null;
    this._el = null;
    this._fab = null;
    this._open = false;
  }
  
  mount(parent) {
    const fab = document.createElement("button");
    fab.className = "limn-fab";
    fab.type = "button";
    fab.title = "Menu";
    fab.setAttribute("aria-label", "Menu");
    
    const icon = document.createElement("span");
    icon.className = "limn-fab-icon";
    icon.textContent = "＋";
    fab.appendChild(icon);
    
    let lastFire = 0;
    const fire = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = Date.now();
      if (now - lastFire < 300) return;
      lastFire = now;
      this.toggle();
    };
    
    fab.addEventListener("mousedown", (e) => e.preventDefault());
    fab.addEventListener("touchend", fire, { passive: false });
    fab.addEventListener("click", fire);
    parent.appendChild(fab);
    this._fab = fab;
    
    const menu = document.createElement("div");
    menu.className = "limn-menu";
    parent.appendChild(menu);
    this._el = menu;
    
    document.addEventListener("click", (e) => {
      if (!this._open) return;
      if (this._el.contains(e.target) || this._fab.contains(e.target)) return;
      this.close();
    });
  }
  
  build() {
    if (!this._el) return;
    this._el.innerHTML = "";
    
    for (const item of this.items) {
      if (item.divider) {
        const d = document.createElement("div");
        d.className = "limn-menu-divider";
        this._el.appendChild(d);
        continue;
      }
      if (item.header) {
        const h = document.createElement("div");
        h.className = "limn-menu-header";
        h.textContent = item.header;
        this._el.appendChild(h);
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "limn-menu-item";
      btn.type = "button";
      
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = item.icon || "";
      btn.appendChild(icon);
      
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label || "";
      btn.appendChild(label);
      
      if (item.shortcut) {
        const sc = document.createElement("span");
        sc.className = "shortcut";
        sc.textContent = item.shortcut;
        btn.appendChild(sc);
      }
      
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
        if (item.action) item.action();
      });
      
      this._el.appendChild(btn);
    }
    
    for (const row of this.rows) {
      const wrap = document.createElement("div");
      wrap.className = "limn-menu-row";
      
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = row.label;
      wrap.appendChild(label);
      
      if (row.onDecrement) {
        const dec = document.createElement("button");
        dec.className = "limn-menu-row-btn";
        dec.type = "button";
        dec.textContent = "−";
        dec.setAttribute("aria-label", "Decrease");
        dec.addEventListener("click", (e) => {
          e.preventDefault();
          row.onDecrement();
          this.build();
        });
        wrap.appendChild(dec);
      }
      
      if (row.value !== undefined) {
        const val = document.createElement("span");
        val.className = "value";
        val.textContent = String(row.value);
        wrap.appendChild(val);
      }
      
      if (row.onIncrement) {
        const inc = document.createElement("button");
        inc.className = "limn-menu-row-btn";
        inc.type = "button";
        inc.textContent = "+";
        inc.setAttribute("aria-label", "Increase");
        inc.addEventListener("click", (e) => {
          e.preventDefault();
          row.onIncrement();
          this.build();
        });
        wrap.appendChild(inc);
      }
      
      this._el.appendChild(wrap);
    }
  }
  
  open() {
    if (!this._el) return;
    this.build();
    if (this.onOpen) this.onOpen();
    this._el.classList.add("open");
    if (this._fab) this._fab.classList.add("open");
    this._open = true;
  }
  
  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    if (this._fab) this._fab.classList.remove("open");
    this._open = false;
  }
  
  toggle() {
    if (this._open) this.close();
    else this.open();
  }
  
  isOpen() {
    return this._open;
  }
  
  showFab() {
    if (this._fab) this._fab.classList.remove("hidden");
  }
  
  hideFab() {
    if (this._fab) this._fab.classList.add("hidden");
  }
  
  destroy() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    if (this._fab && this._fab.parentNode) this._fab.parentNode.removeChild(this._fab);
    this._el = null;
    this._fab = null;
  }
}