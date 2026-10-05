export class Autocomplete {
  constructor(options) {
    options = options || {};
    this.onAccept = options.onAccept || null;
    this.onDismiss = options.onDismiss || null;
    
    this._el = null;
    this._list = null;
    this._items = [];
    this._selected = 0;
    this._open = false;
    this._anchor = { x: 0, y: 0 };
  }
  
  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-autocomplete";
    el.style.pointerEvents = "auto";
    el.style.touchAction = "none";
    el.setAttribute("tabindex", "-1");
    
    const list = document.createElement("div");
    list.className = "limn-autocomplete-list";
    list.setAttribute("tabindex", "-1");
    el.appendChild(list);
    this._list = list;
    
    let lastFire = 0;
    const handleSelect = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
      const now = Date.now();
      if (now - lastFire < 250) return;
      lastFire = now;
      
      const target = e.target && e.target.closest ?
        e.target.closest(".limn-autocomplete-item") :
        null;
      if (!target) return;
      const idx = parseInt(target.dataset.index, 10);
      if (isNaN(idx)) return;
      const item = this._items[idx];
      if (!item) return;
      this.hide();
      if (this.onAccept) this.onAccept(item);
    };
    
    list.addEventListener("mousedown", handleSelect);
    list.addEventListener("touchstart", handleSelect, { passive: false });
    list.addEventListener("click", handleSelect);
    
    parent.appendChild(el);
    this._el = el;
  }
  
  show(x, y, items, selectedIndex) {
    if (!this._el) return;
    if (!items || items.length === 0) {
      this.hide();
      return;
    }
    
    this._items = items;
    this._selected = Math.max(0, Math.min(selectedIndex || 0, items.length - 1));
    this._anchor.x = x;
    this._anchor.y = y;
    
    this._render();
    this._el.classList.add("open");
    this._open = true;
    
    this._el.style.left = "0px";
    this._el.style.top = "0px";
    const rect = this._el.getBoundingClientRect();
    
    let left = x;
    let top = y;
    
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;
    
    if (top + rect.height > window.innerHeight - 8) {
      top = y - rect.height - 30;
    }
    if (top < 8) top = 8;
    
    this._el.style.left = left + "px";
    this._el.style.top = top + "px";
  }
  
  _render() {
    if (!this._list) return;
    this._list.innerHTML = "";
    
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const row = document.createElement("div");
      row.className = "limn-autocomplete-item" + (i === this._selected ? " selected" : "");
      row.dataset.index = i;
      row.setAttribute("tabindex", "-1");
      
      const kind = document.createElement("span");
      kind.className = "kind kind-" + (item.kind || "word");
      kind.textContent = this._badgeFor(item.kind);
      row.appendChild(kind);
      
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.word;
      row.appendChild(label);
      
      this._list.appendChild(row);
    }
    
    const selectedEl = this._list.querySelector(".selected");
    if (selectedEl && selectedEl.scrollIntoView) {
      try {
        selectedEl.scrollIntoView({ block: "nearest" });
      } catch (e) {}
    }
  }
  
  _badgeFor(kind) {
    if (kind === "keyword") return "K";
    if (kind === "builtin") return "B";
    if (kind === "literal") return "L";
    if (kind === "tag") return "<>";
    if (kind === "value") return "V";
    if (kind === "atrule") return "@";
    if (kind === "pseudo") return ":";
    if (kind === "property") return "P";
    return "W";
  }
  
  moveSelection(delta) {
    if (!this._open || this._items.length === 0) return;
    this._selected = (this._selected + delta + this._items.length) % this._items.length;
    this._render();
  }
  
  getSelected() {
    if (!this._open) return null;
    return this._items[this._selected] || null;
  }
  
  accept() {
    if (!this._open) return false;
    const item = this.getSelected();
    if (!item) return false;
    this.hide();
    if (this.onAccept) this.onAccept(item);
    return true;
  }
  
  hide() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    this._items = [];
    if (this.onDismiss) this.onDismiss();
  }
  
  isOpen() {
    return this._open;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}