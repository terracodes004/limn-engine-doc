export class ContextMenu {
  constructor(options) {
    options = options || {};
    this.items = options.items || [];
    this._el = null;
    this._open = false;
    this._onDismiss = options.onDismiss || null;
  }
  
  setItems(items) {
    this.items = items || [];
  }
  
  show(x, y) {
    this._build();
    if (!this._el) return;
    
    this._el.style.left = "0px";
    this._el.style.top = "0px";
    this._el.classList.add("open");
    this._open = true;
    
    const rect = this._el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = y - rect.height;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    
    this._el.style.left = left + "px";
    this._el.style.top = top + "px";
  }
  
  _build() {
    if (!this._el) {
      const el = document.createElement("div");
      el.className = "limn-contextmenu";
      document.body.appendChild(el);
      this._el = el;
      
      const dismiss = (e) => {
        if (!this._open) return;
        if (this._el.contains(e.target)) return;
        this.hide();
        if (this._onDismiss) this._onDismiss();
      };
      document.addEventListener("mousedown", dismiss);
      document.addEventListener("touchstart", dismiss);
    }
    
    this._el.innerHTML = "";
    
    for (const item of this.items) {
      if (item.divider) {
        const d = document.createElement("div");
        d.className = "limn-contextmenu-divider";
        this._el.appendChild(d);
        continue;
      }
      
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-contextmenu-item";
      if (item.disabled) btn.disabled = true;
      
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
      
      let lastFire = 0;
      const fire = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastFire < 250) return;
        lastFire = now;
        this.hide();
        if (item.action) item.action();
      };
      
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("touchend", fire, { passive: false });
      btn.addEventListener("click", fire);
      
      this._el.appendChild(btn);
    }
  }
  
  hide() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
  }
  
  isOpen() {
    return this._open;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}