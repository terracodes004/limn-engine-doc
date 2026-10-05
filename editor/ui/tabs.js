import { metaForFilename } from "../core/languages.js";

export class Tabs {
  constructor(options) {
    options = options || {};
    this.onSelect = options.onSelect || null;
    this.onClose = options.onClose || null;
    this.onNew = options.onNew || null;
    this.onRename = options.onRename || null;
    
    this._el = null;
    this._list = null;
    this._tabs = [];
    this._activeId = null;
  }
  
  mount(parent) {
    const bar = document.createElement("div");
    bar.className = "limn-tabs";
    
    const list = document.createElement("div");
    list.className = "limn-tabs-list";
    bar.appendChild(list);
    this._list = list;
    
    const addBtn = document.createElement("button");
    addBtn.className = "limn-tabs-add";
    addBtn.type = "button";
    addBtn.textContent = "＋";
    addBtn.title = "New file";
    addBtn.setAttribute("aria-label", "New file");
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.onNew) this.onNew();
    });
    bar.appendChild(addBtn);
    
    parent.appendChild(bar);
    this._el = bar;
  }
  
  update(docs) {
    if (!this._list) return;
    this._list.innerHTML = "";
    this._tabs = [];
    
    for (let i = 0; i < docs.items.length; i++) {
      const doc = docs.items[i];
      const tab = this._makeTab(doc, i === docs.activeIndex);
      this._list.appendChild(tab);
      this._tabs.push(tab);
    }
    
    if (this._activeId) {
      const active = this._list.querySelector('[data-id="' + this._activeId + '"]');
      if (active && active.scrollIntoView) {
        try {
          active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        } catch (e) {}
      }
    }
  }
  
  _makeTab(doc, isActive) {
    const meta = metaForFilename(doc.name);
    const tab = document.createElement("div");
    tab.className = "limn-tab" + (isActive ? " active" : "");
    tab.dataset.id = doc.id;
    tab.dataset.docId = doc.id;
    
    const badge = document.createElement("span");
    badge.className = "limn-tab-badge";
    badge.style.background = meta.color;
    tab.appendChild(badge);
    
    const nameEl = document.createElement("span");
    nameEl.className = "limn-tab-name";
    nameEl.textContent = doc.name;
    tab.appendChild(nameEl);
    
    if (doc.dirty) {
      const dot = document.createElement("span");
      dot.className = "limn-tab-dirty";
      dot.textContent = "●";
      tab.appendChild(dot);
    }
    
    const closeBtn = document.createElement("button");
    closeBtn.className = "limn-tab-close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close tab");
    
    let lastFire = 0;
    const closeHandler = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = Date.now();
      if (now - lastFire < 300) return;
      lastFire = now;
      if (this.onClose) this.onClose(doc);
    };
    
    closeBtn.addEventListener("mousedown", (e) => e.preventDefault());
    closeBtn.addEventListener("touchend", closeHandler, { passive: false });
    closeBtn.addEventListener("click", closeHandler);
    tab.appendChild(closeBtn);
    
    tab.addEventListener("click", (e) => {
      if (e.target === closeBtn) return;
      if (this.onSelect) this.onSelect(doc);
    });
    
    tab.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (this.onRename) this.onRename(doc);
    });
    
    return tab;
  }
  
  setActive(id) {
    this._activeId = id;
    for (const tab of this._tabs) {
      if (tab.dataset.id === String(id)) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
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
    return this._el && !this._el.classList.contains("hidden") ? 40 : 0;
  }
  
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
  }
}