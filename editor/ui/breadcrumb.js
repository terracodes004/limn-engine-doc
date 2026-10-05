export class Breadcrumb {
  constructor(options) {
    options = options || {};
    this.onTapLanguage = options.onTapLanguage || null;
    this.onTapFile = options.onTapFile || null;
    this.onTapSymbol = options.onTapSymbol || null;
    this._el = null;
    this._parts = [];
  }

  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-breadcrumb";
    parent.appendChild(el);
    this._el = el;
  }

  set(parts) {
    if (!this._el) return;
    this._parts = parts || [];
    this._el.innerHTML = "";

    for (let i = 0; i < this._parts.length; i++) {
      const part = this._parts[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-breadcrumb-item";
      if (part.kind) btn.dataset.kind = part.kind;
      btn.textContent = part.label;

      if (part.onTap) {
        let lastFire = 0;
        const fire = (e) => {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          const now = Date.now();
          if (now - lastFire < 250) return;
          lastFire = now;
          part.onTap();
        };
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("touchend", fire, { passive: false });
        btn.addEventListener("click", fire);
      } else {
        btn.disabled = true;
        btn.classList.add("static");
      }

      this._el.appendChild(btn);

      if (i < this._parts.length - 1) {
        const sep = document.createElement("span");
        sep.className = "limn-breadcrumb-sep";
        sep.textContent = "›";
        this._el.appendChild(sep);
      }
    }
  }

  show() {
    if (this._el) this._el.classList.remove("hidden");
  }

  hide() {
    if (this._el) this._el.classList.add("hidden");
  }

  height() {
    return this._el && !this._el.classList.contains("hidden") ? 28 : 0;
  }

  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}