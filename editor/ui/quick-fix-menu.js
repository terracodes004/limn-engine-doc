export class QuickFixMenu {
  constructor(options) {
    options = options || {};
    this.onPick = options.onPick || null;
    this._el = null;
    this._open = false;
    this._items = [];
  }
  
  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-quickfix";
    parent.appendChild(el);
    this._el = el;
  }
  
  show(clientX, clientY, fixes) {
    if (!this._el) return;
    if (!fixes || fixes.length === 0) return;
    this._items = fixes;
    this._render();
    this._el.classList.add("open");
    this._open = true;
    
    this._el.style.left = "0px";
    this._el.style.top = "0px";
    const rect = this._el.getBoundingClientRect();
    let left = clientX;
    let top = clientY;
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = clientY - rect.height - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    this._el.style.left = left + "px";
    this._el.style.top = top + "px";
    
    const close = (ev) => {
      if (this._el.contains(ev.target)) return;
      this.hide();
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
    setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
  }
  
  _render() {
    if (!this._el) return;
    this._el.innerHTML = "";
    
    const header = document.createElement("div");
    header.className = "limn-quickfix-header";
    header.textContent = "Fix";
    this._el.appendChild(header);
    
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-quickfix-item";
      btn.textContent = item.label;
      
      let lastFire = 0;
      const fire = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastFire < 250) return;
        lastFire = now;
        const picked = this._items[i];
        this.hide();
        if (this.onPick && picked) this.onPick(picked);
      };
      
      btn.addEventListener("mousedown", fire);
      btn.addEventListener("touchend", fire, { passive: false });
      btn.addEventListener("click", fire);
      
      this._el.appendChild(btn);
    }
  }
  
  hide() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    this._items = [];
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