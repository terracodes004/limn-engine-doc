import { metaForFilename } from "../core/languages.js";

export class FileTree {
  constructor(options) {
    options = options || {};
    this.onSelect = options.onSelect || null;
    this.onClose = options.onClose || null;
    this.onNew = options.onNew || null;
    this.onRename = options.onRename || null;
    this.onDelete = options.onDelete || null;
    this.onDismiss = options.onDismiss || null;
    this.onDownload = options.onDownload || null;
    this.onStateChange = options.onStateChange || null;

    this._backdrop = null;
    this._el = null;
    this._list = null;
    this._open = false;
    this._activeId = null;
    this._docs = null;
  }

  mount(parent) {
    const backdrop = document.createElement("div");
    backdrop.className = "limn-filetree-backdrop";
    backdrop.addEventListener("click", () => {
      if (this.onDismiss) this.onDismiss();
      else this.close();
    });
    parent.appendChild(backdrop);
    this._backdrop = backdrop;

    const sidebar = document.createElement("aside");
    sidebar.className = "limn-filetree";

    const header = document.createElement("div");
    header.className = "limn-filetree-header";

    const title = document.createElement("span");
    title.className = "limn-filetree-title";
    title.textContent = "Files";
    header.appendChild(title);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "limn-filetree-btn";
    addBtn.textContent = "＋";
    addBtn.title = "New file";
    addBtn.setAttribute("aria-label", "New file");
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.onNew) this.onNew();
    });
    header.appendChild(addBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "limn-filetree-btn";
    closeBtn.textContent = "✕";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.close();
      if (this.onClose) this.onClose();
    });
    header.appendChild(closeBtn);

    sidebar.appendChild(header);

    const list = document.createElement("div");
    list.className = "limn-filetree-list";
    sidebar.appendChild(list);
    this._list = list;

    parent.appendChild(sidebar);
    this._el = sidebar;
  }

  update(docs) {
    this._docs = docs;
    this._activeId = docs.activeIndex >= 0 && docs.items[docs.activeIndex]
      ? docs.items[docs.activeIndex].id
      : null;
    this._render();
  }

  _render() {
    if (!this._list || !this._docs) return;
    this._list.innerHTML = "";

    const items = this._docs.items || [];
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "limn-filetree-empty";
      empty.textContent = "No files open";
      this._list.appendChild(empty);
      return;
    }

    for (const doc of items) {
      const row = document.createElement("div");
      row.className = "limn-filetree-row" +
        (doc.id === this._activeId ? " active" : "");

      const meta = metaForFilename(doc.name);

      const badge = document.createElement("span");
      badge.className = "limn-filetree-badge";
      badge.style.color = meta.color;
      badge.style.borderColor = meta.color + "55";
      badge.style.background = meta.color + "18";
      badge.textContent = this._shortBadge(doc.name);
      row.appendChild(badge);

      const name = document.createElement("span");
      name.className = "limn-filetree-name";
      name.textContent = doc.name;
      row.appendChild(name);

      if (doc.dirty) {
        const dot = document.createElement("span");
        dot.className = "limn-filetree-dirty";
        dot.textContent = "●";
        row.appendChild(dot);
      }

      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "limn-filetree-more";
      moreBtn.textContent = "⋯";
      moreBtn.title = "More";
      moreBtn.setAttribute("aria-label", "More");

      let lastFire = 0;
      const moreHandler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastFire < 300) return;
        lastFire = now;
        this._openRowMenu(doc, moreBtn);
      };

      moreBtn.addEventListener("mousedown", (e) => e.preventDefault());
      moreBtn.addEventListener("touchend", moreHandler, { passive: false });
      moreBtn.addEventListener("click", moreHandler);
      row.appendChild(moreBtn);

      let lastRowFire = 0;
      const rowHandler = (e) => {
        if (e) e.preventDefault();
        const now = Date.now();
        if (now - lastRowFire < 250) return;
        lastRowFire = now;
        if (this.onSelect) this.onSelect(doc);
      };

      row.addEventListener("mousedown", (e) => e.preventDefault());
      row.addEventListener("touchend", rowHandler, { passive: false });
      row.addEventListener("click", rowHandler);

      row.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (this.onRename) this.onRename(doc);
      });

      this._list.appendChild(row);
    }
  }

  _shortBadge(name) {
    const dot = name.lastIndexOf(".");
    if (dot === -1) return "FILE";
    const ext = name.slice(dot + 1).toUpperCase();
    if (ext.length <= 3) return ext;
    return ext.slice(0, 3);
  }

  _openRowMenu(doc, anchor) {
    const existing = document.querySelector(".limn-filetree-rowmenu");
    if (existing) existing.parentNode.removeChild(existing);

    const menu = document.createElement("div");
    menu.className = "limn-filetree-rowmenu";

    const items = [
      { icon: "✏️", label: "Rename", action: () => { if (this.onRename) this.onRename(doc); } },
      { icon: "⬇", label: "Download", action: () => { if (this.onDownload) this.onDownload(doc); } },
      { icon: "📋", label: "Copy name", action: () => {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(doc.name);
        } catch (e) {}
      } },
      { icon: "🗑", label: "Close", action: () => { if (this.onDelete) this.onDelete(doc); } },
    ];

    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-filetree-rowmenu-item";

      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = item.icon;
      btn.appendChild(icon);

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;
      btn.appendChild(label);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        item.action();
      });

      menu.appendChild(btn);
    }

    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.right - menuRect.width;
    if (left < 8) left = 8;
    if (top + menuRect.height > window.innerHeight - 8) {
      top = rect.top - menuRect.height - 4;
    }
    menu.style.top = top + "px";
    menu.style.left = left + "px";

    setTimeout(() => {
      const close = (ev) => {
        if (menu.contains(ev.target)) return;
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        document.removeEventListener("mousedown", close);
        document.removeEventListener("touchstart", close);
      };
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
  }

  open() {
    if (!this._el) return;
    if (this._backdrop) this._backdrop.classList.add("open");
    this._el.classList.add("open");
    this._open = true;
    if (this.onStateChange) this.onStateChange(true);
  }

  close() {
    if (!this._el) return;
    if (this._backdrop) this._backdrop.classList.remove("open");
    this._el.classList.remove("open");
    this._open = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  isOpen() {
    return this._open;
  }

  destroy() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    if (this._backdrop && this._backdrop.parentNode) {
      this._backdrop.parentNode.removeChild(this._backdrop);
    }
    this._el = null;
    this._backdrop = null;
  }
}