export class StickyScroll {
  constructor(editor, opts) {
    opts = opts || {};
    this.editor = editor;
    this.maxRows = opts.maxRows || 2;
    this.rowHeight = opts.rowHeight || 22;
    this.padding = opts.padding || 4;
    this.enabled = true;
    this._cache = null;
    this._cacheVersion = -1;
    this._cacheSymbols = null;
  }
  
  setEnabled(v) {
    this.enabled = !!v;
    this._cache = null;
    this._cacheVersion = -1;
  }
  
  isEnabled() {
    return this.enabled;
  }
  
  _computeScopes(buffer, symbols) {
    if (!symbols || symbols.length === 0) return [];
    const scopes = [];
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      let endLine = buffer.lineCount() - 1;
      for (let j = i + 1; j < symbols.length; j++) {
        const next = symbols[j];
        if (next.kind === sym.kind || this._kindRank(next.kind) <= this._kindRank(sym.kind)) {
          endLine = next.line - 1;
          break;
        }
      }
      scopes.push({
        line: sym.line,
        endLine: endLine,
        name: sym.name,
        kind: sym.kind,
      });
    }
    return scopes;
  }
  
  _kindRank(kind) {
    if (kind === "class") return 0;
    if (kind === "method") return 1;
    if (kind === "function") return 2;
    return 3;
  }
  
  _ensureCache(buffer, symbols) {
    const version = buffer._version;
    if (
      this._cache &&
      this._cacheVersion === version &&
      this._cacheSymbols === symbols
    ) {
      return this._cache;
    }
    this._cache = this._computeScopes(buffer, symbols);
    this._cacheVersion = version;
    this._cacheSymbols = symbols;
    return this._cache;
  }
  
  computeVisibleScopes(buffer, firstLine, symbols) {
    if (!this.enabled) return [];
    const scopes = this._ensureCache(buffer, symbols);
    if (scopes.length === 0) return [];
    
    const active = [];
    for (let i = 0; i < scopes.length; i++) {
      const s = scopes[i];
      if (s.line <= firstLine && firstLine <= s.endLine) {
        active.push(s);
      }
    }
    if (active.length === 0) return [];
    if (active.length > this.maxRows) {
      active.splice(0, active.length - this.maxRows);
    }
    return active;
  }
  
  draw(ctx, viewport, buffer, symbols, theme) {
    if (!this.enabled) return;
    if (!symbols || symbols.length === 0) return;
    
    const firstLine = viewport.visibleFirstLine;
    if (firstLine === undefined || firstLine === null) return;
    
    const scopes = this.computeVisibleScopes(buffer, firstLine, symbols);
    if (scopes.length === 0) return;
    
    const colors = theme.colors;
    const tokens = theme.tokens;
    
    const gutterW = this.editor.renderer.gutterWidth;
    const lineH = this.rowHeight;
    const totalH = scopes.length * lineH + this.padding * 2;
    
    ctx.save();
    
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, viewport.width, totalH);
    
    ctx.fillStyle = colors.gutter;
    ctx.fillRect(0, totalH - 1, viewport.width, 1);
    
    ctx.font = this.editor.renderer._fontString || (this.editor.renderer.fontSize + "px " + this.editor.renderer.fontFamily);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    
    for (let i = 0; i < scopes.length; i++) {
      const s = scopes[i];
      const y = this.padding + i * lineH + 3;
      
      const label = this._labelFor(s);
      const glyph = this._glyphFor(s.kind);
      
      ctx.fillStyle = colors.lineNumber || "#5a5a5a";
      ctx.fillText(glyph, gutterW + 6, y);
      
      ctx.fillStyle = tokens.function || tokens.text || "#dcdcaa";
      ctx.fillText(label, gutterW + 26, y);
    }
    
    ctx.restore();
  }
  
  _labelFor(scope) {
    return scope.name;
  }
  
  _glyphFor(kind) {
    if (kind === "class") return "C";
    if (kind === "method") return "m";
    if (kind === "function") return "ƒ";
    if (kind === "constant") return "K";
    if (kind === "selector") return "·";
    return "·";
  }
}