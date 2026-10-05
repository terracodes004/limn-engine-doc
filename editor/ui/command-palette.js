export class CommandPalette {
  constructor(options) {
    options = options || {};
    this.onRun = options.onRun || null;
    
    this._el = null;
    this._backdrop = null;
    this._input = null;
    this._list = null;
    this._commands = [];
    this._filtered = [];
    this._selected = 0;
    this._open = false;
  }
  
  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-cmd-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.close();
    });
    
    const panel = document.createElement("div");
    panel.className = "limn-cmd";
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "limn-cmd-input";
    input.placeholder = "Type a command…";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.addEventListener("input", () => {
      this._selected = 0;
      this._filter();
    });
    input.addEventListener("keydown", (e) => this._onKey(e));
    panel.appendChild(input);
    this._input = input;
    
    const list = document.createElement("div");
    list.className = "limn-cmd-list";
    panel.appendChild(list);
    this._list = list;
    
    backdrop.appendChild(panel);
    parent.appendChild(backdrop);
    this._el = backdrop;
    this._backdrop = backdrop;
  }
  
  setCommands(commands) {
    this._commands = commands || [];
  }
  
  open(prefill) {
    if (!this._el) return;
    this._open = true;
    this._el.classList.add("open");
    this._input.value = prefill || "";
    this._selected = 0;
    this._filter();
    setTimeout(() => {
      this._input.focus();
      this._input.setSelectionRange(this._input.value.length, this._input.value.length);
    }, 30);
  }
  
  close() {
    if (!this._el) return;
    this._open = false;
    this._el.classList.remove("open");
    this._input.value = "";
    this._input.blur();
    if (this.onRun) this.onRun(null);
  }
  
  isOpen() {
    return this._open;
  }
  
  _filter() {
    const q = this._input.value.trim().toLowerCase();
    const all = this._commands;
    if (!q) {
      this._filtered = all.slice(0, 50);
    } else {
      const scored = [];
      for (const cmd of all) {
        const haystack = (cmd.label + " " + (cmd.group || "")).toLowerCase();
        const idx = haystack.indexOf(q);
        if (idx === -1) continue;
        let score = 1000 - idx;
        if (haystack.startsWith(q)) score += 500;
        scored.push({ cmd, score });
      }
      scored.sort((a, b) => b.score - a.score);
      this._filtered = scored.slice(0, 50).map((s) => s.cmd);
    }
    this._render();
  }
  
  _render() {
    if (!this._list) return;
    this._list.innerHTML = "";
    
    if (this._filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "limn-cmd-empty";
      empty.textContent = "No matching commands";
      this._list.appendChild(empty);
      return;
    }
    
    for (let i = 0; i < this._filtered.length; i++) {
      const cmd = this._filtered[i];
      const row = document.createElement("div");
      row.className = "limn-cmd-item" + (i === this._selected ? " selected" : "");
      row.dataset.index = i;
      
      if (cmd.group) {
        const group = document.createElement("span");
        group.className = "limn-cmd-group";
        group.textContent = cmd.group;
        row.appendChild(group);
      }
      
      const icon = document.createElement("span");
      icon.className = "limn-cmd-icon";
      icon.textContent = cmd.icon || "";
      row.appendChild(icon);
      
      const label = document.createElement("span");
      label.className = "limn-cmd-label";
      label.textContent = cmd.label;
      row.appendChild(label);
      
      if (cmd.shortcut) {
        const sc = document.createElement("span");
        sc.className = "limn-cmd-shortcut";
        sc.textContent = cmd.shortcut;
        row.appendChild(sc);
      }
      
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this._selected = i;
        this._run();
      });
      
      this._list.appendChild(row);
    }
    
    const sel = this._list.querySelector(".selected");
    if (sel && sel.scrollIntoView) {
      try { sel.scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
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
      this._run();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
  }
  
  _run() {
    const cmd = this._filtered[this._selected];
    if (!cmd) return;
    this.close();
    if (cmd.action) cmd.action();
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._backdrop = null;
    this._input = null;
    this._list = null;
  }
}