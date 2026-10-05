export class SymbolPicker {
  constructor(options) {
    options = options || {};
    this.onPick = options.onPick || null;
    this.onClose = options.onClose || null;
    this._el = null;
    this._input = null;
    this._list = null;
    this._symbols = [];
    this._filtered = [];
    this._selected = 0;
    this._open = false;
  }

  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-sym-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.close();
    });

    const panel = document.createElement("div");
    panel.className = "limn-sym";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "limn-sym-input";
    input.placeholder = "Jump to symbol…";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.addEventListener("input", () => { this._selected = 0; this._filter(); });
    input.addEventListener("keydown", (e) => this._onKey(e));
    panel.appendChild(input);
    this._input = input;

    const list = document.createElement("div");
    list.className = "limn-sym-list";
    panel.appendChild(list);
    this._list = list;

    backdrop.appendChild(panel);
    parent.appendChild(backdrop);
    this._el = backdrop;
  }

  show(symbols) {
    if (!this._el) return;
    this._symbols = symbols || [];
    this._selected = 0;
    this._input.value = "";
    this._el.classList.add("open");
    this._open = true;
    this._filter();
    setTimeout(() => {
      this._input.focus();
    }, 30);
  }

  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    this._input.value = "";
    this._input.blur();
    if (this.onClose) this.onClose();
  }

  isOpen() {
    return this._open;
  }

  _filter() {
    const q = this._input.value.trim().toLowerCase();
    if (!q) {
      this._filtered = this._symbols.slice(0, 100);
    } else {
      const scored = [];
      for (const sym of this._symbols) {
        const hay = sym.name.toLowerCase();
        const idx = hay.indexOf(q);
        if (idx === -1) continue;
        let score = 1000 - idx;
        if (hay.startsWith(q)) score += 500;
        scored.push({ sym, score });
      }
      scored.sort((a, b) => b.score - a.score);
      this._filtered = scored.slice(0, 100).map((s) => s.sym);
    }
    this._render();
  }

  _render() {
    if (!this._list) return;
    this._list.innerHTML = "";

    if (this._filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "limn-sym-empty";
      empty.textContent = "No symbols found";
      this._list.appendChild(empty);
      return;
    }

    for (let i = 0; i < this._filtered.length; i++) {
      const sym = this._filtered[i];
      const row = document.createElement("div");
      row.className = "limn-sym-item" + (i === this._selected ? " selected" : "");
      row.dataset.index = i;

      const badge = document.createElement("span");
      badge.className = "limn-sym-badge kind-" + sym.kind;
      badge.textContent = this._badgeFor(sym.kind);
      row.appendChild(badge);

      const label = document.createElement("span");
      label.className = "limn-sym-label";
      label.textContent = sym.name;
      row.appendChild(label);

      const lineNo = document.createElement("span");
      lineNo.className = "limn-sym-line";
      lineNo.textContent = "Ln " + (sym.line + 1);
      row.appendChild(lineNo);

      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this._selected = i;
        this._pick();
      });
      row.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this._selected = i;
        this._pick();
      }, { passive: false });

      this._list.appendChild(row);
    }

    const sel = this._list.querySelector(".selected");
    if (sel && sel.scrollIntoView) {
      try { sel.scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
  }

  _badgeFor(kind) {
    if (kind === "function") return "ƒ";
    if (kind === "method") return "m";
    if (kind === "class") return "C";
    if (kind === "constant") return "K";
    if (kind === "selector") return "·";
    return "?";
  }

  _onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._selected = Math.min(this._selected + 1, this._filtered.length - 1);
      this._render();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this._selected = Math.max(this._selected - 1, 0);
      this._render();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      this._pick();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  }

  _pick() {
    const sym = this._filtered[this._selected];
    if (!sym) return;
    this.close();
    if (this.onPick) this.onPick(sym);
  }

  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}