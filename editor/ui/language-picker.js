const LANGS = [
  { key: "plaintext", label: "Plain Text" },
  { key: "javascript", label: "JavaScript" },
  { key: "json", label: "JSON" },
  { key: "css", label: "CSS" },
  { key: "html", label: "HTML" },
  { key: "markdown", label: "Markdown" },
];

export class LanguagePicker {
  constructor(options) {
    options = options || {};
    this.onPick = options.onPick || null;
    this.currentKey = options.current || "plaintext";
    this._el = null;
    this._backdrop = null;
    this._open = false;
  }
  
  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-langpick-backdrop";
    backdrop.addEventListener("click", () => this.close());
    parent.appendChild(backdrop);
    this._backdrop = backdrop;
    
    const dialog = document.createElement("div");
    dialog.className = "limn-langpick";
    
    const header = document.createElement("div");
    header.className = "limn-langpick-header";
    header.textContent = "Language";
    dialog.appendChild(header);
    
    const list = document.createElement("div");
    list.className = "limn-langpick-list";
    
    for (const lang of LANGS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-langpick-item";
      btn.dataset.key = lang.key;
      
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = lang.label;
      btn.appendChild(label);
      
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      btn.appendChild(check);
      
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
        if (this.onPick) this.onPick(lang.key);
      });
      
      list.appendChild(btn);
    }
    
    dialog.appendChild(list);
    
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "limn-langpick-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", (e) => {
      e.preventDefault();
      this.close();
    });
    dialog.appendChild(cancel);
    
    backdrop.appendChild(dialog);
    this._el = backdrop;
  }
  
  setCurrent(key) {
    this.currentKey = key;
    if (!this._el) return;
    const items = this._el.querySelectorAll(".limn-langpick-item");
    for (const item of items) {
      item.classList.toggle("active", item.dataset.key === key);
    }
  }
  
  open() {
    if (!this._el) return;
    this.setCurrent(this.currentKey);
    this._el.classList.add("open");
    this._open = true;
  }
  
  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
  }
  
  isOpen() {
    return this._open;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}