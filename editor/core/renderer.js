import { TOKEN } from "./highlighter.js";
import { VS_DARK } from "./theme.js";
import { DECORATION_TYPE } from "./decorations.js";
import { computeIndentGuides } from "./indent-guides.js";
import { colToRowCol, rowColToCol } from "./wrap.js";

const OPEN_BRACKETS = "([{";
const CLOSE_BRACKETS = ")]}";

export class Renderer {
  constructor(theme) {
    this.theme = theme || VS_DARK;
    this.fontFamily = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';
    this.fontSize = 13;
    this.lineHeight = 22;
    this.charWidth = 7.8;
    this.padTop = 8;
    this.padLeft = 56;
    this.gutterWidth = 56;
    this.tabSize = 4;
    this.showLineNumbers = true;
    this.showIndentGuides = true;
    this.rainbowBrackets = true;
    this._fontString = null;
    this._measuredFontSize = -1;
  }

  setFont(fontFamily, fontSize, lineHeight) {
    this.fontFamily = fontFamily || this.fontFamily;
    this.fontSize = fontSize || this.fontSize;
    this.lineHeight = lineHeight || Math.round(this.fontSize * 1.7);
    this._fontString = null;
    this._measuredFontSize = -1;
  }

  measure(ctx) {
    if (this._measuredFontSize === this.fontSize && this._fontString) {
      return;
    }
    this._fontString = this.fontSize + "px " + this.fontFamily;
    ctx.save();
    ctx.font = this._fontString;
    const sample = "MMMMMMMMMM";
    const w = ctx.measureText(sample).width;
    this.charWidth = w / sample.length;
    ctx.restore();
    this._measuredFontSize = this.fontSize;
  }

  _inkHeight() {
    return this.fontSize + 3;
  }

  _inkPad() {
    return (this.lineHeight - this._inkHeight()) / 2 - this.fontSize * 0.2;
  }

  render(ctx, buffer, viewport, highlighter, options) {
    options = options || {};
    const theme = this.theme;
    const colors = theme.colors;
    const tokenColors = theme.tokens;

    this.measure(ctx);

    const width = viewport.width;
    const height = viewport.height;

    ctx.save();

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    ctx.font = this._fontString;
    ctx.textBaseline = "top";

    const range = viewport.computeVisible(buffer.lines);
    const first = range.first;
    const last = range.last;
    const cache = range.cache;

    this._drawCurrentLine(ctx, viewport, colors, options.currentLine, cache);

    if (this.showIndentGuides) {
      this._drawIndentGuides(ctx, buffer, viewport, colors, first, last, options.activeLine, cache);
    }

    if (options.decorations && options.decorations.length > 0) {
      this._drawDecorations(ctx, viewport, options.decorations, first, last, cache);
    }

    this._drawTokens(ctx, buffer, viewport, highlighter, tokenColors, first, last, cache);

    if (options.carets) {
      this._drawSelections(ctx, viewport, options.carets, colors, cache);
    }

    if (this.showLineNumbers) {
      this._drawGutterBackground(ctx, viewport, colors);
      this._drawGutter(ctx, viewport, colors, first, last, options.activeLine, cache);
      this._drawFoldMarkers(ctx, viewport, buffer, colors, first, last, cache);
    }

    if (options.diagnostics && options.diagnostics.length > 0) {
      this._drawDiagnostics(ctx, viewport, options.diagnostics, colors, first, last, cache);
    }

    if (options.carets && options.cursorVisible !== false) {
      this._drawCarets(ctx, viewport, options.carets, colors, cache);
    }

    ctx.restore();
  }

  _drawCurrentLine(ctx, viewport, colors, activeLine, cache) {
    if (activeLine === undefined || activeLine === null) return;
    if (!cache) return;
    if (viewport.folding && viewport.folding.isHiddenByFold && viewport.folding.isHiddenByFold(activeLine) && !viewport.folding.isCollapsed(activeLine)) return;
    const rowStart = cache.lineToFirstRow[activeLine] || 0;
    const rowCount = cache.lineToRows[activeLine] || 1;
    if (rowCount === 0) return;
    const inkHeight = this._inkHeight();
    const inkPad = this._inkPad();
    for (let r = 0; r < rowCount; r++) {
      const y = viewport.rowToY(rowStart + r) + inkPad;
      ctx.fillStyle = colors.currentLine;
      ctx.fillRect(this.gutterWidth, y, viewport.width - this.gutterWidth, inkHeight);
    }
  }

  _drawIndentGuides(ctx, buffer, viewport, colors, first, last, activeLine, cache) {
    if (!cache) return;
    const startX = this.gutterWidth + 16;
    const guideColor = colors.indentGuide || "rgba(255, 255, 255, 0.35)";
    const activeGuideColor = colors.indentGuideActive || "rgba(255, 255, 255, 0.65)";
    const folding = viewport.folding;

    for (let line = first; line <= last; line++) {
      if (folding && folding.isHiddenByFold && folding.isHiddenByFold(line) && !folding.isCollapsed(line)) continue;
      const text = buffer.getLine(line);
      const info = cache.lineInfo[line];
      if (!info) continue;
      const firstRow = cache.lineToFirstRow[line];
      const guides = computeIndentGuides(text, this.tabSize);
      if (guides.length === 0) continue;

      const breaks = info.breaks || [0, text.length];

      for (let r = 0; r < info.rows; r++) {
        const y = viewport.rowToY(firstRow + r);
        if (y + this.lineHeight < 0) continue;
        if (y > viewport.height) break;

        const rowStart = breaks[r] !== undefined ? breaks[r] : 0;
        const rowEnd = breaks[r + 1] !== undefined ? breaks[r + 1] : text.length;

        for (let i = 0; i < guides.length; i++) {
          const col = guides[i];
          if (col < rowStart || col > rowEnd) continue;
          const x = startX + (col - rowStart) * this.charWidth;
          if (x < this.gutterWidth) continue;
          if (x > viewport.width) continue;
          ctx.fillStyle = line === activeLine ? activeGuideColor : guideColor;
          ctx.fillRect(Math.round(x), y, 1, this.lineHeight);
        }
      }
    }
  }

  _drawDecorations(ctx, viewport, decorations, first, last, cache) {
    if (!cache) return;
    const colors = this.theme.colors;
    const startX = this.gutterWidth + 16;
    const inkHeight = this._inkHeight();
    const inkPad = this._inkPad();

    for (const dec of decorations) {
      if (dec.toLine < first || dec.fromLine > last) continue;

      const lineInfo = cache.lineInfo[dec.fromLine];
      if (!lineInfo) continue;
      const firstRow = cache.lineToFirstRow[dec.fromLine];
      if (firstRow === undefined) continue;
      const rowCol = colToRowCol(lineInfo.breaks || [0, 1], dec.fromCol);
      const y = viewport.rowToY(firstRow + rowCol.row) + inkPad;
      const x = startX + rowCol.colInRow * this.charWidth;
      const w = Math.max(1, (dec.toCol - dec.fromCol) * this.charWidth);

      if (dec.type === DECORATION_TYPE.OCCURRENCE) {
        ctx.fillStyle = colors.occurrence || "rgba(255, 255, 255, 0.09)";
        ctx.fillRect(x, y, w, inkHeight);
      } else if (dec.type === DECORATION_TYPE.BRACKET_MATCH) {
        ctx.fillStyle = colors.bracketMatch || "rgba(255, 215, 0, 0.35)";
        ctx.strokeStyle = colors.bracketMatchBorder || "rgba(255, 215, 0, 0.9)";
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, w, inkHeight);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, inkHeight - 1);
      } else if (dec.type === DECORATION_TYPE.SEARCH_MATCH) {
        ctx.fillStyle = colors.searchMatch || "rgba(255, 200, 0, 0.35)";
        ctx.fillRect(x, y, w, inkHeight);
      } else if (dec.type === DECORATION_TYPE.SEARCH_CURRENT) {
        ctx.fillStyle = colors.searchCurrent || "rgba(255, 140, 0, 0.55)";
        ctx.fillRect(x, y, w, inkHeight);
      } else if (dec.type === DECORATION_TYPE.DIAGNOSTIC_ERROR) {
        ctx.strokeStyle = colors.diagnosticError || "#f87171";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + inkHeight - 1);
        ctx.lineTo(x + w, y + inkHeight - 1);
        ctx.stroke();
      } else if (dec.type === DECORATION_TYPE.DIAGNOSTIC_WARNING) {
        ctx.strokeStyle = colors.diagnosticWarning || "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + inkHeight - 1);
        ctx.lineTo(x + w, y + inkHeight - 1);
        ctx.stroke();
      }
    }
  }

  _drawTokens(ctx, buffer, viewport, highlighter, tokenColors, first, last, cache) {
    if (!cache) return;
    const startX = this.gutterWidth + 16;
    const minX = this.gutterWidth;
    const maxX = viewport.width;
    const theme = this.theme;
    const bracketColors = theme.brackets || null;
    const rainbow = this.rainbowBrackets && bracketColors && bracketColors.length > 0;
    const folding = viewport.folding;

    ctx.save();
    ctx.beginPath();
    ctx.rect(minX, 0, maxX - minX, viewport.height);
    ctx.clip();

    let bracketDepth = 0;

    for (let line = first; line <= last; line++) {
      if (folding && folding.isHiddenByFold && folding.isHiddenByFold(line) && !folding.isCollapsed(line)) continue;
      const text = buffer.getLine(line);
      const info = cache.lineInfo[line];
      if (!info) continue;
      const firstRow = cache.lineToFirstRow[line];
      if (firstRow === undefined) continue;
      const rowCount = cache.lineToRows[line] || 0;
      if (rowCount === 0) continue;
      if (text.length === 0) continue;

      const entry = highlighter.getLineTokens(line, text);
      const tokens = entry.tokens;

      for (let r = 0; r < info.rows; r++) {
        const y = viewport.rowToY(firstRow + r);
        if (y + this.lineHeight < 0) continue;
        if (y > viewport.height) break;

        const rowStartCol = info.breaks ? info.breaks[r] : 0;
        const rowEndCol = info.breaks ? info.breaks[r + 1] : text.length;

        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          const tokStart = tok.start;
          const tokEnd = tok.end;
          if (tokEnd <= rowStartCol) continue;
          if (tokStart >= rowEndCol) break;

          const clipStart = Math.max(tokStart, rowStartCol);
          const clipEnd = Math.min(tokEnd, rowEndCol);
          const piece = text.slice(clipStart, clipEnd);
          const x = startX + (clipStart - rowStartCol) * this.charWidth;

          if (rainbow && tok.type === TOKEN.PUNCTUATION && piece.length === 1) {
            const ch = piece;
            if (OPEN_BRACKETS.indexOf(ch) !== -1) {
              ctx.fillStyle = bracketColors[bracketDepth % bracketColors.length];
              ctx.fillText(piece, x, y);
              bracketDepth++;
              continue;
            }
            if (CLOSE_BRACKETS.indexOf(ch) !== -1) {
              if (bracketDepth > 0) bracketDepth--;
              ctx.fillStyle = bracketColors[bracketDepth % bracketColors.length];
              ctx.fillText(piece, x, y);
              continue;
            }
          }

          ctx.fillStyle = tokenColors[tok.type] || tokenColors.text;
          ctx.fillText(piece, x, y);
        }
      }
    }

    ctx.restore();
  }

  _drawGutterBackground(ctx, viewport, colors) {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, this.gutterWidth, viewport.height);
    ctx.fillStyle = colors.gutter;
    ctx.fillRect(this.gutterWidth - 0.5, 0, 1, viewport.height);
  }

  _drawGutter(ctx, viewport, colors, first, last, activeLine, cache) {
    if (!cache) return;
    const folding = viewport.folding;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.gutterWidth, viewport.height);
    ctx.clip();
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.font = this._fontString;

    for (let line = first; line <= last; line++) {
      if (folding && folding.isHiddenByFold && folding.isHiddenByFold(line) && !folding.isCollapsed(line)) continue;
      const rowCount = cache.lineToRows[line] || 0;
      if (rowCount === 0) continue;
      const rowStart = cache.lineToFirstRow[line];
      if (rowStart === undefined) continue;
      const y = viewport.rowToY(rowStart);
      if (y + this.lineHeight < 0) continue;
      if (y > viewport.height) break;

      ctx.fillStyle = line === activeLine ? colors.lineNumberActive : colors.lineNumber;
      const x = this.gutterWidth - 10;
      ctx.fillText(String(line + 1), x, y);
    }

    ctx.restore();
  }

  _drawFoldMarkers(ctx, viewport, buffer, colors, first, last, cache) {
    const folding = viewport.folding;
    if (!folding) return;
    const ranges = folding.ranges || [];
    if (ranges.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.gutterWidth, viewport.height);
    ctx.clip();
    ctx.font = this._fontString;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const markerX = 6;

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const line = range.startLine;
      if (line < first || line > last) continue;
      if (folding.isHiddenByFold && folding.isHiddenByFold(line) && !folding.isCollapsed(line)) continue;
      const rowStart = cache.lineToFirstRow[line];
      if (rowStart === undefined) continue;
      const rowCount = cache.lineToRows[line] || 0;
      if (rowCount === 0) continue;
      const y = viewport.rowToY(rowStart);
      if (y + this.lineHeight < 0) continue;
      if (y > viewport.height) break;

      const collapsed = folding.collapsed.has(line);
      ctx.fillStyle = collapsed
        ? (colors.lineNumberActive || "#c6c6c6")
        : (colors.lineNumber || "#5a5a5a");
      ctx.fillText(collapsed ? "▸" : "▾", markerX, y);

      if (collapsed) {
        const text = buffer.getLine(line) || "";
        const textX = this.gutterWidth + 16 + text.length * this.charWidth;
        ctx.fillStyle = colors.gutter || "#5a5a5a";
        ctx.fillText(" … ", textX, y);
      }
    }

    ctx.restore();
  }

  _drawDiagnostics(ctx, viewport, diagnostics, colors, first, last, cache) {
    if (!cache) return;
    ctx.save();
    for (const d of diagnostics) {
      if (d.line < first || d.line > last) continue;
      const info = cache.lineInfo[d.line];
      if (!info) continue;
      const rowCount = cache.lineToRows[d.line] || 0;
      if (rowCount === 0) continue;
      const firstRow = cache.lineToFirstRow[d.line];
      if (firstRow === undefined) continue;
      const y = viewport.rowToY(firstRow) + this.lineHeight / 2;
      const x = this.gutterWidth - 6;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = d.severity === "error"
        ? (colors.diagnosticError || "#f87171")
        : (colors.diagnosticWarning || "#fbbf24");
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSelections(ctx, viewport, carets, colors, cache) {
    if (!cache) return;
    ctx.save();
    ctx.fillStyle = colors.selection;

    for (const caret of carets) {
      if (!caret.hasSelection()) continue;
      const s = caret.start();
      const e = caret.end();

      if (s.line === e.line) {
        this._drawSelectionRange(ctx, viewport, cache, s.line, s.col, e.col, colors.selection);
        continue;
      }

      const sLineLen = this._lineLength(cache, s.line);
      this._drawSelectionRange(ctx, viewport, cache, s.line, s.col, sLineLen + 1, colors.selection);

      for (let line = s.line + 1; line < e.line; line++) {
        const len = this._lineLength(cache, line);
        this._drawSelectionRange(ctx, viewport, cache, line, 0, len + 1, colors.selection);
      }

      this._drawSelectionRange(ctx, viewport, cache, e.line, 0, e.col, colors.selection);
    }

    ctx.restore();
  }

  _lineLength(cache, line) {
    const info = cache.lineInfo[line];
    if (!info) return 0;
    const breaks = info.breaks;
    if (!breaks) return 0;
    return breaks[breaks.length - 1];
  }

  _drawSelectionRange(ctx, viewport, cache, line, startCol, endCol, color) {
    if (startCol >= endCol) return;
    const info = cache.lineInfo[line];
    if (!info) return;
    const firstRow = cache.lineToFirstRow[line];
    if (firstRow === undefined) return;
    const rowCount = cache.lineToRows[line] || 0;
    if (rowCount === 0) return;
    const startX = this.gutterWidth + 16;

    ctx.fillStyle = color;

    const inkHeight = this._inkHeight();
    const inkPad = this._inkPad();

    if (!info.breaks) {
      const x = startX + startCol * this.charWidth;
      const y = viewport.rowToY(firstRow) + inkPad;
      const w = (endCol - startCol) * this.charWidth;
      ctx.fillRect(x, y, w, inkHeight);
      return;
    }

    const breaks = info.breaks;
    for (let r = 0; r < info.rows; r++) {
      const rowStart = breaks[r] !== undefined ? breaks[r] : 0;
      const rowEnd = breaks[r + 1] !== undefined ? breaks[r + 1] : rowStart + 1;
      const clipStart = Math.max(startCol, rowStart);
      const clipEnd = Math.min(endCol, rowEnd);
      if (clipStart >= clipEnd) continue;
      const x = startX + (clipStart - rowStart) * this.charWidth;
      const y = viewport.rowToY(firstRow + r) + inkPad;
      const w = (clipEnd - clipStart) * this.charWidth;
      ctx.fillRect(x, y, w, inkHeight);
    }
  }

  _drawCarets(ctx, viewport, carets, colors, cache) {
    if (!cache) return;
    ctx.save();
    ctx.fillStyle = colors.cursor;
    const width = Math.max(2, Math.round(this.charWidth / 5));

    for (const caret of carets) {
      const info = cache.lineInfo[caret.line];
      if (!info) continue;
      const rowCount = cache.lineToRows[caret.line] || 0;
      if (rowCount === 0) continue;
      const firstRow = cache.lineToFirstRow[caret.line];
      if (firstRow === undefined) continue;
      let row = 0;
      let colInRow = caret.col;
      if (info.breaks) {
        const rc = colToRowCol(info.breaks, caret.col);
        row = rc.row;
        colInRow = rc.colInRow;
      }
      const x = Math.round(this.gutterWidth + 16 + colInRow * this.charWidth);
      const rowTop = viewport.rowToY(firstRow + row);
      const caretHeight = this.fontSize + 2;
      const caretTop = rowTop + (this.lineHeight - caretHeight) / 2 - this.fontSize * 0.2;
      ctx.fillRect(x, caretTop, width, caretHeight);
    }

    ctx.restore();
  }

  hitTest(mouseX, mouseY, viewport, buffer) {
    if (!viewport._cache) {
      viewport.computeVisible(buffer.lines);
    }

    const localY = mouseY + viewport.scrollTop;

    const cache = viewport._cache;
    if (!cache) {
      return { line: 0, col: 0 };
    }

    let row = Math.floor((localY - viewport.metrics.padTop) / viewport.metrics.lineHeight);
    if (row < 0) row = 0;
    if (row >= cache.totalRows) row = cache.totalRows - 1;

    const line = (function () {
      let lo = 0;
      let hi = cache.lineToFirstRow.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        if (cache.lineToFirstRow[mid] <= row) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    })();

    if (cache.lineToRows[line] === 0 && viewport.folding) {
      let candidate = line;
      while (candidate >= 0 && cache.lineToRows[candidate] === 0) candidate--;
      if (candidate < 0) candidate = 0;
      return this.hitTest(mouseX, mouseY, viewport, buffer) || { line: candidate, col: 0 };
    }

    const info = cache.lineInfo[line];
    const firstRow = cache.lineToFirstRow[line];
    const rowInLine = row - firstRow;
    const lineText = buffer.getLine(line) || "";
    const breaks = info.breaks || [0, lineText.length];

    const gutterAndPad = this.gutterWidth + 16;
    const localX = mouseX + viewport.scrollLeft;
    const colInRow = Math.max(0, Math.round((localX - gutterAndPad) / this.charWidth));
    const rowStart = breaks[rowInLine] !== undefined ? breaks[rowInLine] : 0;
    const rowEnd = breaks[rowInLine + 1] !== undefined ? breaks[rowInLine + 1] : lineText.length;
    const maxCol = Math.max(0, rowEnd - rowStart);
    const clampedInRow = Math.min(colInRow, maxCol);
    const col = Math.min(rowStart + clampedInRow, lineText.length);

    return { line, col };
  }
}