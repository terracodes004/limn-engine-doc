import { LimnEditor } from "./core/editor.js";
import { Toolbar } from "./ui/toolbar.js";
import { FloatingMenu } from "./ui/menu.js";
import { SearchBar } from "./ui/searchbar.js";
import { Tabs } from "./ui/tabs.js";
import { Toast } from "./ui/toast.js";
import { Preview } from "./ui/preview.js";
import { NewFilePicker } from "./ui/newfile.js";
import { FileTree } from "./ui/filetree.js";
import { AppBar } from "./ui/appbar.js";
import { ContextMenu } from "./ui/contextmenu.js";
import { StatusBar } from "./ui/statusbar.js";
import { LanguagePicker } from "./ui/language-picker.js";
import { Autocomplete } from "./ui/autocomplete.js";
import { CommandPalette } from "./ui/command-palette.js";
import { Breadcrumb } from "./ui/breadcrumb.js";
import { SymbolPicker } from "./ui/symbol-picker.js";
import { DiagnosticsPopup } from "./ui/diagnostics-popup.js";
import { Minimap } from "./ui/minimap.js";
import { GotoLinePicker } from "./ui/goto-line.js";
import { StickyScroll } from "./core/sticky-scroll.js";
import { QuickFixMenu } from "./ui/quick-fix-menu.js";
import { suggestFixes } from "./core/quick-fix.js";
import { Folding } from "./core/folding.js";
import { Decoration } from "./core/decorations.js";
import { extractSymbols, currentSymbolAt } from "./core/symbols.js";
import { formatBuffer } from "./core/format.js";
import { findAll, replaceAllInLine } from "./core/search.js";
import { CloudAdapter } from "./core/cloud.js";
import { saveToLocal, loadFromLocal, clearLocal, applyStateToDocs, createDebouncedSaver } from "./core/storage.js";
import { downloadText, pickFile, copyText } from "./ui/download.js";
import { renderMarkdown, wrapMarkdownDocument } from "./core/markdown.js";
import { starterForExtension, uniqueName, resolveEngineUrl } from "./core/templates.js";
import { LANGUAGES, LANGUAGE_META } from "./core/languages.js";
import { findSnippet, SNIPPETS, snippetsForLanguage } from "./core/snippets.js";

function isTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const coarse = typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;
  return hasTouch || coarse;
}

function languageKeyForFilename(name) {
  if (!name) return "plaintext";
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "css") return "css";
  if (ext === "json") return "json";
  if (ext === "js" || ext === "mjs" || ext === "cjs" || ext === "jsx") return "javascript";
  return "plaintext";
}

function languageNameForKey(key) {
  const meta = LANGUAGE_META[key];
  return meta ? meta.name : "Plain Text";
}

function isWordChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

function distanceBetween(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpointOf(t1, t2) {
  return {
    clientX: (t1.clientX + t2.clientX) / 2,
    clientY: (t1.clientY + t2.clientY) / 2,
  };
}

const TAP_MAX_DISTANCE = 10;
const TAP_MAX_DURATION = 300;
const LONG_PRESS_DURATION = 500;
const COMPLETION_LOCK_MS = 350;
const MINIMAP_DEFAULT_W = 72;
const MIN_WORD_LEN = 2;
const MAX_OCCURRENCES = 500;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;
const PINCH_SENSITIVITY = 0.008;

export class LimnEditorComponent {
  constructor(options) {
    options = options || {};
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 800;
    this.height = options.height || 600;

    this.cloud = new CloudAdapter({
      client: options.supabase || null,
      onAuthChange: () => this._onAuthChange(),
    });

    this.editor = new LimnEditor({
      value: options.value || "",
      name: options.name,
      width: this.width,
      height: this.height,
      tabSize: options.tabSize || 4,
      autoIndent: options.autoIndent !== false,
      autoPairs: options.autoPairs !== false,
      showIndentGuides: options.showIndentGuides,
      theme: options.theme,
      onChange: options.onChange,
      onCursor: options.onCursor,
      onSelectionChange: options.onSelectionChange,
      onDocumentsChange: () => this._onDocumentsChange(),
    });

    this.buildGameHTML = options.buildGameHTML || null;
    this.getEngineCode = options.getEngineCode || null;
    this.getAssets = options.getAssets || null;
    this.engineUrl = options.engineUrl || "epic.js";
    this.onPublish = options.onPublish || null;
    this.onShare = options.onShare || null;
    this.autocompleteEnabled = options.autocomplete !== false;

    this._canvas = null;
    this._ctx = null;
    this._attached = false;
    this._lastCursorVisible = true;
    this._touch = isTouchDevice();
    this._gamePaused = false;
    this._autoSaver = null;
    this._dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    this._autocompleteOpen = false;
    this._completionAcceptedAt = 0;
    this._suppressNextBeforeInput = 0;

    this._appbar = null;
    this._toolbar = null;
    this._menu = null;
    this._searchbar = null;
    this._tabs = null;
    this._statusbar = null;
    this._toast = null;
    this._preview = null;
    this._newfile = null;
    this._filetree = null;
    this._contextmenu = null;
    this._langpick = null;
    this._autocomplete = null;
    this._commandPalette = null;
    this._breadcrumb = null;
    this._symbolPicker = null;
    this._symbols = [];
    this._statsPopup = null;
    this._diagPopup = null;
    this._quickFixMenu = null;
    this._gotoPicker = null;
    this._hoverTooltip = null;
    this._hoverHideTimer = null;
    this._lastBreadcrumbLine = -1;
    this._savedLanguageKeys = {};

    this._minimap = null;
    this._minimapVisible = true;
    try {
      const stored = localStorage.getItem("limn:minimap");
      if (stored === "0") this._minimapVisible = false;
    } catch (e) {}

    this._folding = new Folding();

    this._stickyScroll = null;
    this._stickyScrollVisible = true;
    this._basePadTop = undefined;
    try {
      const storedSticky = localStorage.getItem("limn:sticky");
      if (storedSticky === "0") this._stickyScrollVisible = false;
    } catch (e) {}

    this._pinchActive = false;
    this._pinchStartDist = 0;
    this._pinchStartFontSize = DEFAULT_FONT_SIZE;
    this._pinchAnchor = null;

    this._clipboard = "";
    this._snippetSession = null;
    this._addingCursorMode = false;
    this._occurrenceTimer = null;
    this._lastOccurrenceWord = "";
    this._lastOccurrenceLine = -1;

    this._searchState = {
      query: "",
      replacement: "",
      options: { caseSensitive: false, wholeWord: false, regex: false },
      matches: [],
      current: 0,
    };

    this._touchStartTime = 0;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchLastX = 0;
    this._touchLastY = 0;
    this._touchLastTime = 0;
    this._touchVelocityX = 0;
    this._touchVelocityY = 0;
    this._touchMode = "idle";
    this._longPressTimer = null;
    this._suppressClick = false;
    this._flingRaf = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onBeforeInput = this._onBeforeInput.bind(this);
    this._onInput = this._onInput.bind(this);
    this._onPaste = this._onPaste.bind(this);
    this._onCopy = this._onCopy.bind(this);
    this._onCut = this._onCut.bind(this);
    this._onCompositionStart = this._onCompositionStart.bind(this);
    this._onCompositionEnd = this._onCompositionEnd.bind(this);
    this._onFocus = this._onFocus.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onBeforeUnload = this._onBeforeUnload.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onHoverMove = this._onHoverMove.bind(this);
    this._onHoverOut = this._onHoverOut.bind(this);

    this._dragging = false;
    this._focused = false;
    this._composing = false;
    this._input = null;
  }

  async attach(display) {
    this.display = display;

    if (!this._canvas) {
      this._canvas = document.createElement("canvas");
      this._canvas.style.position = "absolute";
      this._canvas.style.left = this.x + "px";
      this._canvas.style.top = this.y + "px";
      this._canvas.style.pointerEvents = "none";
      this._canvas.style.outline = "none";
      this._canvas.style.display = "block";
      this._ctx = this._canvas.getContext("2d");

      const parent = display.canvas.parentNode;
      parent.style.position = parent.style.position || "relative";
      parent.insertBefore(this._canvas, display.canvas.nextSibling);
    }

    try {
      const storedFont = parseInt(localStorage.getItem("limn:fontSize") || "", 10);
      if (!isNaN(storedFont) && storedFont >= MIN_FONT_SIZE && storedFont <= MAX_FONT_SIZE) {
        this.editor.setFontSize(storedFont);
      }
    } catch (e) {}

    if (!this._minimap) {
      this._minimap = new Minimap(this, { width: MINIMAP_DEFAULT_W, semantic: true });
      const mmParent = this._canvas ? this._canvas.parentNode : display.canvas.parentNode;
      this._minimap.attach(mmParent);
      this._minimap.setVisible(this._minimapVisible);
      if (this._canvas && this._ctx) {
        const w = this._minimapVisible ? (this._minimap.width || MINIMAP_DEFAULT_W) : 0;
        const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
        const editorW = Math.max(0, window.innerWidth - w);
        this._canvas.width = Math.round(editorW * dpr);
        this._canvas.style.width = editorW + "px";
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    if (!this._stickyScroll) {
      this._stickyScroll = new StickyScroll(this.editor, {
        maxRows: 2,
        rowHeight: this.editor.renderer.lineHeight,
        padding: 4,
      });
      this._stickyScroll.setEnabled(this._stickyScrollVisible);
    }

    if (this._folding) {
      this.editor.setFolding(this._folding);
    }

    if (this._basePadTop === undefined) {
      this._basePadTop = this.editor.viewport.metrics.padTop;
    }

    this._createInputProxy(display.canvas.parentNode);
    this._bindEvents();
    this._setupUI();
    this._attached = true;
    this.resize(window.innerWidth, window.innerHeight);
    requestAnimationFrame(() => this.resize(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", this._onWindowResize);
    window.addEventListener("beforeunload", this._onBeforeUnload);

    this._watchGameState();

    await this._restoreSession();

    if (this._filetree && !this._filetree.isOpen()) {
      this._filetree.open();
    }

    this._autoSaver = createDebouncedSaver(
      this.editor.documents,
      () => this.editor.documents.active ? this.editor.documents.active.id : null,
      800
    );

    this._syncStatusBar();
    this._refreshSymbols();
    this._refreshBreadcrumb();
    this._refreshStats();
    this._updateDiagnosticsBadge();
    this._updateOccurrences();
  }

  detach() {
    if (!this._attached) return;
    if (this._occurrenceTimer) {
      clearTimeout(this._occurrenceTimer);
      this._occurrenceTimer = null;
    }
    if (this._hoverHideTimer) {
      clearTimeout(this._hoverHideTimer);
      this._hoverHideTimer = null;
    }
    window.removeEventListener("resize", this._onWindowResize);
    window.removeEventListener("beforeunload", this._onBeforeUnload);
    this._unbindEvents();
    if (this._flingRaf) {
      cancelAnimationFrame(this._flingRaf);
      this._flingRaf = null;
    }
    if (this._autoSaver) this._autoSaver.flush();
    if (this._appbar) this._appbar.destroy();
    if (this._toolbar) this._toolbar.destroy();
    if (this._menu) this._menu.destroy();
    if (this._searchbar) this._searchbar.destroy();
    if (this._tabs) this._tabs.destroy();
    if (this._statusbar) this._statusbar.destroy();
    if (this._toast) this._toast.destroy();
    if (this._preview) this._preview.destroy();
    if (this._newfile) this._newfile.destroy();
    if (this._filetree) this._filetree.destroy();
    if (this._contextmenu) this._contextmenu.destroy();
    if (this._langpick) this._langpick.destroy();
    if (this._autocomplete) this._autocomplete.destroy();
    if (this._commandPalette) this._commandPalette.destroy();
    if (this._breadcrumb) this._breadcrumb.destroy();
    if (this._symbolPicker) this._symbolPicker.destroy();
    if (this._statsPopup && this._statsPopup.parentNode) {
      this._statsPopup.parentNode.removeChild(this._statsPopup);
    }
    if (this._diagPopup) this._diagPopup.destroy();
    if (this._quickFixMenu) this._quickFixMenu.destroy();
    if (this._gotoPicker) this._gotoPicker.destroy();
    if (this._hoverTooltip && this._hoverTooltip.parentNode) {
      this._hoverTooltip.parentNode.removeChild(this._hoverTooltip);
    }
    if (this._minimap) {
      this._minimap.destroy();
      this._minimap = null;
    }
    this._stickyScroll = null;
    if (this._input && this._input.parentNode) {
      this._input.parentNode.removeChild(this._input);
    }
    this._input = null;
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._ctx = null;
    this._attached = false;
  }

  async _restoreSession() {
    const localState = loadFromLocal();
    if (localState && localState.items && localState.items.length > 0) {
      applyStateToDocs(this.editor.documents, localState);
      this._onDocumentsChange();
      this.showToast("Restored " + localState.items.length + " file(s)", "info");
    }
  }

  _onBeforeUnload() {
    if (this._autoSaver) this._autoSaver.flush();
  }

  _watchGameState() {
    const check = () => {
      const paused = document.body.classList.contains("game-open");
      if (paused !== this._gamePaused) {
        this._gamePaused = paused;
        this.renderForce();
      }
    };
    check();
    if (typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(check);
      obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } else {
      setInterval(check, 500);
    }
  }

  _onDocumentsChange() {
    if (this._folding) {
      this._folding.reset();
      if (this.editor.viewport) {
        this.editor.viewport.folding = this._folding;
        this.editor.viewport.invalidate();
      }
    }
    this._lastOccurrenceWord = "";
    this._lastOccurrenceLine = -1;
    if (this._tabs) this._tabs.update(this.editor.documents);
    if (this._filetree) this._filetree.update(this.editor.documents);
    if (this._appbar) {
      const doc = this.editor.activeDoc;
      this._appbar.setTitle(doc ? doc.name : "");
    }
    this._syncStatusBar();
    this._syncToolbar();
    this.renderForce();
    if (this._autoSaver) this._autoSaver.schedule();
    this._refreshSymbols();
    this._refreshBreadcrumb();
    this._refreshStats();
    this._updateDiagnosticsBadge();
    this._updateOccurrences();
  }

  _onAuthChange() {}

  _syncStatusBar() {
    if (!this._statusbar) return;
    const cursor = this.editor.getCursor();
    this._statusbar.setCursor(cursor.line, cursor.col);
    this._syncCursorCount();

    const sel = this.editor.getSelection();
    let selCount = 0;
    if (sel && sel.length && sel[0].hasSelection) {
      const s = sel[0].start;
      const e = sel[0].end;
      if (s.line === e.line) {
        selCount = e.col - s.col;
      } else {
        const first = this.editor.buffer.lineLength(s.line) - s.col;
        const last = e.col;
        let middle = 0;
        for (let i = s.line + 1; i < e.line; i++) {
          middle += this.editor.buffer.lineLength(i) + 1;
        }
        selCount = first + middle + last;
      }
    }
    this._statusbar.setSelection(selCount);
    this._statusbar.setTabSize(this.editor.renderer.tabSize);

    const doc = this.editor.activeDoc;
    if (doc) {
      const key = languageKeyForFilename(doc.name);
      const activeKey = doc.languageKey || key;
      const name = activeKey === "plaintext" && key !== "plaintext"
        ? "Plain Text"
        : languageNameForKey(activeKey);
      this._statusbar.setLanguage(name);
      this._statusbar.setLineEnding(doc.lineEnding || "lf");
      this._statusbar.setSaved(doc.dirty ? "dirty" : "saved");
    }
    this._statusbar.setWordWrap(this.editor.isWordWrap());
    this._statusbar.setMinimap(this._minimapVisible);
    this._refreshBreadcrumb();
  }

  _updateOccurrences() {
    if (this._occurrenceTimer) {
      clearTimeout(this._occurrenceTimer);
      this._occurrenceTimer = null;
    }
    this._occurrenceTimer = setTimeout(() => {
      this._occurrenceTimer = null;
      this._computeOccurrencesNow();
    }, 60);
  }

  _computeOccurrencesNow() {
    const editor = this.editor;
    if (!editor || !editor.buffer || !editor.carets) return;
    const primary = editor.carets[0];
    if (!primary) return;

    if (editor.carets.length > 1) {
      editor.decorations.clearType("occurrence");
      editor._dirty = true;
      return;
    }

    if (primary.hasSelection && primary.hasSelection()) {
      editor.decorations.clearType("occurrence");
      editor._dirty = true;
      return;
    }

    const buffer = editor.buffer;
    const line = primary.line;
    const col = primary.col;
    const text = buffer.getLine(line) || "";

    let start = col;
    let end = col;
    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < text.length && isWordChar(text[end])) end++;
    const word = text.slice(start, end);

    if (word.length < MIN_WORD_LEN) {
      editor.decorations.clearType("occurrence");
      editor._dirty = true;
      this._lastOccurrenceWord = "";
      this._lastOccurrenceLine = line;
      return;
    }

    if (word === this._lastOccurrenceWord && line === this._lastOccurrenceLine) {
      return;
    }
    this._lastOccurrenceWord = word;
    this._lastOccurrenceLine = line;

    editor.decorations.clearType("occurrence");

    const lineCount = buffer.lineCount();
    let count = 0;
    const needleLen = word.length;

    for (let i = 0; i < lineCount; i++) {
      if (count >= MAX_OCCURRENCES) break;
      const lineText = buffer.getLine(i);
      if (!lineText) continue;
      let pos = 0;
      while (pos <= lineText.length - needleLen) {
        const at = lineText.indexOf(word, pos);
        if (at === -1) break;
        const beforeOk = at === 0 || !isWordChar(lineText[at - 1]);
        const afterOk = at + needleLen >= lineText.length || !isWordChar(lineText[at + needleLen]);
        if (beforeOk && afterOk) {
          if (!(i === line && at === start)) {
            const dec = new Decoration("occurrence", i, at, i, at + needleLen, null);
            editor.decorations.add(dec);
            count++;
            if (count >= MAX_OCCURRENCES) break;
          }
        }
        pos = at + needleLen;
      }
    }

    editor._dirty = true;
  }

  _setupUI() {
    this._toast = new Toast();
    this._toast.mount(document.body);

    this._preview = new Preview({});
    this._preview.mount(document.body);

    this._newfile = new NewFilePicker({
      onCreate: (lang) => {
        const name = uniqueName(this.editor.documents.items, lang.ext);
        const value = starterForExtension(lang.ext);
        this.editor.newDocument({ name: name, value: value });
        this._onDocumentsChange();
        this.showToast("Created " + name, "success");
      },
    });
    this._newfile.mount(document.body);

    this._filetree = new FileTree({
      onSelect: (doc) => {
        this.editor.switchToId(doc.id);
        this._onDocumentsChange();
        this._filetree.close();
      },
      onClose: () => this._filetree.close(),
      onDismiss: () => this._filetree.close(),
      onNew: () => { this._filetree.close(); this._newfile.open(); },
      onRename: (doc) => {
        const newName = prompt("Rename file:", doc.name);
        if (newName) {
          const idx = this.editor.documents.items.indexOf(doc);
          this.editor.documents.rename(idx, newName);
          this._onDocumentsChange();
        }
      },
      onDelete: (doc) => {
        if (doc.dirty) {
          if (!confirm('Close "' + doc.name + '" without saving?')) return;
        }
        this.editor.closeDocument(doc.id);
        this._onDocumentsChange();
      },
      onDownload: (doc) => {
        let content = doc.getValue();
        if (languageKeyForFilename(doc.name) === "html") {
          content = resolveEngineUrl(content, this.engineUrl);
        }
        downloadText(doc.name, content);
        this.showToast("Downloaded " + doc.name, "success");
      },
      onStateChange: (open) => {
        if (this._appbar) this._appbar.setFilesActive(open);
      },
    });
    this._filetree.mount(document.body);

    this._tabs = new Tabs({
      onSelect: (doc) => {
        this.editor.switchToId(doc.id);
        this._onDocumentsChange();
      },
      onClose: (doc) => {
        if (doc.dirty) {
          if (!confirm('Close "' + doc.name + '" without saving?')) return;
        }
        this.editor.closeDocument(doc.id);
        this._onDocumentsChange();
      },
      onNew: () => { this._newfile.open(); },
      onRename: (doc) => {
        const newName = prompt("Rename file:", doc.name);
        if (newName) {
          const idx = this.editor.documents.items.indexOf(doc);
          this.editor.documents.rename(idx, newName);
          this._onDocumentsChange();
        }
      },
    });
    this._tabs.mount(document.body);
    this._tabs.update(this.editor.documents);

    this._appbar = new AppBar({
      onFiles: () => this._filetree.toggle(),
      onSearch: () => this._openFind(false),
      onNew: () => this._newfile.open(),
      onMenu: () => { if (this._menu) this._menu.toggle(); },
      onSymbols: () => this._openSymbolPicker(),
      onTitle: () => {
        const doc = this.editor.activeDoc;
        if (!doc) return;
        const newName = prompt("Rename file:", doc.name);
        if (newName) {
          const idx = this.editor.documents.items.indexOf(doc);
          this.editor.documents.rename(idx, newName);
          this._onDocumentsChange();
        }
      },
    });
    this._appbar.mount(document.body);

    this._breadcrumb = new Breadcrumb({
      onTapLanguage: () => this._openLanguagePicker(),
      onTapSymbol: () => this._openSymbolPicker(),
    });
    this._breadcrumb.mount(document.body);

    this._symbolPicker = new SymbolPicker({
      onPick: (sym) => this._jumpToSymbol(sym),
    });
    this._symbolPicker.mount(document.body);

    const statsPopup = document.createElement("div");
    statsPopup.className = "limn-stats-popup";
    document.body.appendChild(statsPopup);
    this._statsPopup = statsPopup;

    const hoverTooltip = document.createElement("div");
    hoverTooltip.className = "limn-hover-tooltip";
    document.body.appendChild(hoverTooltip);
    this._hoverTooltip = hoverTooltip;

    this._diagPopup = new DiagnosticsPopup({
      onJump: (line, col) => {
        this.editor.setCursor(line, col || 0);
        this.editor.viewport.ensurePositionVisible(line, col || 0);
        this.renderForce();
        this._syncStatusBar();
      },
      onFix: (diagnostic) => {
        this._handleDiagnosticFix(diagnostic);
      },
      canFix: (diagnostic) => {
        const fixes = suggestFixes(this.editor.buffer, diagnostic);
        return fixes && fixes.length > 0;
      },
    });
    this._diagPopup.mount(document.body);

    this._quickFixMenu = new QuickFixMenu({
      onPick: (fix) => this._applyQuickFix(fix),
    });
    this._quickFixMenu.mount(document.body);

    this._gotoPicker = new GotoLinePicker({
      onGo: (targetLine) => this._doGotoLine(targetLine),
    });
    this._gotoPicker.mount(document.body);

    if (this._touch) {
      this._toolbar = new Toolbar({
        onUndo: () => { this.editor.undo(); this.renderForce(); this._syncToolbar(); this._syncStatusBar(); },
        onRedo: () => { this.editor.redo(); this.renderForce(); this._syncToolbar(); this._syncStatusBar(); },
        onTab: () => {
          if (this._autocomplete && this._autocomplete.isOpen()) {
            this._autocomplete.accept();
            return;
          }
          if (this._handleTabSnippet()) {
            this.renderForce();
            this._syncToolbar();
            this._syncStatusBar();
            return;
          }
          if (this._handleTabEmmet()) {
            this.renderForce();
            this._syncToolbar();
            this._syncStatusBar();
            return;
          }
          this.editor.handleTab(false);
          this.renderForce();
          this._syncToolbar();
          this._syncStatusBar();
        },
        onEnter: () => {
          if (this._autocomplete && this._autocomplete.isOpen()) {
            this._autocomplete.accept();
            return;
          }
          this.editor.newline();
          this.renderForce();
          this._syncToolbar();
          this._syncStatusBar();
        },
        onMenu: () => { if (this._menu) this._menu.toggle(); },
      });
      this._toolbar.mount(document.body);
      this._toolbar.show();
      this._syncToolbar();
    }

    this._searchbar = new SearchBar({
      onQueryChange: () => this._searchUpdate(),
      onFindNext: () => this._searchNext(),
      onFindPrev: () => this._searchPrev(),
      onReplaceOne: () => this._searchReplaceOne(),
      onReplaceAll: () => this._searchReplaceAll(),
      onClose: () => this._searchClose(),
    });
    this._searchbar.mount(document.body);

    this._contextmenu = new ContextMenu({});
    this._contextmenu.setItems(this._buildContextMenuItems());

    this._langpick = new LanguagePicker({
      onPick: (key) => {
        this._applyLanguageToActive(key);
      },
    });
    this._langpick.mount(document.body);

    this._autocomplete = new Autocomplete({
      onAccept: (item) => this._acceptCompletion(item),
      onDismiss: () => {
        this._autocompleteOpen = false;
        this.editor.cursorHidden = false;
        this.renderForce();
      },
    });
    this._autocomplete.mount(document.body);

    this._statusbar = new StatusBar({
      onGotoLine: () => this._openGotoPicker(),
      onCycleTabSize: () => this._cycleTabSize(),
      onPickLanguage: () => {
        const doc = this.editor.activeDoc;
        if (!doc) return;
        const key = languageKeyForFilename(doc.name);
        this._langpick.currentKey = key;
        this._langpick.open();
      },
      onToggleLineEnding: () => this._toggleLineEnding(),
      onShowStats: (anchorEl) => this._toggleStatsPopup(anchorEl),
      onToggleWrap: () => this._toggleWordWrap(),
      onShowDiagnostics: (anchorEl) => this._showDiagnostics(anchorEl),
      onToggleMinimap: () => this._toggleMinimap(),
      onScrollTop: () => this._scrollToTop(),
    });
    this._statusbar.mount(document.body);

    this._menu = new FloatingMenu({
      items: [
        { header: "File" },
        { icon: "📁", label: "Files", action: () => this._filetree.toggle() },
        { icon: "🆕", label: "New file", shortcut: "Ctrl+N", action: () => this._newfile.open() },
        { icon: "💾", label: "Save", shortcut: "Ctrl+S", action: () => this.save() },
        { icon: "📝", label: "Save as…", action: () => this.saveAs() },
        { icon: "📂", label: "Open file", shortcut: "Ctrl+O", action: () => this.openFile() },
        { icon: "⬇", label: "Download", action: () => this.download() },
        { icon: "▶", label: "Preview", shortcut: "Ctrl+⇧+V", action: () => this.preview() },
        { divider: true },
        { header: "Cloud" },
        { icon: "☁", label: "Load from cloud", action: () => this.loadFromCloud() },
        { icon: "🚀", label: "Publish", action: () => this.publish() },
        { icon: "🔗", label: "Share link", action: () => this.share() },
        { divider: true },
        { header: "Navigate" },
        { icon: "ƒ", label: "Jump to symbol", shortcut: "Ctrl+⇧+O", action: () => this._openSymbolPicker() },
        { icon: "⌘", label: "Command palette", shortcut: "Ctrl+K", action: () => this._commandPalette.open() },
        { icon: "✕", label: "Show diagnostics", action: () => {
          const el = this._statusbar && this._statusbar._diagEl;
          if (el) this._showDiagnostics(el);
        } },
        { icon: "🔍", label: "Find", shortcut: "Ctrl+F", action: () => this._openFind(false) },
        { icon: "✏️", label: "Replace", shortcut: "Ctrl+H", action: () => this._openFind(true) },
        { icon: "→", label: "Go to line", action: () => this._openGotoPicker() },
        { icon: "⬆", label: "Scroll to top", action: () => this._scrollToTop() },
        { divider: true },
        { header: "Edit" },
        { icon: "✨", label: "Format code", shortcut: "Ctrl+⇧+I", action: () => this._formatDocument() },
        { icon: "T", label: "Edit as Code / Text", action: () => this._toggleTextMode() },
        { icon: "💬", label: "Toggle comment", shortcut: "Ctrl+/", action: () => { this.editor.toggleComment(); this.renderForce(); } },
        { icon: "▦", label: "Toggle block comment", shortcut: "Ctrl+⇧+/", action: () => this._toggleBlockCommentActive() },
        { icon: "⇥", label: "Indent", action: () => { this.editor.handleTab(false); this.renderForce(); } },
        { icon: "⇤", label: "Outdent", action: () => { this.editor.handleTab(true); this.renderForce(); } },
        { icon: "⧉", label: "Duplicate line", shortcut: "Ctrl+D", action: () => { this.editor.duplicateLine(); this.renderForce(); this._syncToolbar(); } },
        { icon: "↑", label: "Move line up", shortcut: "Alt+↑", action: () => { this.editor.moveLineUp(); this.renderForce(); } },
        { icon: "↓", label: "Move line down", shortcut: "Alt+↓", action: () => { this.editor.moveLineDown(); this.renderForce(); } },
        { icon: "✕", label: "Delete line", shortcut: "Ctrl+⇧+K", action: () => { this.editor.deleteLine(); this.renderForce(); this._syncToolbar(); } },
        { icon: "⊕", label: "Add cursor", action: () => this._addCursorFromMenu() },
        { icon: "↑", label: "Add cursor above", action: () => this._addCursorAbove() },
        { icon: "↓", label: "Add cursor below", action: () => this._addCursorBelow() },
        { icon: "⊖", label: "Clear extra cursors", action: () => this._clearExtraCursors() },
        { icon: "⚡", label: "Snippets…", action: () => this._showSnippetMenu() },
        { divider: true },
        { header: "View" },
        { icon: "↵", label: "Toggle word wrap", action: () => this._toggleWordWrap() },
        { icon: "#", label: "Show statistics", action: () => {
          const el = this._statusbar && this._statusbar._statsEl;
          if (el) this._toggleStatsPopup(el);
        } },
        { icon: "🎨", label: "Cycle theme", shortcut: "Ctrl+⇧+T", action: () => { this.editor.cycleTheme(); this.renderForce(); } },
        { icon: "📐", label: "Indent guides", action: () => {
          const show = !this.editor.renderer.showIndentGuides;
          this.editor.setShowIndentGuides(show);
          this.renderForce();
        } },
        { icon: "▤", label: "Toggle minimap", action: () => this._toggleMinimap() },
        { icon: "🌈", label: "Rainbow brackets", action: () => {
          this.editor.renderer.rainbowBrackets = !this.editor.renderer.rainbowBrackets;
          this.showToast(
            "Rainbow brackets " + (this.editor.renderer.rainbowBrackets ? "on" : "off"),
            "success",
            1200
          );
          this.renderForce();
        } },
        { icon: "📌", label: "Sticky scroll", action: () => this._toggleStickyScroll() },
        { icon: "▾", label: "Fold all", action: () => this._foldAll() },
        { icon: "▸", label: "Unfold all", action: () => this._unfoldAll() },
      ],
      rows: [
        {
          label: "Font size",
          value: this.editor.renderer.fontSize,
          onDecrement: () => this._adjustFontSize(-1),
          onIncrement: () => this._adjustFontSize(1),
        },
      ],
    });
    this._menu.mount(document.body);
    if (this._touch) this._menu.hideFab();
    else this._menu.showFab();

    this._commandPalette = new CommandPalette({
      onRun: () => {
        this._completionAcceptedAt = Date.now();
        if (this._input) this._input.focus();
      },
    });
    this._commandPalette.mount(document.body);
    this._commandPalette.setCommands(this._buildCommands());

    const doc = this.editor.activeDoc;
    if (doc) this._appbar.setTitle(doc.name);
  }

  _openGotoPicker() {
    if (!this._gotoPicker) return;
    const cur = this.editor.getCursor();
    const max = this.editor.buffer.lineCount();
    this._gotoPicker.open(cur.line, max);
  }

  _doGotoLine(targetLine) {
    const max = this.editor.buffer.lineCount() - 1;
    if (targetLine < 0) targetLine = 0;
    if (targetLine > max) targetLine = max;
    this.editor.setCursor(targetLine, 0);
    this.editor.viewport.ensurePositionVisible(targetLine, 0);
    this.editor.viewport.scrollToLineCentered(targetLine);
    this.editor.notifyInput();
    this.editor._emitCursor();
    this.renderForce();
    this._syncStatusBar();
    if (this._input) this._input.focus();
  }

  _scrollToTop() {
    this.editor.setScroll(0, 0);
    this.editor.viewport.invalidate();
    this.renderForce();
    const doc = this.editor.activeDoc;
    if (doc) {
      doc.scrollTop = 0;
      doc.scrollLeft = 0;
    }
    this.showToast("Scrolled to top", "info", 900);
  }

  _toggleBlockCommentActive() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const key = doc.languageKey || languageKeyForFilename(doc.name);
    if (key === "plaintext" || key === "markdown") {
      this.showToast("No block comments for " + languageNameForKey(key), "info", 1400);
      return;
    }
    this.editor.toggleBlockComment(key);
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    if (this._autoSaver) this._autoSaver.schedule();
  }

  _handleTabEmmet() {
    const doc = this.editor.activeDoc;
    if (!doc) return false;
    const langKey = doc.languageKey || languageKeyForFilename(doc.name);
    if (langKey !== "html") return false;
    const ok = this.editor.expandEmmet(langKey);
    if (ok) {
      this._suppressNextBeforeInput = Date.now();
      if (this._autoSaver) this._autoSaver.schedule();
      this._updateDiagnosticsBadge();
      this._syncStatusBar();
    }
    return ok;
  }

  _addCursorFromMenu() {
    const primary = this.editor.carets[0];
    if (!primary) return;
    this._addingCursorMode = true;
    this.showToast("Tap to add cursor. Escape when done.", "info", 2000);
  }

  _addCursorAt(line, col) {
    const editor = this.editor;
    const exists = editor.carets.some((c) => c.line === line && c.col === col);
    if (exists) return;
    const CaretClass = editor.carets[0].constructor;
    const caret = new CaretClass(line, col);
    editor.carets.push(caret);
    editor.controller.setCarets(editor.carets);
    editor._emitCursor();
    this._updateOccurrences();
    this.renderForce();
    this._syncCursorCount();
    this._syncStatusBar();
  }

  _addCursorAbove() {
    const editor = this.editor;
    const primary = editor.carets[0];
    if (!primary) return;
    let target = primary.line - 1;
    if (target < 0) target = 0;
    const col = Math.min(primary.col, editor.buffer.lineLength(target));
    this._addCursorAt(target, col);
  }

  _addCursorBelow() {
    const editor = this.editor;
    const primary = editor.carets[0];
    if (!primary) return;
    let target = primary.line + 1;
    const max = editor.buffer.lineCount() - 1;
    if (target > max) target = max;
    const col = Math.min(primary.col, editor.buffer.lineLength(target));
    this._addCursorAt(target, col);
  }

  _clearExtraCursors() {
    const editor = this.editor;
    if (editor.carets.length <= 1) {
      this._addingCursorMode = false;
      return;
    }
    const keep = editor.carets[0].clone();
    editor.carets.length = 0;
    editor.carets.push(keep);
    editor.controller.setCarets(editor.carets);
    this._addingCursorMode = false;
    editor._emitCursor();
    this._updateOccurrences();
    this.renderForce();
    this._syncCursorCount();
    this._syncStatusBar();
  }

  _syncCursorCount() {
    if (!this._statusbar) return;
    const n = this.editor.carets.length;
    if (typeof this._statusbar.setCursors === "function") {
      this._statusbar.setCursors(n);
    }
  }

  _foldAll() {
    const n = this.editor.foldAll();
    this.renderForce();
    this.showToast("Folded " + n + " block(s)", "success", 1200);
  }

  _unfoldAll() {
    const n = this.editor.unfoldAll();
    this.renderForce();
    this.showToast("Unfolded " + n + " block(s)", "success", 1200);
  }

  _expandFoldAtCursor() {
    const caret = this.editor.carets[0];
    if (!caret) return;
    const folding = this.editor.folding;
    if (!folding) return;
    if (folding.expandContaining(caret.line, this.editor.buffer)) {
      this.editor.viewport.invalidate();
      this.editor._syncViewportContent();
      this.renderForce();
    }
  }

  _handleDiagnosticFix(diagnostic) {
    const fixes = suggestFixes(this.editor.buffer, diagnostic);
    if (!fixes || fixes.length === 0) {
      this.showToast("No fix available", "warning", 1200);
      return;
    }
    if (fixes.length === 1) {
      this._applyQuickFix(fixes[0]);
      return;
    }
    this.editor.setCursor(diagnostic.line, diagnostic.col || 0);
    this.editor.viewport.ensurePositionVisible(diagnostic.line, diagnostic.col || 0);
    this.renderForce();
    this._syncStatusBar();
    const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const vp = this.editor.viewport;
    const r = this.editor.renderer;
    const cache = vp._cache;
    let px = rect.left + r.gutterWidth;
    let py = rect.top + 100;
    if (cache && cache.lineInfo[diagnostic.line]) {
      const firstRow = cache.lineToFirstRow[diagnostic.line] || 0;
      py = rect.top + vp.rowToY(firstRow) + r.lineHeight + 4;
    }
    this._quickFixMenu.show(px, py, fixes);
  }

  _applyQuickFix(fix) {
    if (!fix) return;
    const doc = this.editor.activeDoc;
    if (!doc) return;

    const editor = this.editor;
    const buffer = editor.buffer;
    const history = editor.history;

    const beforeSelection = editor.carets.map((c) => c.clone());
    const beforeText = buffer.getText();
    const beforeLines = buffer.lines.slice();

    let result = null;
    let afterText = beforeText;
    try {
      const cloned = buffer.clone();
      result = fix.apply(cloned);
      afterText = cloned.getText();
    } catch (e) {
      this.showToast("Fix failed", "error", 1500);
      return;
    }

    if (afterText === beforeText) {
      this.showToast("No change", "info", 1200);
      return;
    }

    buffer.setText(afterText);
    const afterLines = buffer.lines.slice();
    const afterSelection = editor.carets.map((c) => c.clone());

    history.undoStack.push({
      isSnapshot: true,
      undoSnapshot: beforeLines,
      redoSnapshot: afterLines,
      selectionBefore: beforeSelection,
      selectionAfter: afterSelection,
      label: "quickfix",
      time: Date.now(),
    });
    if (history.undoStack.length > history.maxEntries) history.undoStack.shift();
    history.redoStack.length = 0;

    if (result && typeof result.line === "number") {
      const caret = editor.carets[0];
      caret.line = Math.min(result.line, buffer.lineCount() - 1);
      caret.col = Math.min(result.col, buffer.lineLength(caret.line));
      caret.anchor = null;
      editor.controller.carets = editor.carets;
    }

    editor.highlighter.invalidateAll();
    editor.viewport.invalidate();
    editor._syncViewportContent();
    editor.notifyInput();
    editor._emitCursor();
    this._updateOccurrences();
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    this._updateDiagnosticsBadge();
    if (this._autoSaver) this._autoSaver.schedule();

    this.showToast("Fixed", "success", 1200);
  }

  _handleGutterTap(x, y, touch) {
    const r = this.editor.renderer;
    if (x < 0 || x > r.gutterWidth) return false;

    const pos = this.editor.hitTest(x, y);
    const line = pos.line;

    const diagnostics = this.editor.diagnostics;
    if (diagnostics && diagnostics.length > 0) {
      const onThisLine = diagnostics.filter((d) => d.line === line);
      if (onThisLine.length > 0) {
        return this._handleDiagnosticGutterTap(line, onThisLine, touch);
      }
    }

    const folding = this.editor.folding;
    if (folding) {
      const range = folding.getFoldableAt(line, this.editor.buffer);
      if (range) {
        this.editor.toggleFold(line);
        this.renderForce();
        return true;
      }
    }

    return false;
  }

  _handleDiagnosticGutterTap(line, lineDiag, touch) {
    const target = lineDiag[0];
    this.editor.setCursor(target.line, target.col || 0);
    if (!this.editor.viewport._cache) {
      this.editor.viewport.computeVisible(this.editor.buffer.lines);
    }
    this.editor.viewport.ensurePositionVisible(target.line, target.col || 0);
    this.editor.viewport.scrollToLineCentered(target.line);
    this.renderForce();
    this._syncStatusBar();

    if (lineDiag.length === 1) {
      const fixes = suggestFixes(this.editor.buffer, lineDiag[0]);
      if (fixes.length === 1) {
        this._applyQuickFix(fixes[0]);
        return true;
      }
      if (fixes.length > 1) {
        this._quickFixMenu.show(
          touch.clientX,
          touch.clientY,
          fixes
        );
        return true;
      }
    }

    const anchor = this._statusbar && this._statusbar._diagEl
      ? this._statusbar._diagEl
      : this._canvas;
    this._diagPopup.show(anchor, lineDiag);
    return true;
  }

  _onHoverMove(e) {
    if (this._touch) return;
    if (!this._canvas) return;
    if (!this._hoverTooltip) return;

    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const r = this.editor.renderer;
    if (x < 0 || x > r.gutterWidth || y < 0 || y > rect.height) {
      this._hideHoverTooltip();
      return;
    }

    const pos = this.editor.hitTest(x, y);
    const diags = this.editor.getDiagnosticsAtLine(pos.line);
    if (!diags || diags.length === 0) {
      this._hideHoverTooltip();
      return;
    }

    const first = diags[0];
    const msg = (first.severity === "error" ? "✕ " : "! ") + first.message;
    this._hoverTooltip.textContent = msg;
    this._hoverTooltip.classList.add("open");

    const tRect = this._hoverTooltip.getBoundingClientRect();
    let left = e.clientX + 14;
    let top = e.clientY + 14;
    if (left + tRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tRect.width - 8;
    }
    if (top + tRect.height > window.innerHeight - 8) {
      top = e.clientY - tRect.height - 12;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    this._hoverTooltip.style.left = left + "px";
    this._hoverTooltip.style.top = top + "px";

    if (this._hoverHideTimer) {
      clearTimeout(this._hoverHideTimer);
      this._hoverHideTimer = null;
    }
  }

  _onHoverOut() {
    this._hideHoverTooltip();
  }

  _hideHoverTooltip() {
    if (!this._hoverTooltip) return;
    if (this._hoverHideTimer) {
      clearTimeout(this._hoverHideTimer);
    }
    this._hoverHideTimer = setTimeout(() => {
      this._hoverHideTimer = null;
      if (this._hoverTooltip) this._hoverTooltip.classList.remove("open");
    }, 100);
  }

  _applyStickyPadding() {
    const vp = this.editor.viewport;
    if (!vp) return;
    if (this._basePadTop === undefined) {
      this._basePadTop = vp.metrics.padTop;
    }
    let stickyH = 0;
    if (this._stickyScrollVisible && this._stickyScroll && this.editor.buffer) {
      this._refreshSymbols();
      const scopes = this._stickyScroll.computeVisibleScopes(
        this.editor.buffer,
        vp.visibleFirstLine,
        this._symbols
      );
      if (scopes.length > 0) {
        stickyH = scopes.length * this._stickyScroll.rowHeight + this._stickyScroll.padding * 2;
      }
    }
    const desired = this._basePadTop + stickyH;
    if (vp.metrics.padTop !== desired) {
      vp.metrics.padTop = desired;
      vp.invalidate();
    }
  }

  _drawStickyScroll() {
    if (!this._stickyScroll) return;
    if (!this._stickyScrollVisible) return;
    if (!this._ctx) return;
    if (!this.editor.buffer) return;
    this._refreshSymbols();
    const theme = this.editor.renderer.theme;
    this._stickyScroll.draw(
      this._ctx,
      this.editor.viewport,
      this.editor.buffer,
      this._symbols,
      theme
    );
  }

  _toggleStickyScroll() {
    this._stickyScrollVisible = !this._stickyScrollVisible;
    try {
      localStorage.setItem("limn:sticky", this._stickyScrollVisible ? "1" : "0");
    } catch (e) {}
    if (this._stickyScroll) {
      this._stickyScroll.setEnabled(this._stickyScrollVisible);
    }
    if (!this._stickyScrollVisible && this.editor.viewport && this._basePadTop !== undefined) {
      this.editor.viewport.metrics.padTop = this._basePadTop;
      this.editor.viewport.invalidate();
    }
    this.renderForce();
    this.showToast(
      "Sticky scroll " + (this._stickyScrollVisible ? "on" : "off"),
      "success",
      1200
    );
  }

  _handleTabSnippet() {
    if (this._snippetSession) {
      const jumped = this._snippetJumpNext();
      if (jumped) return true;
    }

    const doc = this.editor.activeDoc;
    if (!doc) return false;
    const cursor = this.editor.getCursor();
    const langKey = doc.languageKey || languageKeyForFilename(doc.name);

    let found = null;
    try {
      found = findSnippet(this.editor.buffer, cursor.line, cursor.col, langKey);
    } catch (e) {
      found = null;
    }
    if (!found) return false;

    this._expandSnippet(found);
    this._suppressNextBeforeInput = Date.now();
    return true;
  }

  _expandSnippet(found) {
    const prepared = this._prepareSnippet(found.body);
    if (!prepared) return;

    const line = found.line;
    const startCol = found.startCol;
    const endCol = found.endCol;
    const text = prepared.text;

    const editor = this.editor;
    const buffer = editor.buffer;

    const before = editor.carets.map((c) => c.clone());
    editor.history.beginBatch();
    const change = {
      fromLine: line,
      fromCol: startCol,
      toLine: line,
      toCol: endCol,
      insert: text,
    };
    editor.history.record(buffer, change, before, null, "snippet");
    buffer.remove(line, startCol, line, endCol);
    if (text) buffer.insert(line, startCol, text);
    editor.history.endBatch(buffer, before, editor.carets, "snippet");

    const lineOffsets = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") lineOffsets.push(i + 1);
    }
    const offsetToLineCol = (off) => {
      let lo = 0;
      let hi = lineOffsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        if (lineOffsets[mid] <= off) lo = mid;
        else hi = mid - 1;
      }
      return {
        line: line + lo,
        col: (lo === 0 ? startCol : 0) + (off - lineOffsets[lo]),
      };
    };

    const stops = [];
    for (const s of prepared.stopList) {
      stops.push({
        index: s.index,
        start: offsetToLineCol(s.start),
        end: offsetToLineCol(s.end),
      });
    }

    let finalStop = null;
    if (prepared.finalStart !== null) {
      finalStop = {
        start: offsetToLineCol(prepared.finalStart),
        end: offsetToLineCol(prepared.finalEnd),
      };
    }

    stops.sort((a, b) => {
      if (a.index === 0) return 1;
      if (b.index === 0) return -1;
      return a.index - b.index;
    });

    this._snippetSession = {
      stops: stops,
      currentIndex: 0,
      finalStop: finalStop,
    };

    this._snippetJumpNext();

    editor.highlighter.invalidateFrom(Math.max(0, line - 1));
    editor.viewport.invalidate();
    editor._syncViewportContent();
    editor.notifyInput();
    editor._emitCursor();
    this._updateOccurrences();

    if (this._autoSaver) this._autoSaver.schedule();
  }

  _prepareSnippet(body) {
    const stops = [];
    let template = "";
    let i = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === "$" && i + 1 < body.length) {
        const next = body[i + 1];
        if (next === "{") {
          const end = body.indexOf("}", i + 2);
          if (end !== -1) {
            const inner = body.slice(i + 2, end);
            const colon = inner.indexOf(":");
            let numStr = inner;
            let def = "";
            if (colon !== -1) {
              numStr = inner.slice(0, colon);
              def = inner.slice(colon + 1);
            }
            const num = parseInt(numStr, 10);
            if (!isNaN(num)) {
              const marker = "\u0000" + stops.length + "\u0000";
              stops.push({ index: num, default: def, marker });
              template += marker;
              i = end + 1;
              continue;
            }
          }
        } else if (next >= "0" && next <= "9") {
          let j = i + 1;
          while (j < body.length && body[j] >= "0" && body[j] <= "9") j++;
          const num = parseInt(body.slice(i + 1, j), 10);
          const marker = "\u0000" + stops.length + "\u0000";
          stops.push({ index: num, default: "", marker });
          template += marker;
          i = j;
          continue;
        }
      }
      template += c;
      i++;
    }

    const parts = template.split(/(\u0000\d+\u0000)/);
    const expanded = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const m = part.match(/^\u0000(\d+)\u0000$/);
      if (!m) {
        expanded.push({ text: part, stopMarker: null });
      } else {
        const stop = stops[parseInt(m[1], 10)];
        expanded.push({ text: stop.default, stopMarker: stop });
      }
    }

    let text = "";
    for (let i = 0; i < expanded.length; i++) text += expanded[i].text;

    const stopList = [];
    let cursor = 0;
    let finalStart = null;
    let finalEnd = null;
    for (let i = 0; i < expanded.length; i++) {
      const p = expanded[i];
      const start = cursor;
      cursor += p.text.length;
      if (p.stopMarker) {
        if (p.stopMarker.index === 0) {
          finalStart = start;
          finalEnd = cursor;
        } else {
          stopList.push({
            index: p.stopMarker.index,
            start: start,
            end: cursor,
          });
        }
      }
    }

    return { text, stopList, finalStart, finalEnd };
  }

  _snippetJumpNext() {
    const s = this._snippetSession;
    if (!s) return false;

    if (s.currentIndex >= s.stops.length) {
      if (s.finalStop) {
        this._applySnippetRange(s.finalStop, false);
      }
      this._snippetSession = null;
      return true;
    }

    const stop = s.stops[s.currentIndex];
    s.currentIndex++;
    this._applySnippetRange(stop, true);
    return true;
  }

  _applySnippetRange(stop, select) {
    const caret = this.editor.carets[0];
    caret.line = stop.end.line;
    caret.col = stop.end.col;
    if (select) {
      caret.anchor = { line: stop.start.line, col: stop.start.col };
    } else {
      caret.anchor = null;
    }
    this.editor.controller.carets = this.editor.carets;
    this.editor.notifyInput();
    this.editor._emitCursor();
  }

  _endSnippetSession() {
    this._snippetSession = null;
  }

  _showSnippetMenu() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const langKey = doc.languageKey || languageKeyForFilename(doc.name);
    const table = snippetsForLanguage(langKey);
    const keys = Object.keys(table);
    if (keys.length === 0) {
      this.showToast("No snippets for this language", "info", 1500);
      return;
    }

    const existing = document.querySelector(".limn-snippet-menu");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const menu = document.createElement("div");
    menu.className = "limn-snippet-menu";

    const header = document.createElement("div");
    header.className = "limn-snippet-menu-header";
    header.textContent = "Snippets · " + languageNameForKey(langKey);
    menu.appendChild(header);

    const list = document.createElement("div");
    list.className = "limn-snippet-menu-list";

    for (const k of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "limn-snippet-menu-item";
      btn.textContent = k;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        this._insertSnippetAtCursor(table[k]);
      });
      list.appendChild(btn);
    }
    menu.appendChild(list);
    document.body.appendChild(menu);

    const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0, width: 300, height: 200 };
    const menuRect = menu.getBoundingClientRect();
    let left = Math.max(8, rect.left + 20);
    let top = Math.max(8, rect.top + 40);
    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }
    if (top + menuRect.height > window.innerHeight - 8) {
      top = window.innerHeight - menuRect.height - 8;
    }
    menu.style.left = left + "px";
    menu.style.top = top + "px";

    const close = (ev) => {
      if (menu.contains(ev.target)) return;
      if (menu.parentNode) menu.parentNode.removeChild(menu);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
    setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
  }

  _insertSnippetAtCursor(snippet) {
    const cursor = this.editor.getCursor();
    const fakeFound = {
      line: cursor.line,
      startCol: cursor.col,
      endCol: cursor.col,
      prefix: snippet.prefix,
      body: snippet.body,
    };
    this._expandSnippet(fakeFound);
    this._suppressNextBeforeInput = Date.now();
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    if (this._input) this._input.focus();
  }

  _buildCommands() {
    const self = this;
    return [
      { group: "File", icon: "📁", label: "Files", shortcut: "Ctrl+B",
        action: () => self._filetree.toggle() },
      { group: "File", icon: "🆕", label: "New file", shortcut: "Ctrl+N",
        action: () => self._newfile.open() },
      { group: "File", icon: "💾", label: "Save", shortcut: "Ctrl+S",
        action: () => self.save() },
      { group: "File", icon: "📝", label: "Save as…",
        action: () => self.saveAs() },
      { group: "File", icon: "📂", label: "Open file", shortcut: "Ctrl+O",
        action: () => self.openFile() },
      { group: "File", icon: "⬇", label: "Download",
        action: () => self.download() },
      { group: "File", icon: "▶", label: "Preview", shortcut: "Ctrl+Shift+V",
        action: () => self.preview() },

      { group: "Navigate", icon: "ƒ", label: "Jump to symbol", shortcut: "Ctrl+Shift+O",
        action: () => self._openSymbolPicker() },
      { group: "Navigate", icon: "✕", label: "Show diagnostics",
        action: () => {
          const el = self._statusbar && self._statusbar._diagEl;
          if (el) self._showDiagnostics(el);
        } },
      { group: "Navigate", icon: "🔍", label: "Find", shortcut: "Ctrl+F",
        action: () => self._openFind(false) },
      { group: "Navigate", icon: "✏️", label: "Replace", shortcut: "Ctrl+H",
        action: () => self._openFind(true) },
      { group: "Navigate", icon: "→", label: "Go to line",
        action: () => self._openGotoPicker() },
      { group: "Navigate", icon: "⬆", label: "Scroll to top",
        action: () => self._scrollToTop() },

      { group: "Edit", icon: "✨", label: "Format code", shortcut: "Ctrl+Shift+I",
        action: () => self._formatDocument() },
      { group: "Edit", icon: "↶", label: "Undo", shortcut: "Ctrl+Z",
        action: () => { self.editor.undo(); self.renderForce(); self._syncToolbar(); self._syncStatusBar(); } },
      { group: "Edit", icon: "↷", label: "Redo", shortcut: "Ctrl+Y",
        action: () => { self.editor.redo(); self.renderForce(); self._syncToolbar(); self._syncStatusBar(); } },
      { group: "Edit", icon: "💬", label: "Toggle comment", shortcut: "Ctrl+/",
        action: () => { self.editor.toggleComment(); self.renderForce(); } },
      { group: "Edit", icon: "▦", label: "Toggle block comment", shortcut: "Ctrl+Shift+/",
        action: () => self._toggleBlockCommentActive() },
      { group: "Edit", icon: "⇥", label: "Indent",
        action: () => { self.editor.handleTab(false); self.renderForce(); } },
      { group: "Edit", icon: "⇤", label: "Outdent",
        action: () => { self.editor.handleTab(true); self.renderForce(); } },
      { group: "Edit", icon: "⧉", label: "Duplicate line", shortcut: "Ctrl+D",
        action: () => { self.editor.duplicateLine(); self.renderForce(); self._syncToolbar(); } },
      { group: "Edit", icon: "↑", label: "Move line up", shortcut: "Alt+↑",
        action: () => { self.editor.moveLineUp(); self.renderForce(); } },
      { group: "Edit", icon: "↓", label: "Move line down", shortcut: "Alt+↓",
        action: () => { self.editor.moveLineDown(); self.renderForce(); } },
      { group: "Edit", icon: "✕", label: "Delete line", shortcut: "Ctrl+Shift+K",
        action: () => { self.editor.deleteLine(); self.renderForce(); self._syncToolbar(); } },
      { group: "Edit", icon: "⊕", label: "Add cursor",
        action: () => self._addCursorFromMenu() },
      { group: "Edit", icon: "↑", label: "Add cursor above",
        action: () => self._addCursorAbove() },
      { group: "Edit", icon: "↓", label: "Add cursor below",
        action: () => self._addCursorBelow() },
      { group: "Edit", icon: "⊖", label: "Clear extra cursors",
        action: () => self._clearExtraCursors() },
      { group: "Edit", icon: "☐", label: "Select all", shortcut: "Ctrl+A",
        action: () => { self.editor.selectAll(); self.renderForce(); } },
      { group: "Edit", icon: "T", label: "Edit as Code / Text",
        action: () => self._toggleTextMode() },
      { group: "Edit", icon: "⚡", label: "Snippets",
        action: () => self._showSnippetMenu() },

      { group: "View", icon: "↵", label: "Toggle word wrap",
        action: () => self._toggleWordWrap() },
      { group: "View", icon: "#", label: "Show statistics",
        action: () => {
          const el = self._statusbar && self._statusbar._statsEl;
          if (el) self._toggleStatsPopup(el);
        } },
      { group: "View", icon: "🎨", label: "Cycle theme", shortcut: "Ctrl+Shift+T",
        action: () => { self.editor.cycleTheme(); self.renderForce(); } },
      { group: "View", icon: "📐", label: "Toggle indent guides",
        action: () => {
          const show = !self.editor.renderer.showIndentGuides;
          self.editor.setShowIndentGuides(show);
          self.renderForce();
        } },
      { group: "View", icon: "▤", label: "Toggle minimap",
        action: () => self._toggleMinimap() },
      { group: "View", icon: "🌈", label: "Toggle rainbow brackets",
        action: () => {
          self.editor.renderer.rainbowBrackets = !self.editor.renderer.rainbowBrackets;
          self.showToast(
            "Rainbow brackets " + (self.editor.renderer.rainbowBrackets ? "on" : "off"),
            "success",
            1200
          );
          self.renderForce();
        } },
      { group: "View", icon: "📌", label: "Toggle sticky scroll",
        action: () => self._toggleStickyScroll() },
      { group: "View", icon: "▾", label: "Fold all",
        action: () => self._foldAll() },
      { group: "View", icon: "▸", label: "Unfold all",
        action: () => self._unfoldAll() },
      { group: "View", icon: "🔤", label: "Increase font size",
        action: () => self._adjustFontSize(1) },
      { group: "View", icon: "🔡", label: "Decrease font size",
        action: () => self._adjustFontSize(-1) },
      { group: "View", icon: "⇥", label: "Cycle tab size",
        action: () => self._cycleTabSize() },

      { group: "Cloud", icon: "☁", label: "Load from cloud",
        action: () => self.loadFromCloud() },
      { group: "Cloud", icon: "🚀", label: "Publish",
        action: () => self.publish() },
      { group: "Cloud", icon: "🔗", label: "Share link",
        action: () => self.share() },
    ];
  }

  _refreshSymbols() {
    const doc = this.editor.activeDoc;
    if (!doc) {
      this._symbols = [];
      return;
    }
    this._symbols = extractSymbols(this.editor.buffer);
  }

  _refreshBreadcrumb() {
    if (!this._breadcrumb) return;
    const doc = this.editor.activeDoc;
    if (!doc) {
      this._breadcrumb.set([]);
      return;
    }
    const key = languageKeyForFilename(doc.name);
    const langName = languageNameForKey(key);
    const cursor = this.editor.getCursor();
    const current = currentSymbolAt(this._symbols, cursor.line);
    const parts = [
      { label: langName, kind: "language", onTap: () => this._openLanguagePicker() },
      { label: doc.name, kind: "file", onTap: () => this._openSymbolPicker() },
    ];
    if (current) {
      parts.push({
        label: current.name,
        kind: "symbol",
        onTap: () => this._openSymbolPicker(),
      });
    }
    this._breadcrumb.set(parts);
  }

  _refreshStats() {
    if (!this._statusbar) return;
    const lineCount = this.editor.buffer.lineCount();
    this._statusbar.setStats(lineCount + " ln");
  }

  _openSymbolPicker() {
    this._refreshSymbols();
    if (this._symbols.length === 0) {
      this.showToast("No symbols found", "info");
      return;
    }
    if (this._symbolPicker) this._symbolPicker.show(this._symbols);
  }

  _jumpToSymbol(sym) {
    if (!sym) return;
    this._completionAcceptedAt = Date.now();
    const caret = this.editor.carets[0];
    caret.line = sym.line;
    caret.col = sym.col || 0;
    caret.anchor = null;
    this.editor.controller.carets = this.editor.carets;
    this.editor.viewport.ensurePositionVisible(sym.line, sym.col || 0);
    this.editor.notifyInput();
    this.editor._emitCursor();
    this.renderForce();
    this._syncStatusBar();
    this._refreshBreadcrumb();
    if (this._input) this._input.focus();
  }

  _openLanguagePicker() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const key = languageKeyForFilename(doc.name);
    this._langpick.currentKey = key;
    this._langpick.open();
  }

  _showDiagnostics(anchorEl) {
    if (!this._diagPopup) return;
    if (this._diagPopup.isOpen()) {
      this._diagPopup.hide();
      return;
    }
    this._updateDiagnosticsBadge();
    this._diagPopup.show(anchorEl, this.editor.diagnostics);
  }

  _updateDiagnosticsBadge() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const key = doc.languageKey || languageKeyForFilename(doc.name);
    this.editor.updateDiagnostics(key);
    const list = this.editor.diagnostics;
    let errors = 0;
    let warnings = 0;
    for (const d of list) {
      if (d.severity === "error") errors++;
      else if (d.severity === "warning") warnings++;
    }
    if (this._statusbar) {
      this._statusbar.setDiagnostics(errors, warnings);
    }
    this.renderForce();
  }

  _formatDocument() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const before = this.editor.carets.map((c) => c.clone());
    const original = doc.getValue();
    const langKey = languageKeyForFilename(doc.name);
    const formatted = formatBuffer(
      this.editor.buffer,
      this.editor.renderer.tabSize,
      langKey
    );
    if (formatted === original) {
      this.showToast("Already formatted", "info");
      return;
    }
    this.editor.history.beginBatch();
    const change = {
      fromLine: 0,
      fromCol: 0,
      toLine: this.editor.buffer.lineCount() - 1,
      toCol: this.editor.buffer.lineLength(this.editor.buffer.lineCount() - 1),
      insert: formatted,
    };
    this.editor.history.record(this.editor.buffer, change, before, null, "format");
    this.editor.buffer.setText(formatted);
    this.editor.history.endBatch(this.editor.buffer, before, this.editor.carets, "format");
    const caret = this.editor.carets[0];
    if (caret.line >= this.editor.buffer.lineCount()) {
      caret.line = this.editor.buffer.lineCount() - 1;
    }
    const len = this.editor.buffer.lineLength(caret.line);
    if (caret.col > len) caret.col = len;
    caret.anchor = null;
    this.editor.highlighter.invalidateAll();
    this.editor.viewport.invalidate();
    this.editor._syncViewportContent();
    this.editor.notifyInput();
    this.editor._emitCursor();
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    this._updateDiagnosticsBadge();
    if (this._autoSaver) this._autoSaver.schedule();
    this.showToast("Formatted", "success");
  }

  _toggleWordWrap() {
    const on = !this.editor.isWordWrap();
    this.editor.setWordWrap(on);
    this.editor.viewport.invalidate();
    this.editor._syncViewportContent();
    this.renderForce();
    if (this._statusbar) this._statusbar.setWordWrap(on);
    this.showToast("Word wrap: " + (on ? "on" : "off"), "success", 1200);
  }

  _toggleMinimap() {
    this._minimapVisible = !this._minimapVisible;
    try {
      localStorage.setItem("limn:minimap", this._minimapVisible ? "1" : "0");
    } catch (e) {}
    if (this._minimap) this._minimap.setVisible(this._minimapVisible);
    this.resize(window.innerWidth, window.innerHeight);
    if (this._statusbar) this._statusbar.setMinimap(this._minimapVisible);
    this.showToast(
      "Minimap " + (this._minimapVisible ? "on" : "off"),
      "success",
      1200
    );
  }

  _toggleTextMode() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const currentKey = languageKeyForFilename(doc.name);
    if (!this._savedLanguageKeys[doc.id]) {
      this._savedLanguageKeys[doc.id] = currentKey;
    }
    if (currentKey === "plaintext" || doc.languageKey === "plaintext") {
      const restore = this._savedLanguageKeys[doc.id] || "plaintext";
      this.editor.setLanguageMode(restore);
      this.showToast("Set as Code: " + restore, "success");
    } else {
      this.editor.setLanguageMode("plaintext");
      this.showToast("Set as Text", "success");
    }
    this.editor.highlighter.invalidateAll();
    this.editor.viewport.invalidate();
    this.editor._syncViewportContent();
    this.editor._emitCursor();
    this.renderForce();
    this._syncStatusBar();
    this._updateDiagnosticsBadge();
  }

  _toggleStatsPopup(anchorEl) {
    const popup = this._statsPopup;
    if (!popup) return;
    if (popup.classList.contains("open")) {
      popup.classList.remove("open");
      return;
    }
    const text = this.editor.buffer.getText();
    const lineCount = this.editor.buffer.lineCount();
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const chars = text.length;
    const charsNoSpace = text.replace(/\s+/g, "").length;

    popup.innerHTML =
      '<div class="limn-stats-row"><span class="label">Lines</span><span class="value">' + lineCount + '</span></div>' +
      '<div class="limn-stats-row"><span class="label">Words</span><span class="value">' + words + '</span></div>' +
      '<div class="limn-stats-row"><span class="label">Characters</span><span class="value">' + chars + '</span></div>' +
      '<div class="limn-stats-row"><span class="label">Chars (no space)</span><span class="value">' + charsNoSpace + '</span></div>';

    const rect = anchorEl.getBoundingClientRect();
    popup.classList.add("open");
    popup.style.left = "0px";
    popup.style.top = "0px";
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top - popupRect.height - 8;
    if (left + popupRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popupRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = rect.bottom + 8;
    popup.style.left = left + "px";
    popup.style.top = top + "px";

    const close = (ev) => {
      if (popup.contains(ev.target)) return;
      popup.classList.remove("open");
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
    setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
  }

  _computeAutocompleteAnchor() {
    const cursor = this.editor.getCursor();
    const vp = this.editor.viewport;
    const cache = vp._cache;
    const r = this.editor.renderer;
    let x;
    let y;

    if (cache && cache.lineInfo[cursor.line]) {
      const info = cache.lineInfo[cursor.line];
      const firstRow = cache.lineToFirstRow[cursor.line];
      let row = 0;
      let colInRow = cursor.col;
      if (info.breaks) {
        const breaks = info.breaks;
        for (let i = 0; i < breaks.length - 1; i++) {
          if (cursor.col < breaks[i + 1]) { row = i; break; }
          row = i + 1;
        }
        const rowStart = breaks[row] !== undefined ? breaks[row] : 0;
        colInRow = cursor.col - rowStart;
      }
      x = r.gutterWidth + 16 + colInRow * r.charWidth;
      y = vp.rowToY(firstRow + row) + r.lineHeight + 4;
      const canvasTop = this._canvas ? this._canvas.getBoundingClientRect().top : 0;
      y += canvasTop;
    } else {
      x = 100;
      y = 100;
    }

    return { x, y };
  }

  _maybeShowAutocomplete() {
    if (!this.autocompleteEnabled) return;
    if (!this._autocomplete) return;
    if (this._composing) return;

    const result = this.editor.getCompletions();
    if (!result || !result.items || result.items.length === 0) {
      this._autocomplete.hide();
      this._autocompleteOpen = false;
      return;
    }

    const anchor = this._computeAutocompleteAnchor();
    this._autocomplete.show(anchor.x, anchor.y, result.items, 0);
    this._autocompleteOpen = true;
  }

  _dismissAutocomplete() {
    if (this._autocomplete && this._autocomplete.isOpen()) {
      this._autocomplete.hide();
    }
    this._autocompleteOpen = false;
    this.editor.cursorHidden = false;
  }

  _acceptCompletion(item) {
    if (!item) return;
    this._completionAcceptedAt = Date.now();
    this._autocompleteOpen = false;
    this.editor.cursorHidden = false;

    const kind = item.kind;

    if (kind === "tag") {
      const line = item.line !== undefined ? item.line : this.editor.getCursor().line;
      const startCol = item.startCol;
      const endCol = item.endCol;

      const primary = this.editor.carets[0];
      primary.line = line;
      primary.col = startCol - 1;
      primary.anchor = { line, col: endCol };
      this.editor.controller.carets = this.editor.carets;

      const text = this.editor.buffer.getLine(line);
      const tail = text.slice(endCol);
      const closeTag = "</" + item.word + ">";
      const alreadyClosed = !item.isVoid && tail.startsWith(closeTag);

      let insertText;
      if (item.isVoid) {
        insertText = "<" + item.word + ">";
      } else if (alreadyClosed) {
        insertText = "<" + item.word + ">";
      } else {
        insertText = "<" + item.word + "></" + item.word + ">";
      }

      this.editor.controller.insertText(insertText);

      const newCaret = this.editor.carets[0];
      newCaret.line = line;
      newCaret.col = startCol - 1 + item.word.length + 2;
      newCaret.anchor = null;
      this.editor.controller.carets = this.editor.carets;

      this.editor.highlighter.invalidateFrom(Math.max(0, line - 1));
      this.editor.viewport.invalidate();
      this.editor._syncViewportContent();
      this.editor.notifyInput();
      this.editor._emitCursor();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      this._updateDiagnosticsBadge();
      if (this._autoSaver) this._autoSaver.schedule();
      if (this._input) this._input.focus();
      return;
    }

    if (kind === "value" || kind === "atrule" || kind === "pseudo") {
      const line = item.line !== undefined ? item.line : this.editor.getCursor().line;
      const startCol = item.startCol;
      const endCol = item.endCol;

      const primary = this.editor.carets[0];
      primary.line = line;
      primary.col = startCol;
      primary.anchor = { line, col: endCol };
      this.editor.controller.carets = this.editor.carets;

      this.editor.controller.insertText(item.word);

      const newCaret = this.editor.carets[0];
      newCaret.line = line;
      newCaret.col = startCol + item.word.length;
      newCaret.anchor = null;
      this.editor.controller.carets = this.editor.carets;

      this.editor.highlighter.invalidateFrom(Math.max(0, line - 1));
      this.editor.viewport.invalidate();
      this.editor._syncViewportContent();
      this.editor.notifyInput();
      this.editor._emitCursor();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      this._updateDiagnosticsBadge();
      if (this._autoSaver) this._autoSaver.schedule();
      if (this._input) this._input.focus();
      return;
    }

    const cursor = this.editor.getCursor();
    const buffer = this.editor.buffer;
    const text = buffer.getLine(cursor.line);

    let start = cursor.col;
    while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) start--;

    const primary = this.editor.carets[0];
    primary.anchor = { line: cursor.line, col: start };
    primary.line = cursor.line;
    primary.col = cursor.col;
    this.editor.controller.carets = this.editor.carets;

    this.editor.insert(item.word + " ");

    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();

    if (this._input) {
      this._input.focus();
    }
  }

  _cycleTabSize() {
    const sizes = [2, 4, 8];
    const current = this.editor.renderer.tabSize || 4;
    const idx = sizes.indexOf(current);
    const next = sizes[(idx + 1) % sizes.length];
    this.editor.renderer.tabSize = next;
    this.editor.controller.tabSize = next;
    this.editor.viewport.invalidate();
    this.showToast("Tab size: " + next, "success");
    this._syncStatusBar();
    this.renderForce();
  }

  _toggleLineEnding() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const current = (doc.lineEnding || "lf").toLowerCase();
    const next = current === "lf" ? "crlf" : "lf";
    doc.lineEnding = next;
    this.showToast("Line ending: " + next.toUpperCase(), "success");
    this._syncStatusBar();
  }

  _applyLanguageToActive(key) {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const lang = LANGUAGES[key];
    if (!lang) return;
    doc.highlighter.setLanguage(lang);
    doc.languageKey = key;
    doc.dirty = true;
    this.showToast("Language: " + languageNameForKey(key), "success");
    this._onDocumentsChange();
    this._updateDiagnosticsBadge();
  }

  _buildContextMenuItems() {
    const hasSel = this.editor.getSelection().some((s) => s.hasSelection);
    const multi = this.editor.carets.length > 1;
    return [
      { icon: "⊕", label: "Add cursor here", action: () => this._addCursorFromMenu() },
      { icon: "↑", label: "Add cursor above", action: () => this._addCursorAbove() },
      { icon: "↓", label: "Add cursor below", action: () => this._addCursorBelow() },
      { icon: "⊖", label: "Clear extra cursors", disabled: !multi, action: () => this._clearExtraCursors() },
      { divider: true },
      { icon: "📋", label: "Copy", disabled: !hasSel, action: () => this._onCopy(null) },
      { icon: "✂", label: "Cut", disabled: !hasSel, action: () => this._onCut(null) },
      { icon: "📥", label: "Paste", action: () => this._pasteFromClipboard() },
      { divider: true },
      { icon: "☐", label: "Select all", action: () => { this.editor.selectAll(); this.renderForce(); } },
      { icon: "🔤", label: "Select word", action: () => { this.editor.selectWord(); this.renderForce(); } },
      { icon: "≡", label: "Select line", action: () => { this.editor.selectLine(); this.renderForce(); } },
      { divider: true },
      { icon: "⚡", label: "Snippets…", action: () => this._showSnippetMenu() },
      { divider: true },
      { icon: "⧉", label: "Duplicate line", action: () => { this.editor.duplicateLine(); this.renderForce(); this._syncToolbar(); } },
      { icon: "↑", label: "Move up", action: () => { this.editor.moveLineUp(); this.renderForce(); } },
      { icon: "↓", label: "Move down", action: () => { this.editor.moveLineDown(); this.renderForce(); } },
      { icon: "💬", label: "Toggle comment", action: () => { this.editor.toggleComment(); this.renderForce(); } },
      { icon: "▦", label: "Toggle block comment", action: () => this._toggleBlockCommentActive() },
      { icon: "✕", label: "Delete line", action: () => { this.editor.deleteLine(); this.renderForce(); this._syncToolbar(); } },
    ];
  }

  async _pasteFromClipboard() {
    const text = this._clipboard || "";
    if (!text) {
      this.showToast("Nothing copied yet", "warning", 1500);
      return;
    }
    this.editor.pasteText(text);
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    if (this._autoSaver) this._autoSaver.schedule();
    this.showToast("Pasted " + text.length + " chars", "success", 1200);
  }

  showToast(message, kind, duration) {
    if (this._toast) this._toast.show(message, kind, duration);
  }

  _syncToolbar() {
    if (!this._toolbar) return;
    this._toolbar.setUndoEnabled(this.editor.history.canUndo());
    this._toolbar.setRedoEnabled(this.editor.history.canRedo());
  }

  _adjustFontSize(delta) {
    const current = this.editor.getFontSize();
    const next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, current + delta));
    if (next === current) return;
    this._applyFontSize(next);
  }

  _applyFontSize(size) {
    const clamped = this.editor.setFontSize(size);
    try {
      localStorage.setItem("limn:fontSize", String(clamped));
    } catch (e) {}
    if (this._stickyScroll) {
      this._stickyScroll.rowHeight = this.editor.renderer.lineHeight;
    }
    this.renderForce();
    this._syncStatusBar();
  }

  _allFilesPayload() {
    const files = {};
    const filenames = [];
    for (const doc of this.editor.documents.items) {
      files[doc.name] = doc.getValue();
      filenames.push(doc.name);
    }
    return { files, filenames };
  }

  preview() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const lang = languageKeyForFilename(doc.name);
    let content = doc.getValue();

    if (lang === "html") {
      content = resolveEngineUrl(content, this.engineUrl);
      this._preview.show("HTML · " + doc.name, content);
      return;
    }

    if (lang === "markdown") {
      const body = renderMarkdown(content);
      const full = wrapMarkdownDocument(body, doc.name);
      this._preview.show("Markdown · " + doc.name, full);
      return;
    }

    if (lang === "css") {
      const sample = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'>",
        "<style>" + content + "</style></head><body>",
        "<h1>Heading 1</h1>",
        "<p>Paragraph with <a href='#'>a link</a> and <strong>bold</strong> and <em>italic</em>.</p>",
        "<ul><li>One</li><li>Two</li><li>Three</li></ul>",
        "<button>Button</button>",
        "<pre><code>const x = 1;</code></pre>",
        "</body></html>",
      ].join("");
      this._preview.show("CSS · " + doc.name, sample);
      return;
    }

    if (lang === "javascript" && this.buildGameHTML && this.getEngineCode) {
      const engine = this.getEngineCode("v4");
      const assets = this.getAssets ? this.getAssets() : { head: "", css: "", scripts: "" };
      if (engine) {
        const html = this.buildGameHTML(engine, content, assets);
        this._preview.show("Game · " + doc.name, html);
        return;
      }
    }

    this.showToast("No preview for " + lang, "info");
  }

  async save() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    if (this._statusbar) this._statusbar.setSaved("saving");
    if (this._autoSaver) this._autoSaver.flush();
    if (this.cloud.isAvailable()) {
      const user = this.cloud.getUser() || (await this.cloud.getActiveUser());
      if (user) {
        const payload = this._allFilesPayload();
        const res = await this.cloud.saveUserFiles(payload.files, payload.filenames);
        if (res.ok) {
          this.editor.markClean();
          this.showToast("Saved to cloud", "success");
          this._syncStatusBar();
          return;
        }
        this.showToast("Cloud save failed: " + res.error, "error");
        this._syncStatusBar();
        return;
      }
    }
    this.editor.markClean();
    this.showToast("Saved locally", "success");
    this._syncStatusBar();
  }

  async saveAs() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const newName = prompt("Save as (filename):", doc.name);
    if (!newName) return;
    const idx = this.editor.documents.items.indexOf(doc);
    this.editor.documents.rename(idx, newName);
    this._onDocumentsChange();
    await this.save();
  }

  async openFile() {
    try {
      const picked = await pickFile();
      if (!picked) return;
      this.editor.newDocument({ name: picked.name, value: picked.content });
      this._onDocumentsChange();
      this.showToast("Opened " + picked.name, "success");
    } catch (e) {
      this.showToast("Open cancelled", "info");
    }
  }

  download() {
    const doc = this.editor.activeDoc;
    if (!doc) return;
    let content = doc.getValue();
    if (languageKeyForFilename(doc.name) === "html") {
      content = resolveEngineUrl(content, this.engineUrl);
    }
    downloadText(doc.name, content);
    this.showToast("Downloaded " + doc.name, "success");
  }

  async loadFromCloud() {
    if (!this.cloud.isAvailable()) {
      this.showToast("Cloud not configured", "warning");
      return;
    }
    const user = this.cloud.getUser() || (await this.cloud.getActiveUser());
    if (!user) {
      this.showToast("Not signed in", "warning");
      return;
    }
    const data = await this.cloud.loadUserFiles();
    if (!data || !data.filenames || data.filenames.length === 0) {
      this.showToast("No cloud files found", "info");
      return;
    }
    this.editor.documents.items.length = 0;
    this.editor.documents.activeIndex = -1;
    for (const name of data.filenames) {
      this.editor.documents.add({ name: name, value: data.files[name] || "" });
    }
    this._onDocumentsChange();
    this.showToast("Loaded " + data.filenames.length + " file(s)", "success");
  }

  async publish() {
    if (!this.cloud.isAvailable()) {
      this.showToast("Cloud not configured", "warning");
      return;
    }
    const doc = this.editor.activeDoc;
    if (!doc) return;
    const title = prompt("Game title:", doc.name.replace(/\.[^.]+$/, ""));
    if (!title) return;
    let code = doc.getValue();
    const isHtml = languageKeyForFilename(doc.name) === "html";
    if (isHtml) {
      code = resolveEngineUrl(code, this.engineUrl);
    }
    const engineVersion = "v4";
    const engineCode = this.getEngineCode ? this.getEngineCode(engineVersion) : "";
    const config = { title: title };
    const res = await this.cloud.publishGame({
      title: title,
      code: code,
      config: config,
      engineVersion: engineVersion,
      engineCode: isHtml ? "" : engineCode,
    });
    if (!res.ok) {
      this.showToast("Publish failed: " + res.error, "error");
      return;
    }
    const url = window.location.origin + "/arcade/game.html?slug=" + res.slug;
    await copyText(url);
    this.showToast("Published! URL copied", "success", 3000);
    if (this.onPublish) this.onPublish(res.slug, url);
  }

  async share() {
    if (!this.cloud.isAvailable()) {
      this.showToast("Cloud not configured", "warning");
      return;
    }
    const payload = this._allFilesPayload();
    const assets = this.getAssets ? this.getAssets() : { head: "", css: "", scripts: "" };
    const res = await this.cloud.createSnippet({
      files: payload.files,
      filesName: payload.filenames,
      assets: assets,
    });
    if (!res.ok) {
      this.showToast("Share failed: " + res.error, "error");
      return;
    }
    const url = window.location.origin + "/editor/?id=" + res.id;
    await copyText(url);
    this.showToast("Share link copied", "success", 3000);
    if (this.onShare) this.onShare(res.id, url);
  }

  _menuAction(which) {
    if (which === "goto") {
      this._openGotoPicker();
    }
  }

  _openFind(withReplace) {
    if (!this._searchbar) return;
    this._searchbar.open(withReplace);
    this.resize(window.innerWidth, window.innerHeight);
    this._searchUpdate();
  }

  _searchClose() {
    this._searchState.matches = [];
    this._searchState.current = 0;
    this.editor.clearSearchDecorations();
    this.resize(window.innerWidth, window.innerHeight);
    this.renderForce();
  }

  _searchUpdate() {
    if (!this._searchbar) return;
    const query = this._searchbar.getQuery();
    const options = this._searchbar.getOptions();
    this._searchState.query = query;
    this._searchState.options = options;

    if (!query) {
      this._searchState.matches = [];
      this._searchState.current = 0;
      this._searchbar.setCount(0, 0);
      this.editor.clearSearchDecorations();
      this.renderForce();
      return;
    }

    const matches = findAll(this.editor.buffer, query, options);
    this._searchState.matches = matches;

    if (matches.length === 0) {
      this._searchState.current = 0;
      this._searchbar.setCount(0, 0);
      this.editor.clearSearchDecorations();
      this.renderForce();
      return;
    }

    const cursor = this.editor.getCursor();
    let idx = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m.line > cursor.line || (m.line === cursor.line && m.col >= cursor.col)) {
        idx = i;
        break;
      }
    }
    this._searchState.current = idx;
    this._updateSearchDecorations();
    this._searchbar.setCount(idx + 1, matches.length);
    this.renderForce();
  }

  _searchNext() {
    if (!this._searchState.matches.length) return;
    this._searchState.current =
      (this._searchState.current + 1) % this._searchState.matches.length;
    this._jumpToCurrentMatch();
  }

  _searchPrev() {
    if (!this._searchState.matches.length) return;
    this._searchState.current =
      (this._searchState.current - 1 + this._searchState.matches.length) %
      this._searchState.matches.length;
    this._jumpToCurrentMatch();
  }

  _jumpToCurrentMatch() {
    const m = this._searchState.matches[this._searchState.current];
    if (!m) return;
    const caret = this.editor.carets[0];
    caret.line = m.line;
    caret.col = m.col + m.length;
    caret.anchor = { line: m.line, col: m.col };
    this.editor.viewport.ensurePositionVisible(m.line, m.col);
    this._updateSearchDecorations();
    this._searchbar.setCount(this._searchState.current + 1, this._searchState.matches.length);
    this.renderForce();
    this._syncStatusBar();
    if (this._input) this._input.focus();
  }

  _updateSearchDecorations() {
    this.editor.clearSearchDecorations();
    const matches = this._searchState.matches;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const isCurrent = i === this._searchState.current;
      this.editor.addSearchDecoration(
        m.line, m.col, m.line, m.col + m.length, isCurrent
      );
    }
    this._dirty = true;
  }

  _searchReplaceOne() {
    const m = this._searchState.matches[this._searchState.current];
    if (!m) return;
    const replacement = this._searchbar.getReplacement();
    const before = this.editor.carets.map((c) => c.clone());
    this.editor.history.beginBatch();
    const change = { fromLine: m.line, fromCol: m.col, toLine: m.line, toCol: m.col + m.length, insert: replacement };
    this.editor.history.record(this.editor.buffer, change, before, null, "replace");
    this.editor.buffer.remove(m.line, m.col, m.line, m.col + m.length);
    if (replacement) {
      this.editor.buffer.insert(m.line, m.col, replacement);
    }
    this.editor.history.endBatch(this.editor.buffer, before, this.editor.carets, "replace");
    this.editor._syncViewportContent();
    this.editor.highlighter.invalidateFrom(Math.max(0, m.line - 1));
    this._syncToolbar();
    this._searchUpdate();
    this._updateDiagnosticsBadge();
    if (this._autoSaver) this._autoSaver.schedule();
  }

  _searchReplaceAll() {
    if (!this._searchState.matches.length) return;
    const query = this._searchbar.getQuery();
    const replacement = this._searchbar.getReplacement();
    const options = this._searchbar.getOptions();
    const buffer = this.editor.buffer;
    const before = this.editor.carets.map((c) => c.clone());

    this.editor.history.beginBatch();

    const lineCount = buffer.lineCount();
    for (let i = 0; i < lineCount; i++) {
      const originalText = buffer.getLine(i);
      const newText = replaceAllInLine(originalText, query, options, replacement);
      if (newText !== originalText) {
        const change = {
          fromLine: i,
          fromCol: 0,
          toLine: i,
          toCol: originalText.length,
          insert: newText,
        };
        this.editor.history.record(buffer, change, before, null, "replace");
        buffer.remove(i, 0, i, originalText.length);
        if (newText) buffer.insert(i, 0, newText);
      }
    }

    this.editor.history.endBatch(buffer, before, this.editor.carets, "replace-all");
    this.editor._syncViewportContent();
    this.editor.highlighter.invalidateAll();
    this._syncToolbar();
    this._searchUpdate();
    this._updateDiagnosticsBadge();
    if (this._autoSaver) this._autoSaver.schedule();
  }

  _onWindowResize() {
    this.resize(window.innerWidth, window.innerHeight);
  }

  _createInputProxy(parent) {
    const input = document.createElement("textarea");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("wrap", "off");
    input.style.position = "absolute";
    input.style.left = this.x + "px";
    input.style.top = this.y + "px";
    input.style.width = this.width + "px";
    input.style.height = this.height + "px";
    input.style.opacity = "0.01";
    input.style.background = "transparent";
    input.style.color = "transparent";
    input.style.caretColor = "transparent";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.resize = "none";
    input.style.padding = "0";
    input.style.margin = "0";
    input.style.overflow = "hidden";
    input.style.zIndex = "50";
    input.style.pointerEvents = "auto";
    input.style.cursor = "text";
    input.style.fontSize = "16px";
    input.style.touchAction = "manipulation";
    input.style.webkitTouchCallout = "none";
    input.style.webkitUserSelect = "none";
    input.style.userSelect = "none";
    parent.appendChild(input);
    this._input = input;
  }

  _bindEvents() {
    if (!this._input) return;

    this._input.addEventListener("keydown", this._onKeyDown);
    this._input.addEventListener("mousedown", this._onMouseDown);
    this._input.addEventListener("beforeinput", this._onBeforeInput);
    this._input.addEventListener("input", this._onInput);
    this._input.addEventListener("paste", this._onPaste);
    this._input.addEventListener("compositionstart", this._onCompositionStart);
    this._input.addEventListener("compositionend", this._onCompositionEnd);
    this._input.addEventListener("focus", this._onFocus);
    this._input.addEventListener("blur", this._onBlur);
    this._input.addEventListener("wheel", this._onWheel, { passive: false });
    this._input.addEventListener("touchstart", this._onTouchStart, { passive: false });
    this._input.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this._input.addEventListener("touchend", this._onTouchEnd, { passive: false });
    this._input.addEventListener("touchcancel", this._onTouchEnd, { passive: false });
    this._input.addEventListener("contextmenu", this._onContextMenu);
    this._input.addEventListener("mousemove", this._onHoverMove);
    this._input.addEventListener("mouseleave", this._onHoverOut);

    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  _unbindEvents() {
    if (!this._input) return;
    this._input.removeEventListener("keydown", this._onKeyDown);
    this._input.removeEventListener("mousedown", this._onMouseDown);
    this._input.removeEventListener("beforeinput", this._onBeforeInput);
    this._input.removeEventListener("input", this._onInput);
    this._input.removeEventListener("paste", this._onPaste);
    this._input.removeEventListener("compositionstart", this._onCompositionStart);
    this._input.removeEventListener("compositionend", this._onCompositionEnd);
    this._input.removeEventListener("focus", this._onFocus);
    this._input.removeEventListener("blur", this._onBlur);
    this._input.removeEventListener("wheel", this._onWheel);
    this._input.removeEventListener("touchstart", this._onTouchStart);
    this._input.removeEventListener("touchmove", this._onTouchMove);
    this._input.removeEventListener("touchend", this._onTouchEnd);
    this._input.removeEventListener("touchcancel", this._onTouchEnd);
    this._input.removeEventListener("contextmenu", this._onContextMenu);
    this._input.removeEventListener("mousemove", this._onHoverMove);
    this._input.removeEventListener("mouseleave", this._onHoverOut);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  _shouldIgnoreEditorTouch() {
    if (this._autocompleteOpen) return true;
    if (this._symbolPicker && this._symbolPicker.isOpen()) return true;
    if (this._commandPalette && this._commandPalette.isOpen()) return true;
    if (this._diagPopup && this._diagPopup.isOpen()) return true;
    if (this._quickFixMenu && this._quickFixMenu.isOpen()) return true;
    if (this._gotoPicker && this._gotoPicker.isOpen()) return true;
    if (Date.now() - this._completionAcceptedAt < COMPLETION_LOCK_MS) return true;
    return false;
  }

  _onTouchStart(e) {
    if (e.touches.length === 2) {
      this._cancelLongPress();
      this._pinchActive = true;
      this._touchMode = "pinch";
      this._pinchStartDist = distanceBetween(e.touches[0], e.touches[1]);
      this._pinchStartFontSize = this.editor.getFontSize();
      this._capturePinchAnchor(e.touches[0], e.touches[1]);
      if (this._flingRaf) {
        cancelAnimationFrame(this._flingRaf);
        this._flingRaf = null;
      }
      e.preventDefault();
      return;
    }

    if (this._shouldIgnoreEditorTouch()) {
      const t = e.touches && e.touches[0];
      if (t && this._autocomplete && this._autocomplete._el) {
        const rect = this._autocomplete._el.getBoundingClientRect();
        const insidePopup =
          t.clientX >= rect.left && t.clientX <= rect.right &&
          t.clientY >= rect.top && t.clientY <= rect.bottom;
        if (!insidePopup) {
          this._dismissAutocomplete();
        }
      }
      return;
    }

    if (e.touches.length !== 1) {
      this._touchMode = "idle";
      this._cancelLongPress();
      return;
    }
    const t = e.touches[0];
    this._touchStartTime = Date.now();
    this._touchStartX = t.clientX;
    this._touchStartY = t.clientY;
    this._touchLastX = t.clientX;
    this._touchLastY = t.clientY;
    this._touchLastTime = Date.now();
    this._touchVelocityX = 0;
    this._touchVelocityY = 0;
    this._touchMode = "pending";
    this._suppressClick = false;

    if (this._flingRaf) {
      cancelAnimationFrame(this._flingRaf);
      this._flingRaf = null;
    }

    this._cancelLongPress();
    this._longPressTimer = setTimeout(() => {
      this._longPressTimer = null;
      if (this._touchMode === "pending") {
        this._touchMode = "longpress";
        this._suppressClick = true;
        this._openContextMenuAt(t.clientX, t.clientY);
      }
    }, LONG_PRESS_DURATION);
  }

  _cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

  _capturePinchAnchor(t1, t2) {
    const mid = midpointOf(t1, t2);
    const rect = this._canvas.getBoundingClientRect();
    const x = mid.clientX - rect.left;
    const y = mid.clientY - rect.top;
    const pos = this.editor.hitTest(x, y);
    const vp = this.editor.viewport;
    this._pinchAnchor = {
      line: pos.line,
      col: pos.col,
      screenY: mid.clientY,
      screenX: mid.clientX,
    };
  }

  _onTouchMove(e) {
    if (this._pinchActive && e.touches.length === 2) {
      e.preventDefault();
      const dist = distanceBetween(e.touches[0], e.touches[1]);
      if (this._pinchStartDist <= 0) return;
      const ratio = dist / this._pinchStartDist;
      const rawSize = this._pinchStartFontSize * ratio;
      const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, rawSize));
      const currentSize = this.editor.getFontSize();
      if (Math.abs(clamped - currentSize) < 0.25) return;

      this.editor.setFontSize(clamped);
      if (this._stickyScroll) {
        this._stickyScroll.rowHeight = this.editor.renderer.lineHeight;
      }

      if (this._pinchAnchor) {
        const mid = midpointOf(e.touches[0], e.touches[1]);
        this._pinchAnchor.screenX = mid.clientX;
        this._pinchAnchor.screenY = mid.clientY;

        const vp = this.editor.viewport;
        if (!vp._cache) vp.computeVisible(this.editor.buffer.lines);
        const canvasRect = this._canvas.getBoundingClientRect();
        const cache = vp._cache;
        if (cache) {
          const rowStart = cache.lineToFirstRow[this._pinchAnchor.line] || 0;
          const lineTopInContent = this.editor.renderer.padTop +
            rowStart * this.editor.renderer.lineHeight;
          const screenOffsetY = this._pinchAnchor.screenY - canvasRect.top;
          const desiredScrollTop = lineTopInContent - screenOffsetY;
          vp.setScroll(desiredScrollTop, vp.scrollLeft);
          const doc = this.editor.activeDoc;
          if (doc) {
            doc.scrollTop = vp.scrollTop;
            doc.scrollLeft = vp.scrollLeft;
          }
        }
      }

      this.renderForce();
      return;
    }

    if (this._shouldIgnoreEditorTouch()) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const now = Date.now();

    if (this._touchMode === "pending") {
      const dx = Math.abs(t.clientX - this._touchStartX);
      const dy = Math.abs(t.clientY - this._touchStartY);
      if (dx > TAP_MAX_DISTANCE || dy > TAP_MAX_DISTANCE) {
        this._touchMode = "scroll";
        this._cancelLongPress();
        this._touchLastX = t.clientX;
        this._touchLastY = t.clientY;
        this._touchLastTime = now;
      }
      return;
    }

    if (this._touchMode === "scroll") {
      const dx = this._touchLastX - t.clientX;
      const dy = this._touchLastY - t.clientY;
      const dt = Math.max(1, now - this._touchLastTime);
      this._touchVelocityX = dx / dt;
      this._touchVelocityY = dy / dt;
      this._touchLastX = t.clientX;
      this._touchLastY = t.clientY;
      this._touchLastTime = now;
      this.editor.scrollBy(dx, dy);
      this.renderForce();
      e.preventDefault();
    }
  }

  _onTouchEnd(e) {
    if (this._pinchActive) {
      if (e.touches.length < 2) {
        this._pinchActive = false;
        this._pinchAnchor = null;
        try {
          localStorage.setItem("limn:fontSize", String(this.editor.getFontSize()));
        } catch (err) {}
        this.showToast("Font size: " + Math.round(this.editor.getFontSize()), "success", 900);
        this._touchMode = "idle";
        this._suppressClick = true;
      }
      return;
    }

    if (this._shouldIgnoreEditorTouch()) {
      this._touchMode = "idle";
      return;
    }

    this._cancelLongPress();

    if (this._touchMode === "pending") {
      const elapsed = Date.now() - this._touchStartTime;
      const t = e.changedTouches && e.changedTouches[0];
      if (t && elapsed <= TAP_MAX_DURATION) {
        const dx = Math.abs(t.clientX - this._touchStartX);
        const dy = Math.abs(t.clientY - this._touchStartY);
        if (dx <= TAP_MAX_DISTANCE && dy <= TAP_MAX_DISTANCE) {
          if (this._input) this._input.focus();
          const rect = this._canvas.getBoundingClientRect();
          const x = t.clientX - rect.left;
          const y = t.clientY - rect.top;

          if (this._handleGutterTap(x, y, t)) {
            this._suppressClick = true;
            this._touchMode = "idle";
            return;
          }

          if (this._addingCursorMode) {
            const pos = this.editor.hitTest(x, y);
            this._addCursorAt(pos.line, pos.col);
            this._suppressClick = true;
            this._touchMode = "idle";
            return;
          }

          this.editor.clickAt(x, y, false);
          this.renderForce();
          this._syncStatusBar();
          this._updateOccurrences();
          this._suppressClick = true;
        }
      }
    } else if (this._touchMode === "scroll") {
      this._startFling();
    }

    this._touchMode = "idle";
  }

  _startFling() {
    const FRICTION = 0.94;
    const MIN_VELOCITY = 0.02;
    let vx = this._touchVelocityX || 0;
    let vy = this._touchVelocityY || 0;
    let last = performance.now();

    const step = (now) => {
      const dt = now - last;
      last = now;
      vx *= FRICTION;
      vy *= FRICTION;
      const dx = vx * dt;
      const dy = vy * dt;
      const changed = this.editor.scrollBy(dx, dy);
      this.renderForce();
      if ((Math.abs(vx) > MIN_VELOCITY || Math.abs(vy) > MIN_VELOCITY) && changed) {
        this._flingRaf = requestAnimationFrame(step);
      } else {
        this._flingRaf = null;
      }
    };

    if (Math.abs(vx) > MIN_VELOCITY || Math.abs(vy) > MIN_VELOCITY) {
      this._flingRaf = requestAnimationFrame(step);
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
    this._openContextMenuAt(e.clientX, e.clientY);
  }

  _openContextMenuAt(clientX, clientY) {
    if (!this._contextmenu) return;
    this._addingCursorMode = false;
    this._dismissAutocomplete();

    const rect = this._canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      const pos = this.editor.hitTest(x, y);
      const caret = this.editor.carets[0];
      if (!caret.hasSelection() || !this._pointInSelection(pos, caret)) {
        this.editor.setCursor(pos.line, pos.col);
        this._syncStatusBar();
      }
    }

    this._contextmenu.setItems(this._buildContextMenuItems());
    this._contextmenu.show(clientX, clientY);
  }

  _pointInSelection(pos, caret) {
    if (!caret.hasSelection()) return false;
    const s = caret.start();
    const e = caret.end();
    if (pos.line < s.line || pos.line > e.line) return false;
    if (pos.line === s.line && pos.col < s.col) return false;
    if (pos.line === e.line && pos.col > e.col) return false;
    return true;
  }

  _onFocus() {
    this._focused = true;
    this.renderForce();
  }

  _onBlur() {
    this._focused = false;
    this.renderForce();
  }

  _onCompositionStart() {
    this._composing = true;
    this._dismissAutocomplete();
  }

  _onCompositionEnd(e) {
    this._composing = false;
    if (e.data) {
      this.editor.insert(e.data);
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      if (this._autoSaver) this._autoSaver.schedule();
      this._maybeShowAutocomplete();
    }
    this._input.value = "";
  }

  _onBeforeInput(e) {
    if (this._composing) return;

    if (this._suppressNextBeforeInput && Date.now() - this._suppressNextBeforeInput < 200) {
      this._suppressNextBeforeInput = 0;
      e.preventDefault();
      return;
    }

    if (this._snippetSession && e.inputType !== "insertTab") {
      this._endSnippetSession();
    }

    const t = e.inputType;

    if (t === "insertLineBreak" || t === "insertParagraph") {
      e.preventDefault();
      if (this._autocomplete && this._autocomplete.isOpen()) {
        this._autocomplete.accept();
        return;
      }
      this.editor.newline();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      if (this._autoSaver) this._autoSaver.schedule();
      this._updateOccurrences();
      return;
    }

    if (t === "insertText" || t === "insertReplacementText") {
      e.preventDefault();
      const data = e.data != null ? e.data : "";
      if (!data) return;

      let handled = false;
      if (data.length === 1) {
        handled = this.editor.tryAutoPair(data);
      }
      if (!handled) {
        this.editor.insert(data);
      }

      if (data === ">") {
        this._tryHtmlAutoClose();
      }

      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      if (this._autoSaver) this._autoSaver.schedule();
      this._maybeShowAutocomplete();
      this._updateOccurrences();
      return;
    }

    if (t === "deleteContentBackward") {
      e.preventDefault();
      this.editor.backspace();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      if (this._autoSaver) this._autoSaver.schedule();
      this._maybeShowAutocomplete();
      this._updateOccurrences();
      return;
    }

    if (t === "deleteContentForward") {
      e.preventDefault();
      this.editor.delete();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      if (this._autoSaver) this._autoSaver.schedule();
      this._maybeShowAutocomplete();
      this._updateOccurrences();
      return;
    }
  }

  _tryHtmlAutoClose() {
    const doc = this.editor.activeDoc;
    if (!doc) return false;
    const key = doc.languageKey || languageKeyForFilename(doc.name);
    if (key !== "html") return false;
    if (typeof this.editor.tryHtmlAutoClose !== "function") return false;
    const cur = this.editor.getCursor();
    return this.editor.tryHtmlAutoClose(cur.line, cur.col);
  }

  _onInput(e) {
    if (this._composing) return;
    this._input.value = "";
  }

  _onPaste(e) {
    if (e) e.preventDefault();
    let text = "";
    if (e && e.clipboardData) {
      try { text = e.clipboardData.getData("text") || ""; } catch (err) { text = ""; }
    }
    if (!text) text = this._clipboard || "";
    if (!text) {
      this.showToast("Nothing copied yet", "warning", 1500);
      return;
    }
    this.editor.insert(text.replace(/\r\n/g, "\n"));
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    if (this._autoSaver) this._autoSaver.schedule();
    this._dismissAutocomplete();
    this._updateOccurrences();
  }

  _onCopy(e) {
    const sel = this.editor.getSelection();
    if (!sel.length || !sel[0].hasSelection) return;
    const s = sel[0].start;
    const en = sel[0].end;
    const text = this.editor.buffer.slice(s.line, s.col, en.line, en.col);
    if (!text) return;
    this._clipboard = text;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.clipboardData) {
        try { e.clipboardData.setData("text/plain", text); } catch (err) {}
      }
    }
    this.showToast("Copied " + text.length + " chars", "success", 1200);
  }

  _onCut(e) {
    const sel = this.editor.getSelection();
    if (!sel.length || !sel[0].hasSelection) return;
    const s = sel[0].start;
    const en = sel[0].end;
    const text = this.editor.buffer.slice(s.line, s.col, en.line, en.col);
    if (!text) return;
    this._clipboard = text;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.clipboardData) {
        try { e.clipboardData.setData("text/plain", text); } catch (err) {}
      }
    }
    this.editor.backspace();
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
    if (this._autoSaver) this._autoSaver.schedule();
    this.showToast("Cut " + text.length + " chars", "success", 1200);
    this._updateOccurrences();
  }

  _onKeyDown(e) {
    if (this._commandPalette && this._commandPalette.isOpen()) {
      return;
    }
    if (this._gotoPicker && this._gotoPicker.isOpen()) {
      return;
    }

    if (this.editor.folding) {
      this._expandFoldAtCursor();
    }

    const mod = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (this._autocomplete && this._autocomplete.isOpen()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._autocomplete.moveSelection(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._autocomplete.moveSelection(-1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        this._autocomplete.accept();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this._autocomplete.hide();
        return;
      }
    }

    if (mod && shift && e.key === "/") {
      e.preventDefault();
      this._toggleBlockCommentActive();
      return;
    }

    if (mod && shift && e.key.toLowerCase() === "o") {
      e.preventDefault();
      this._openSymbolPicker();
      return;
    }

    if (mod && shift && e.key.toLowerCase() === "i") {
      e.preventDefault();
      this._formatDocument();
      return;
    }

    if (mod && shift && e.key.toLowerCase() === "m") {
      e.preventDefault();
      this._toggleMinimap();
      return;
    }

    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (this._commandPalette) this._commandPalette.open();
      return;
    }

    if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      this._openGotoPicker();
      return;
    }

    if (mod && e.key.toLowerCase() === "s" && !shift) {
      e.preventDefault(); this.save(); return;
    }
    if (mod && shift && e.key.toLowerCase() === "s") {
      e.preventDefault(); this.saveAs(); return;
    }
    if (mod && e.key.toLowerCase() === "o") {
      e.preventDefault(); this.openFile(); return;
    }
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault(); this._filetree.toggle(); return;
    }
    if (mod && e.key.toLowerCase() === "z" && !shift) {
      e.preventDefault(); this.editor.undo(); this.renderForce(); this._syncToolbar(); this._syncStatusBar(); return;
    }
    if (mod && (e.key.toLowerCase() === "y" ||
        (shift && e.key.toLowerCase() === "z"))) {
      e.preventDefault(); this.editor.redo(); this.renderForce(); this._syncToolbar(); this._syncStatusBar(); return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault(); this.editor.selectAll(); this.renderForce(); this._syncStatusBar(); return;
    }
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault(); this._openFind(false); return;
    }
    if (mod && e.key.toLowerCase() === "h") {
      e.preventDefault(); this._openFind(true); return;
    }
    if (mod && e.key.toLowerCase() === "c") {
      const sel = this.editor.getSelection();
      if (sel.length && sel[0].hasSelection) {
        e.preventDefault();
        this._onCopy(null);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "x") {
      const sel = this.editor.getSelection();
      if (sel.length && sel[0].hasSelection) {
        e.preventDefault();
        this._onCut(null);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "v") {
      e.preventDefault();
      this._pasteFromClipboard();
      return;
    }
    if (mod && shift && e.key.toLowerCase() === "v") {
      e.preventDefault(); this.preview(); return;
    }
    if (mod && e.key.toLowerCase() === "n" && !shift) {
      e.preventDefault();
      this._newfile.open();
      return;
    }
    if (mod && e.key.toLowerCase() === "w") {
      e.preventDefault();
      const doc = this.editor.activeDoc;
      if (doc) {
        this.editor.closeDocument(doc.id);
        this._onDocumentsChange();
      }
      return;
    }
    if (mod && e.key === "/") {
      e.preventDefault(); this.editor.toggleComment(); this.renderForce(); return;
    }
    if (mod && e.key.toLowerCase() === "d" && !shift) {
      e.preventDefault();
      this.editor.duplicateLine();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      return;
    }
    if (mod && shift && e.key.toLowerCase() === "k") {
      e.preventDefault();
      this.editor.deleteLine();
      this.renderForce();
      this._syncToolbar();
      this._syncStatusBar();
      return;
    }
    if (mod && e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      this._addCursorAbove();
      return;
    }
    if (mod && e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      this._addCursorBelow();
      return;
    }
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      this.editor.moveLineUp();
      this.renderForce();
      return;
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      this.editor.moveLineDown();
      this.renderForce();
      return;
    }
    if (mod && shift && e.key.toLowerCase() === "t") {
      e.preventDefault();
      this.editor.cycleTheme();
      this.renderForce();
      return;
    }

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (mod) this.editor.moveWordLeft(shift); else this.editor.moveLeft(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "ArrowRight":
        e.preventDefault();
        if (mod) this.editor.moveWordRight(shift); else this.editor.moveRight(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "ArrowUp":
        e.preventDefault();
        this.editor.moveUp(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "ArrowDown":
        e.preventDefault();
        this.editor.moveDown(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "Home":
        e.preventDefault();
        if (mod) this.editor.moveDocStart(shift); else this.editor.moveHome(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "End":
        e.preventDefault();
        if (mod) this.editor.moveDocEnd(shift); else this.editor.moveEnd(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "PageUp":
        e.preventDefault();
        this.editor.movePageUp(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "PageDown":
        e.preventDefault();
        this.editor.movePageDown(shift);
        this.renderForce(); this._syncStatusBar(); this._updateOccurrences(); return;
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        if (this._autocomplete && this._autocomplete.isOpen()) {
          this._autocomplete.hide();
        }
        if (!shift && this._handleTabSnippet()) {
          this.renderForce();
          this._syncToolbar();
          this._syncStatusBar();
          return;
        }
        if (!shift && this._handleTabEmmet()) {
          this.renderForce();
          this._syncToolbar();
          this._syncStatusBar();
          return;
        }
        this.editor.handleTab(shift);
        this.renderForce();
        this._syncToolbar();
        this._syncStatusBar();
        return;
      case "Escape":
        e.preventDefault();
        this._endSnippetSession();
        this._addingCursorMode = false;
        if (this.editor.carets.length > 1) {
          this._clearExtraCursors();
        }
        this._dragging = false;
        if (this._menu) this._menu.close();
        if (this._contextmenu) this._contextmenu.hide();
        if (this._quickFixMenu) this._quickFixMenu.hide();
        if (this._langpick && this._langpick.isOpen()) this._langpick.close();
        if (this._preview && this._preview.isOpen()) this._preview.close();
        if (this._newfile && this._newfile.isOpen()) this._newfile.close();
        if (this._filetree && this._filetree.isOpen()) this._filetree.close();
        if (this._searchbar && this._searchbar.isOpen()) {
          this._searchbar.close();
          this._searchClose();
        }
        if (this._autocomplete && this._autocomplete.isOpen()) {
          this._dismissAutocomplete();
        }
        if (this._diagPopup && this._diagPopup.isOpen()) {
          this._diagPopup.hide();
        }
        if (this._gotoPicker && this._gotoPicker.isOpen()) {
          this._gotoPicker.close();
        }
        return;
    }
  }

  _onMouseDown(e) {
    if (this._shouldIgnoreEditorTouch()) return;

    if (this._menu) this._menu.close();
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }
    if (this._input) this._input.focus();
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this._addingCursorMode) {
      const pos = this.editor.hitTest(x, y);
      this._addCursorAt(pos.line, pos.col);
      return;
    }
    this.editor.clickAt(x, y, e.shiftKey);
    this._dragging = true;
    this.renderForce();
    this._syncStatusBar();
    this._updateOccurrences();
    this._dismissAutocomplete();
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    if (this._shouldIgnoreEditorTouch()) return;
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.editor.dragTo(x, y);
    this.renderForce();
    this._syncStatusBar();
  }

  _onMouseUp() {
    this._dragging = false;
  }

  _onWheel(e) {
    e.preventDefault();
    const dy = e.deltaY;
    const dx = e.deltaX;
    this.editor.scrollBy(dx, dy);
    this.renderForce();
  }

  renderForce() {
    if (!this._ctx) return;
    this._applyStickyPadding();
    this.editor.render(this._ctx);
    this._drawStickyScroll();
    if (this._minimap) this._minimap.scheduleRender();
  }

  update() {
    if (!this._attached || !this._ctx) return;

    const curLine = this.editor.carets[0] ? this.editor.carets[0].line : 0;
    if (curLine !== this._lastBreadcrumbLine) {
      this._lastBreadcrumbLine = curLine;
      this._refreshBreadcrumb();
    }

    if (this._gamePaused) {
      if (this._lastCursorVisible !== true) {
        this._lastCursorVisible = true;
        this.editor._blinkPhase = 0;
        this._applyStickyPadding();
        this.editor.render(this._ctx);
        this._drawStickyScroll();
        if (this._minimap) this._minimap.scheduleRender();
      }
      return;
    }
    this.editor.tickBlink(Date.now());
    const curVis = this.editor.isCursorVisible();
    if (this.editor.needsRender() || curVis !== this._lastCursorVisible) {
      this._applyStickyPadding();
      this.editor.render(this._ctx);
      this._drawStickyScroll();
      if (this._minimap) this._minimap.scheduleRender();
      this._lastCursorVisible = curVis;
    }
  }

  destroy() {
    this.detach();
  }

  getValue() {
    const doc = this.editor.activeDoc;
    return doc ? doc.getValue() : "";
  }

  setValue(v) {
    this.editor.setValue(v);
    this.renderForce();
    this._syncToolbar();
    this._syncStatusBar();
  }

  focus() {
    if (this._input) this._input.focus();
  }

  blur() {
    if (this._input) this._input.blur();
  }

  resize(width, height) {
    const appbarH = this._appbar ? this._appbar.height() : 0;
    const tabsH = this._tabs ? this._tabs.height() : 0;
    const breadcrumbH = this._breadcrumb ? this._breadcrumb.height() : 0;
    const toolbarH = this._toolbar ? this._toolbar.height() : 0;
    const statusH = this._statusbar ? this._statusbar.height() : 0;
    const searchH = this._searchbar ? this._searchbar.height() : 0;
    const topOffset = appbarH + tabsH + breadcrumbH + searchH;
    const bottomOffset = toolbarH + statusH;
    const usableHeight = Math.max(0, height - topOffset - bottomOffset);

    const minimapW =
      this._minimapVisible && this._minimap
        ? (this._minimap.width || MINIMAP_DEFAULT_W)
        : 0;
    const editorW = Math.max(0, width - minimapW);

    this.width = width;
    this.height = usableHeight;

    const dpr = window.devicePixelRatio || 1;
    const intDpr = Math.max(1, Math.ceil(dpr));
    this._dpr = intDpr;

    if (this._canvas) {
      this._canvas.width = Math.round(editorW * intDpr);
      this._canvas.height = Math.round(usableHeight * intDpr);
      this._canvas.style.width = editorW + "px";
      this._canvas.style.height = usableHeight + "px";
      this._canvas.style.top = topOffset + "px";
      this._ctx.setTransform(intDpr, 0, 0, intDpr, 0, 0);
    }

    if (this._input) {
      const wPx = editorW + "px";
      const hPx = usableHeight + "px";
      const tPx = topOffset + "px";
      if (this._input.style.width !== wPx) this._input.style.width = wPx;
      if (this._input.style.height !== hPx) this._input.style.height = hPx;
      if (this._input.style.top !== tPx) this._input.style.top = tPx;
    }

    if (this._minimap) {
      this._minimap.setLayout(
        this.x + editorW,
        this.y + topOffset,
        minimapW,
        usableHeight
      );
      if (this._minimapVisible) {
        this._minimap.resize(minimapW, usableHeight);
      }
    }

    if (this._stickyScroll) {
      this._stickyScroll.rowHeight = this.editor.renderer.lineHeight;
    }

    if (this._breadcrumb && this._breadcrumb._el) {
      this._breadcrumb._el.style.top = (appbarH + tabsH) + "px";
    }
    if (this._tabs && this._tabs._el) {
      this._tabs._el.style.top = appbarH + "px";
    }
    if (this._searchbar && this._searchbar._el) {
      this._searchbar._el.style.top = (appbarH + tabsH + breadcrumbH) + "px";
    }
    if (this._statusbar && this._statusbar._el) {
      this._statusbar._el.style.bottom = toolbarH + "px";
    }

    this.editor.setSize(editorW, usableHeight);
    this.renderForce();
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
    if (this._canvas) {
      this._canvas.style.left = x + "px";
    }
    if (this._input) {
      this._input.style.left = x + "px";
    }
    if (this._minimap) {
      this.resize(window.innerWidth, window.innerHeight);
    }
  }
}

export { LimnEditor };