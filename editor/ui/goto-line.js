export class GotoLinePicker {
  constructor(options) {
    options = options || {};
    this.onGo = options.onGo || null;
    this.onClose = options.onClose || null;
    this._el = null;
    this._backdrop = null;
    this._input = null;
    this._open = false;
    this._maxLine = 1;
  }
  
  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-goto-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.close();
    });
    
    const panel = document.createElement("div");
    panel.className = "limn-goto";
    
    const header = document.createElement("div");
    header.className = "limn-goto-header";
    header.textContent = "Go to line";
    panel.appendChild(header);
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "limn-goto-input";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.placeholder = "Line number";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._submit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        if (this.onClose) this.onClose();
      }
    });
    panel.appendChild(input);
    this._input = input;
    
    const actions = document.createElement("div");
    actions.className = "limn-goto-actions";
    
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "limn-goto-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", (e) => {
      e.preventDefault();
      this.close();
      if (this.onClose) this.onClose();
    });
    actions.appendChild(cancel);
    
    const go = document.createElement("button");
    go.type = "button";
    go.className = "limn-goto-go";
    go.textContent = "Go";
    go.addEventListener("click", (e) => {
      e.preventDefault();
      this._submit();
    });
    actions.appendChild(go);
    
    panel.appendChild(actions);
    
    backdrop.appendChild(panel);
    parent.appendChild(backdrop);
    this._el = backdrop;
    this._backdrop = backdrop;
  }
  
  open(currentLine, maxLine) {
    if (!this._el) return;
    this._maxLine = maxLine || 1;
    this._input.value = String((currentLine || 0) + 1);
    this._el.classList.add("open");
    this._open = true;
    setTimeout(() => {
      this._input.focus();
      this._input.select();
    }, 30);
  }
  
  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    this._input.blur();
  }
  
  isOpen() {
    return this._open;
  }
  
  _submit() {
    const raw = (this._input.value || "").trim();
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1) return;
    const target = Math.min(this._maxLine, n) - 1;
    this.close();
    if (this.onGo) this.onGo(target);
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._backdrop = null;
    this._input = null;
  }
}