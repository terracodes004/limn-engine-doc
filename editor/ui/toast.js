export class Toast {
  constructor() {
    this._el = null;
    this._timer = null;
  }
  
  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-toast";
    parent.appendChild(el);
    this._el = el;
  }
  
  show(message, kind, durationMs) {
    if (!this._el) return;
    this._el.textContent = message;
    this._el.className = "limn-toast show " + (kind || "info");
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._el.className = "limn-toast";
    }, durationMs || 2200);
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}