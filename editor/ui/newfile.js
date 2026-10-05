const LANGUAGES = [
  { ext: "js", key: "javascript", label: "JavaScript", icon: "JS", color: "#f7df1e" },
  { ext: "html", key: "html", label: "HTML", icon: "<>", color: "#e34c26" },
  { ext: "css", key: "css", label: "CSS", icon: "##", color: "#2965f1" },
  { ext: "json", key: "json", label: "JSON", icon: "{}", color: "#a3aac0" },
  { ext: "md", key: "markdown", label: "Markdown", icon: "M↓", color: "#6ea8fe" },
  { ext: "txt", key: "plaintext", label: "Plain Text", icon: "T", color: "#6e7589" },
];

export class NewFilePicker {
  constructor(options) {
    options = options || {};
    this.onCreate = options.onCreate || null;
    this._el = null;
    this._open = false;
  }
  
  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-newfile-backdrop";
    
    const dialog = document.createElement("div");
    dialog.className = "limn-newfile";
    
    const header = document.createElement("div");
    header.className = "limn-newfile-header";
    header.textContent = "New file";
    dialog.appendChild(header);
    
    const grid = document.createElement("div");
    grid.className = "limn-newfile-grid";
    
    for (const lang of LANGUAGES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-newfile-item";
      btn.dataset.ext = lang.ext;
      
      const icon = document.createElement("span");
      icon.className = "limn-newfile-icon";
      icon.textContent = lang.icon;
      icon.style.color = lang.color;
      icon.style.borderColor = lang.color + "40";
      icon.style.background = lang.color + "15";
      btn.appendChild(icon);
      
      const label = document.createElement("span");
      label.className = "limn-newfile-label";
      label.textContent = lang.label;
      btn.appendChild(label);
      
      let lastFire = 0;
      const handler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastFire < 300) return;
        lastFire = now;
        this.close();
        if (this.onCreate) this.onCreate(lang);
      };
      
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("touchend", handler, { passive: false });
      btn.addEventListener("click", handler);
      
      grid.appendChild(btn);
    }
    
    dialog.appendChild(grid);
    
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "limn-newfile-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", (e) => {
      e.preventDefault();
      this.close();
    });
    dialog.appendChild(cancel);
    
    backdrop.appendChild(dialog);
    parent.appendChild(backdrop);
    this._el = backdrop;
    
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.close();
    });
  }
  
  open() {
    if (!this._el) return;
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
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}