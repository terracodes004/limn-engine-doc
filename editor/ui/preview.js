export class Preview {
  constructor(options) {
    options = options || {};
    this.onClose = options.onClose || null;
    this._el = null;
    this._frame = null;
    this._titleEl = null;
    this._open = false;
  }
  
  mount(parent) {
    const el = document.createElement("div");
    el.className = "limn-preview";
    
    const bar = document.createElement("div");
    bar.className = "limn-preview-bar";
    
    const title = document.createElement("span");
    title.className = "limn-preview-title";
    title.textContent = "Preview";
    bar.appendChild(title);
    this._titleEl = title;
    
    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    bar.appendChild(spacer);
    
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "limn-preview-btn";
    openBtn.textContent = "Open in tab";
    openBtn.title = "Open in new tab";
    openBtn.addEventListener("click", () => {
      if (this._frame && this._frame.srcdoc) {
        const blob = new Blob([this._frame.srcdoc], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    });
    bar.appendChild(openBtn);
    
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "limn-preview-btn limn-preview-close";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close preview";
    closeBtn.setAttribute("aria-label", "Close preview");
    closeBtn.addEventListener("click", () => {
      this.close();
      if (this.onClose) this.onClose();
    });
    bar.appendChild(closeBtn);
    
    el.appendChild(bar);
    
    const frameWrap = document.createElement("div");
    frameWrap.className = "limn-preview-frame-wrap";
    
    const frame = document.createElement("iframe");
    frame.className = "limn-preview-frame";
    frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals allow-popups allow-same-origin");
    frame.srcdoc = "<html><body></body></html>";
    frameWrap.appendChild(frame);
    this._frame = frame;
    
    el.appendChild(frameWrap);
    
    parent.appendChild(el);
    this._el = el;
  }
  
  show(title, html) {
    if (!this._el) return;
    if (this._titleEl) this._titleEl.textContent = title || "Preview";
    if (this._frame) this._frame.srcdoc = html || "<html><body></body></html>";
    this._el.classList.add("open");
    this._open = true;
  }
  
  close() {
    if (!this._el) return;
    this._el.classList.remove("open");
    this._open = false;
    if (this._frame) this._frame.srcdoc = "<html><body></body></html>";
  }
  
  isOpen() {
    return this._open;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._frame = null;
  }
}