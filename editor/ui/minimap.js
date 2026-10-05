const MINIMAP_DEFAULT_W = 72;

const KIND_COLORS = {
  function: "#dcdcaa",
  method: "#dcdcaa",
  class: "#4ec9b0",
  constant: "#569cd6",
  selector: "#e34c26",
};

export class Minimap {
  constructor(component, opts) {
    opts = opts || {};
    this.component = component;
    this.width = opts.width || MINIMAP_DEFAULT_W;
    this.semantic = opts.semantic !== false;

    this._root = null;
    this._canvas = null;
    this._ctx = null;
    this._preview = null;

    this._visible = true;
    this._rafPending = false;
    this._dragging = false;
    this._pointerId = null;

    this._cssW = 0;
    this._cssH = 0;
    this._dpr = 1;
    this._lineHeight = 2;

    this._ink = null;
    this._inkColors = null;
    this._inkLineCount = -1;
    this._inkVersion = -1;
    this._inkTheme = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  attach(parent) {
    const root = document.createElement("div");
    root.className = "limn-minimap";
    root.style.pointerEvents = "auto";
    root.style.touchAction = "none";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);

    parent.appendChild(root);
    this._root = root;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");

    const preview = document.createElement("div");
    preview.className = "limn-minimap-preview";
    document.body.appendChild(preview);
    this._preview = preview;

    root.addEventListener("pointerdown", this._onPointerDown, { passive: false });
    root.addEventListener("pointermove", this._onPointerMove, { passive: false });
    root.addEventListener("pointerup", this._onPointerUp, { passive: false });
    root.addEventListener("pointercancel", this._onPointerUp, { passive: false });
    root.addEventListener("pointerleave", this._onPointerUp, { passive: false });
  }

  destroy() {
    if (this._root) {
      this._root.removeEventListener("pointerdown", this._onPointerDown);
      this._root.removeEventListener("pointermove", this._onPointerMove);
      this._root.removeEventListener("pointerup", this._onPointerUp);
      this._root.removeEventListener("pointercancel", this._onPointerUp);
      this._root.removeEventListener("pointerleave", this._onPointerUp);
      if (this._root.parentNode) this._root.parentNode.removeChild(this._root);
    }
    if (this._preview && this._preview.parentNode) {
      this._preview.parentNode.removeChild(this._preview);
    }
    this._root = null;
    this._canvas = null;
    this._ctx = null;
    this._preview = null;
    this._ink = null;
    this._inkColors = null;
  }

  setVisible(v) {
    this._visible = !!v;
    if (this._root) {
      this._root.classList.toggle("hidden", !this._visible);
    }
    if (this._visible) this.scheduleRender();
  }

  isVisible() {
    return this._visible;
  }

  setLayout(left, top, width, height) {
    if (!this._root) return;
    this._root.style.left = left + "px";
    this._root.style.top = top + "px";
    if (width !== undefined) this._root.style.width = width + "px";
    if (height !== undefined) this._root.style.height = height + "px";
  }

  resize(cssW, cssH) {
    if (!this._canvas) return;
    if (cssW === this._cssW && cssH === this._cssH) return;

    this._cssW = cssW;
    this._cssH = cssH;

    const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
    this._dpr = dpr;

    this._canvas.width = Math.round(cssW * dpr);
    this._canvas.height = Math.round(cssH * dpr);
    this._canvas.style.width = cssW + "px";
    this._canvas.style.height = cssH + "px";
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._ink = null;
    this._inkColors = null;
    this._inkLineCount = -1;
    this._inkVersion = -1;
    this.scheduleRender();
  }

  scheduleRender() {
    if (this._rafPending) return;
    if (!this._visible) return;
    if (!this._ctx) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this.render();
    });
  }

  render() {
    if (!this._ctx || !this._visible) return;
    const comp = this.component;
    const editor = comp.editor;
    const buffer = editor.buffer;
    const viewport = editor.viewport;
    const renderer = editor.renderer;
    const theme = renderer.theme;
    const colors = theme.colors;

    const cssW = this._cssW;
    const cssH = this._cssH;
    if (cssW <= 0 || cssH <= 0) return;

    const lineCount = buffer.lineCount();

    let lh = cssH / Math.max(1, lineCount);
    if (lh < 0.5) lh = 0.5;
    if (lh > 4) lh = 4;
    this._lineHeight = lh;

    this._ensureInk(buffer, lineCount, theme, editor);

    const ctx = this._ctx;

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, cssW, cssH);

    const maxInk = cssW - 4;
    const topPad = 1;
    const ink = this._ink;
    const inkColors = this._inkColors;

    let y = topPad;

    for (let i = 0; i < lineCount; i++) {
      const ratio = ink[i];
      if (ratio > 0) {
        let w = ratio * maxInk;
        if (w < 1) w = 1;
        ctx.fillStyle = inkColors ? inkColors[i] : (colors.lineNumber || "#5a5a5a");
        ctx.fillRect(2, y, w, Math.max(1, lh - 1));
      }
      y += lh;
      if (y > cssH) break;
    }

    this._drawViewportRect(ctx, viewport, cssW, cssH);
    this._drawSectionMarkers(ctx, cssW, lineCount);
    this._drawDiagnosticMarkers(ctx, cssW, lineCount);
    this._drawCarets(ctx, cssW, lineCount);
  }

  _drawViewportRect(ctx, viewport, cssW, cssH) {
    const cache = viewport._cache;
    let firstLine;
    let lastLine;
    if (cache) {
      firstLine = viewport.visibleFirstLine;
      lastLine = viewport.visibleLastLine;
    } else {
      firstLine = 0;
      lastLine = Math.min(viewport.totalLines - 1, Math.ceil(cssH / Math.max(1, this._lineHeight)) - 1);
    }

    const rowStart = cache ? (cache.lineToFirstRow[firstLine] || firstLine) : firstLine;
    const rowEnd = cache
      ? (cache.lineToFirstRow[lastLine] + cache.lineToRows[lastLine])
      : lastLine + 1;

    const totalRows = cache ? cache.totalRows : viewport.totalLines;
    const topPad = 1;
    const rectTop = topPad + (rowStart / totalRows) * (cssH - topPad * 2);
    const rectH = Math.max(4, ((rowEnd - rowStart) / totalRows) * (cssH - topPad * 2));

    ctx.fillStyle = this.component.editor.renderer.theme.colors.selection || "rgba(38, 79, 120, 0.55)";
    ctx.fillRect(0, rectTop, cssW, rectH);
  }

  _drawSectionMarkers(ctx, cssW, lineCount) {
    const comp = this.component;
    const symbols = comp._symbols;
    if (!symbols || symbols.length === 0) return;
    const topPad = 1;
    const span = Math.max(1, lineCount);
    const markerColor = "rgba(255, 255, 255, 0.85)";

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const ratio = sym.line / span;
      const y = topPad + ratio * (this._cssH - topPad * 2);
      if (y < 0 || y > this._cssH) continue;
      const color = KIND_COLORS[sym.kind] || markerColor;
      ctx.fillStyle = color;
      ctx.fillRect(0, Math.round(y), Math.max(6, cssW * 0.35), 1);
    }
  }

  _drawDiagnosticMarkers(ctx, cssW, lineCount) {
    const comp = this.component;
    const diagnostics = comp.editor.diagnostics;
    if (!diagnostics || diagnostics.length === 0) return;
    const topPad = 1;
    const span = Math.max(1, lineCount);

    for (let i = 0; i < diagnostics.length; i++) {
      const d = diagnostics[i];
      const ratio = d.line / span;
      const y = topPad + ratio * (this._cssH - topPad * 2);
      if (y < 0 || y > this._cssH) continue;
      ctx.fillStyle = d.severity === "error" ? "#f87171" : "#fbbf24";
      ctx.fillRect(cssW - 4, Math.round(y), 4, 2);
    }
  }

  _drawCarets(ctx, cssW, lineCount) {
    const editor = this.component.editor;
    const carets = editor.carets;
    if (!carets || carets.length === 0) return;
    const cache = editor.viewport._cache;
    const topPad = 1;
    const span = Math.max(1, lineCount);

    for (let i = 0; i < carets.length; i++) {
      const caret = carets[i];
      const ratio = caret.line / span;
      const y = topPad + ratio * (this._cssH - topPad * 2);
      if (y < 0 || y > this._cssH) continue;
      ctx.fillStyle = i === 0
        ? (editor.renderer.theme.colors.cursor || "#f0f0f0")
        : "#6ea8fe";
      ctx.fillRect(0, Math.round(y), cssW, 1);
    }
  }

  _ensureInk(buffer, lineCount, theme, editor) {
    const version = buffer._version;
    const themeName = theme.name;

    if (
      this._ink &&
      this._inkColors &&
      this._inkLineCount === lineCount &&
      this._inkVersion === version &&
      this._inkTheme === themeName
    ) {
      return;
    }

    const ink = new Float32Array(lineCount);
    const colorCache = new Map();
    const inkColors = new Array(lineCount);

    let maxLen = 1;
    for (let i = 0; i < lineCount; i++) {
      const line = buffer.getLine(i);
      let nonWs = 0;
      for (let j = 0; j < line.length; j++) {
        const c = line.charCodeAt(j);
        if (c !== 32 && c !== 9) nonWs++;
      }
      ink[i] = nonWs;
      if (line.length > maxLen) maxLen = line.length;
    }

    for (let i = 0; i < lineCount; i++) {
      ink[i] = Math.min(1, ink[i] / maxLen);
    }

    if (this.semantic) {
      const tokenColors = theme.tokens;
      const defaultColor = theme.colors.lineNumber || "#5a5a5a";

      for (let i = 0; i < lineCount; i++) {
        const line = buffer.getLine(i);
        if (!line) {
          inkColors[i] = defaultColor;
          continue;
        }

        let tokens = null;
        try {
          const entry = editor.highlighter.getLineTokens(i, line);
          tokens = entry.tokens;
        } catch (e) {
          tokens = null;
        }

        if (!tokens || tokens.length === 0) {
          inkColors[i] = defaultColor;
          continue;
        }

        const counts = new Map();
        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          const len = tok.end - tok.start;
          if (len <= 0) continue;
          const existing = counts.get(tok.type) || 0;
          counts.set(tok.type, existing + len);
        }

        if (counts.size === 0) {
          inkColors[i] = defaultColor;
          continue;
        }

        let bestType = null;
        let bestLen = -1;
        for (const [type, len] of counts) {
          if (type === "text" || type === "punctuation" || type === "operator") continue;
          if (len > bestLen) {
            bestLen = len;
            bestType = type;
          }
        }

        if (!bestType) {
          bestType = "text";
        }

        const cacheKey = bestType;
        let color = colorCache.get(cacheKey);
        if (color === undefined) {
          color = tokenColors[bestType] || defaultColor;
          colorCache.set(cacheKey, color);
        }
        inkColors[i] = color;
      }
    } else {
      const defaultColor = theme.colors.lineNumber || "#5a5a5a";
      for (let i = 0; i < lineCount; i++) inkColors[i] = defaultColor;
    }

    this._ink = ink;
    this._inkColors = inkColors;
    this._inkLineCount = lineCount;
    this._inkVersion = version;
    this._inkTheme = themeName;
  }

  _yToLine(y) {
    const lh = this._lineHeight || 2;
    const topPad = 1;
    let line = Math.floor((y - topPad) / lh);
    const max = this.component.editor.buffer.lineCount() - 1;
    if (line < 0) line = 0;
    if (line > max) line = max;
    return line;
  }

  _showPreview(line) {
    if (!this._preview) return;
    const buffer = this.component.editor.buffer;
    const text = buffer.getLine(line) || "";
    const trimmed = text.length > 80 ? text.slice(0, 80) + "…" : text;
    this._preview.textContent = (line + 1) + ": " + (trimmed || "(blank)");
    this._preview.classList.add("open");

    const rect = this._root.getBoundingClientRect();
    const previewRect = this._preview.getBoundingClientRect();
    const editorRect = this.component._canvas
      ? this.component._canvas.getBoundingClientRect()
      : rect;
    let left = editorRect.right - previewRect.width - 12;
    let top = editorRect.top + 12;
    if (left < 8) left = 8;
    if (top + previewRect.height > window.innerHeight - 8) {
      top = window.innerHeight - previewRect.height - 8;
    }
    this._preview.style.left = left + "px";
    this._preview.style.top = top + "px";
  }

  _hidePreview() {
    if (this._preview) this._preview.classList.remove("open");
  }

  _onPointerDown(e) {
    if (!this._visible) return;
    if (this.component._shouldIgnoreEditorTouch()) return;
    e.preventDefault();
    e.stopPropagation();

    this._dragging = true;
    this._pointerId = e.pointerId;
    if (this._root.setPointerCapture) {
      try { this._root.setPointerCapture(e.pointerId); } catch (err) {}
    }

    const rect = this._root.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const line = this._yToLine(y);
    this._showPreview(line);
    this.component.editor.scrollToLine(line, false);
    this.component.renderForce();
  }

  _onPointerMove(e) {
    if (!this._dragging) return;
    if (e.pointerId !== this._pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = this._root.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const line = this._yToLine(y);
    this._showPreview(line);
    this.component.editor.scrollToLine(line, false);
    this.component.renderForce();
  }

  _onPointerUp(e) {
    if (!this._dragging) return;
    if (e.pointerId !== this._pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    this._dragging = false;
    this._pointerId = null;
    this._hidePreview();
    if (this._root.releasePointerCapture) {
      try { this._root.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  }
}