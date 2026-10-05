const STORAGE_KEY = "limn-editor-state-v1";
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export function isAvailable() {
  try {
    if (typeof localStorage === "undefined") return false;
    const k = "__limn_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

export function serializeState(docs, activeId) {
  const items = [];
  let totalBytes = 0;
  for (const doc of docs.items) {
    const value = doc.buffer.getText();
    const bytes = value.length * 2;
    if (totalBytes + bytes > MAX_TOTAL_BYTES) break;
    totalBytes += bytes;
    const cursor = doc.carets[0] || { line: 0, col: 0 };
    items.push({
      name: doc.name,
      value: value,
      cursor: { line: cursor.line, col: cursor.col },
      scrollTop: doc.viewport.scrollTop,
      scrollLeft: doc.viewport.scrollLeft,
      dirty: doc.dirty,
    });
  }
  return {
    version: 1,
    activeId: activeId || null,
    items: items,
    savedAt: Date.now(),
  };
}

export function saveToLocal(docs, activeId) {
  if (!isAvailable()) return false;
  try {
    const state = serializeState(docs, activeId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadFromLocal() {
  if (!isAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearLocal() {
  if (!isAvailable()) return false;
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function getSavedAt() {
  const state = loadFromLocal();
  return state ? state.savedAt : null;
}

export function applyStateToDocs(docs, state) {
  if (!state || !state.items || state.items.length === 0) return false;
  docs.items.length = 0;
  docs.activeIndex = -1;
  for (const item of state.items) {
    const doc = docs.add({
      name: item.name || "untitled.js",
      value: item.value || "",
    });
    if (item.cursor) {
      doc.carets[0].line = item.cursor.line || 0;
      doc.carets[0].col = item.cursor.col || 0;
    }
    doc.scrollTop = item.scrollTop || 0;
    doc.scrollLeft = item.scrollLeft || 0;
    doc.dirty = !!item.dirty;
    doc.viewport.setScroll(doc.scrollTop, doc.scrollLeft);
  }
  if (state.activeId !== null && state.activeId !== undefined) {
    const idx = docs.items.findIndex((d) => d.id === state.activeId);
    if (idx >= 0) docs.switchTo(idx);
  }
  return true;
}

export function createDebouncedSaver(docs, activeIdFn, delayMs) {
  let timer = null;
  const delay = delayMs || 500;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        saveToLocal(docs, activeIdFn ? activeIdFn() : null);
      }, delay);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return saveToLocal(docs, activeIdFn ? activeIdFn() : null);
    },
  };
}