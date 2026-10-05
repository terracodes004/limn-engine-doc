import {
  EditorChange,
  applyChanges,
  applyChangesInOrder,
  invertChange,
} from "./transaction.js";

const COALESCE_MS = 400;

function isWordChar(c) {
  return /[A-Za-z0-9_$]/.test(c);
}

function isWhitespaceChar(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

function lastCharOfInsert(insert) {
  if (!insert) return "";
  return insert[insert.length - 1];
}

function firstCharOfInsert(insert) {
  if (!insert) return "";
  return insert[0];
}

function shouldBreakCoalesce(prevInsert, nextInsert) {
  if (!prevInsert || !nextInsert) return true;
  
  const prevChar = lastCharOfInsert(prevInsert);
  const nextChar = firstCharOfInsert(nextInsert);
  
  if (prevChar === "\n" || nextChar === "\n") return true;
  
  const prevIsWord = isWordChar(prevChar);
  const nextIsWord = isWordChar(nextChar);
  const prevIsWs = isWhitespaceChar(prevChar);
  const nextIsWs = isWhitespaceChar(nextChar);
  
  if (prevIsWord && nextIsWord) return false;
  if (prevIsWs && nextIsWs) return false;
  
  return true;
}

export class History {
  constructor(maxEntries = 500) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxEntries = maxEntries;
    this._lastLabel = null;
    this._lastTime = 0;
    this._batchDepth = 0;
    this._batchChanges = null;
    this._batchSelectionBefore = null;
  }
  
  beginBatch() {
    if (this._batchDepth === 0) {
      this._batchChanges = [];
      this._batchSelectionBefore = null;
    }
    this._batchDepth++;
  }
  
  record(buffer, change, selectionBefore, selectionAfter, label) {
    if (this._batchDepth > 0) {
      this._batchChanges.push(change);
      if (!this._batchSelectionBefore) {
        this._batchSelectionBefore = selectionBefore;
      }
      return;
    }
    
    const inverse = invertChange(buffer, change);
    
    const canCoalesce =
      this._lastLabel === "insert" &&
      label === "insert" &&
      Date.now() - this._lastTime < COALESCE_MS &&
      this.undoStack.length > 0 &&
      !this.undoStack[this.undoStack.length - 1].isSnapshot &&
      this.undoStack[this.undoStack.length - 1].label === "insert";
    
    if (canCoalesce) {
      const top = this.undoStack[this.undoStack.length - 1];
      const prevInv = top.undo[0];
      const prevRedo = top.redo[0];
      
      const adjacent =
        change.fromLine === prevInv.fromLine &&
        change.fromCol === prevInv.fromCol;
      
      if (adjacent && !shouldBreakCoalesce(prevRedo.insert, change.insert)) {
        top.undo[0] = new EditorChange(
          prevInv.fromLine,
          prevInv.fromCol,
          prevInv.fromLine,
          prevInv.fromCol,
          prevInv.insert + inverse.insert
        );
        top.redo[0] = new EditorChange(
          prevRedo.fromLine,
          prevRedo.fromCol,
          prevRedo.fromLine,
          prevRedo.fromCol,
          prevRedo.insert + change.insert
        );
        top.selectionAfter = selectionAfter;
        top.time = Date.now();
        this.redoStack.length = 0;
        this._lastTime = Date.now();
        this._lastLabel = "insert";
        return;
      }
    }
    
    this._commit([inverse], [change], selectionBefore, selectionAfter, label);
  }
  
  endBatch(buffer, selectionBefore, selectionAfter, label) {
    this._batchDepth--;
    if (this._batchDepth > 0) return;
    
    const changes = this._batchChanges;
    this._batchChanges = null;
    this._batchDepth = 0;
    
    if (!changes || changes.length === 0) return;
    
    const beforeSnapshot = buffer.lines.slice();
    applyChanges(buffer, changes);
    const afterSnapshot = buffer.lines.slice();
    
    this.undoStack.push({
      isSnapshot: true,
      undoSnapshot: beforeSnapshot,
      redoSnapshot: afterSnapshot,
      selectionBefore: selectionBefore || this._batchSelectionBefore,
      selectionAfter,
      label: label || "",
      time: Date.now(),
    });
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack.length = 0;
    this._lastLabel = label || null;
    this._lastTime = Date.now();
    this._batchSelectionBefore = null;
  }
  
  _commit(undo, redo, selectionBefore, selectionAfter, label) {
    this.undoStack.push({
      isSnapshot: false,
      undo,
      redo,
      selectionBefore,
      selectionAfter,
      label: label || "",
      time: Date.now(),
    });
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack.length = 0;
    this._lastLabel = label || null;
    this._lastTime = Date.now();
  }
  
  canUndo() {
    return this.undoStack.length > 0;
  }
  
  canRedo() {
    return this.redoStack.length > 0;
  }
  
  undo(buffer) {
    if (!this.canUndo()) return null;
    const entry = this.undoStack.pop();
    
    if (entry.isSnapshot) {
      buffer.lines = entry.undoSnapshot.slice();
      buffer._invalidate();
    } else {
      applyChangesInOrder(buffer, entry.undo);
    }
    
    this.redoStack.push(entry);
    this._lastLabel = null;
    this._lastTime = 0;
    return { selection: entry.selectionBefore, label: entry.label };
  }
  
  redo(buffer) {
    if (!this.canRedo()) return null;
    const entry = this.redoStack.pop();
    
    if (entry.isSnapshot) {
      buffer.lines = entry.redoSnapshot.slice();
      buffer._invalidate();
    } else {
      applyChangesInOrder(buffer, entry.redo);
    }
    
    this.undoStack.push(entry);
    this._lastLabel = null;
    this._lastTime = 0;
    return { selection: entry.selectionAfter, label: entry.label };
  }
  
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._lastLabel = null;
    this._lastTime = 0;
    this._batchDepth = 0;
    this._batchChanges = null;
    this._batchSelectionBefore = null;
  }
}