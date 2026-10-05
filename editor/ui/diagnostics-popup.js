export class DiagnosticsPopup {
  constructor(options) {
    options = options || {};
    this.onJump = options.onJump || null;
    this.onFix = options.onFix || null;
    this._el = null;
  }

  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-diag-popup";
    parent.appendChild(el);
    this._el = el;
  }

  show(anchorEl, diagnostics) {
    if (!this._el) return;
    const list = diagnostics || [];

    if (list.length === 0) {
      this._el.innerHTML = '<div class="limn-diag-empty">No problems</div>';
    } else {
      this._el.innerHTML = "";
      for (const d of list.slice(0, 30)) {
        const row = document.createElement("div");
        row.className = "limn-diag-row kind-" + d.severity;

        const icon = document.createElement("span");
        icon.className = "limn-diag-icon";
        icon.textContent = d.severity === "error" ? "✕" : "!";
        row.appendChild(icon);

        const text = document.createElement("span");
        text.className = "limn-diag-text";
        text.textContent = "Ln " + (d.line + 1) + ": " + d.message;
        row.appendChild(text);

        let lastFire = 0;
        const fire = (e) => {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          const now = Date.now();
          if (now - lastFire < 250) return;
          lastFire = now;
          this.hide();
          if (this.onJump) this.onJump(d.line, d.col);
        };
        row.addEventListener("mousedown", fire);
        row.addEventListener("touchstart", fire, { passive: false });

        this._el.appendChild(row);

        if (this.onFix) {
          const fixBtn = document.createElement("button");
          fixBtn.type = "button";
          fixBtn.className = "limn-diag-fix";
          fixBtn.textContent = "Fix";

          let lastFixFire = 0;
          const fireFix = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            const now = Date.now();
            if (now - lastFixFire < 250) return;
            lastFixFire = now;
            this.hide();
            if (this.onFix) this.onFix(d, e);
          };
          fixBtn.addEventListener("mousedown", fireFix);
          fixBtn.addEventListener("touchstart", fireFix, { passive: false });
          fixBtn.addEventListener("click", fireFix);

          row.appendChild(fixBtn);
        }
      }
    }

    const rect = anchorEl.getBoundingClientRect();
    this._el.classList.add("open");
    this._el.style.left = "0px";
    this._el.style.top = "0px";
    const popupRect = this._el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top - popupRect.height - 8;
    if (left + popupRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popupRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + 8;
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

  hide() {
    if (this._el) this._el.classList.remove("open");
  }

  isOpen() {
    return this._el && this._el.classList.contains("open");
  }

  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}