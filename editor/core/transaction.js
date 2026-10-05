export class EditorChange {
  constructor(fromLine, fromCol, toLine, toCol, insert) {
    this.fromLine = fromLine;
    this.fromCol = fromCol;
    this.toLine = toLine;
    this.toCol = toCol;
    this.insert = insert;
  }
  
  static insert(line, col, text) {
    return new EditorChange(line, col, line, col, text);
  }
  
  static remove(fromLine, fromCol, toLine, toCol) {
    return new EditorChange(fromLine, fromCol, toLine, toCol, "");
  }
  
  static replace(fromLine, fromCol, toLine, toCol, text) {
    return new EditorChange(fromLine, fromCol, toLine, toCol, text);
  }
  
  isInsert() {
    return this.insert !== "" && this.fromLine === this.toLine && this.fromCol === this.toCol;
  }
  
  isRemove() {
    return this.insert === "" && (this.fromLine !== this.toLine || this.fromCol !== this.toCol);
  }
  
  isReplace() {
    return this.insert !== "" && (this.fromLine !== this.toLine || this.fromCol !== this.toCol);
  }
}

export class EditorTransaction {
  constructor(changes, selectionBefore, selectionAfter) {
    this.changes = changes || [];
    this.selectionBefore = selectionBefore || [];
    this.selectionAfter = selectionAfter || [];
  }
  
  static of (change, selBefore, selAfter) {
    return new EditorTransaction([change], selBefore, selAfter);
  }
  
  isEmpty() {
    return this.changes.length === 0;
  }
}

function shiftPosition(line, col, change) {
  const insertLines = change.insert.split("\n");
  const insertLineCount = insertLines.length;
  const removedLineCount = change.toLine - change.fromLine + 1;
  const lineDelta = insertLineCount - removedLineCount;
  
  const isPureInsert =
    change.fromLine === change.toLine && change.fromCol === change.toCol;
  
  if (isPureInsert) {
    if (line < change.fromLine) return { line, col };
    
    if (line === change.fromLine) {
      if (col < change.fromCol) return { line, col };
      
      const colOffset = col - change.fromCol;
      if (insertLineCount === 1) {
        return { line, col: change.fromCol + change.insert.length + colOffset };
      }
      return {
        line: change.fromLine + insertLineCount - 1,
        col: insertLines[insertLineCount - 1].length + colOffset,
      };
    }
    
    return { line: line + insertLineCount - 1, col };
  }
  
  if (line < change.fromLine) return { line, col };
  
  if (line > change.toLine) {
    return { line: line + lineDelta, col };
  }
  
  if (line === change.fromLine && line === change.toLine) {
    if (col <= change.fromCol) return { line, col };
    if (col >= change.toCol) {
      const delta = change.insert.length - (change.toCol - change.fromCol);
      return { line, col: col + delta };
    }
    return {
      line: change.fromLine,
      col: change.fromCol + change.insert.length,
    };
  }
  
  if (line === change.fromLine) {
    if (col <= change.fromCol) return { line, col };
    return {
      line: change.fromLine + insertLineCount - 1,
      col: insertLines[insertLineCount - 1].length + (col - change.fromCol),
    };
  }
  
  if (line < change.toLine) {
    return {
      line: change.fromLine + insertLineCount - 1,
      col: insertLines[insertLineCount - 1].length,
    };
  }
  
  if (line === change.toLine) {
    if (col <= change.toCol) {
      return {
        line: change.fromLine + insertLineCount - 1,
        col: insertLines[insertLineCount - 1].length,
      };
    }
    return {
      line: change.fromLine + insertLineCount - 1,
      col: insertLines[insertLineCount - 1].length + (col - change.toCol),
    };
  }
  
  return { line, col };
}

export function applyChanges(buffer, changes) {
  const sorted = changes.slice().sort((a, b) => {
    if (a.fromLine !== b.fromLine) return b.fromLine - a.fromLine;
    return b.fromCol - a.fromCol;
  });
  
  for (const c of sorted) {
    buffer.remove(c.fromLine, c.fromCol, c.toLine, c.toCol);
    if (c.insert) {
      buffer.insert(c.fromLine, c.fromCol, c.insert);
    }
  }
}

export function applyChangesInOrder(buffer, changes) {
  for (const c of changes) {
    buffer.remove(c.fromLine, c.fromCol, c.toLine, c.toCol);
    if (c.insert) {
      buffer.insert(c.fromLine, c.fromCol, c.insert);
    }
  }
}

export function mapPosition(line, col, changes) {
  let pos = { line, col };
  const sorted = changes.slice().sort((a, b) => {
    if (a.fromLine !== b.fromLine) return a.fromLine - b.fromLine;
    return a.fromCol - b.fromCol;
  });
  for (const c of sorted) {
    pos = shiftPosition(pos.line, pos.col, c);
  }
  return pos;
}

export function mapCaret(caret, changes) {
  const startPos = mapPosition(caret.start().line, caret.start().col, changes);
  const endPos = mapPosition(caret.end().line, caret.end().col, changes);
  const c = caret.clone();
  c.line = endPos.line;
  c.col = endPos.col;
  if (caret.anchor) {
    c.anchor = { line: startPos.line, col: startPos.col };
  }
  return c;
}

export function mapCarets(carets, changes) {
  return carets.map((c) => mapCaret(c, changes));
}

export function invertChange(buffer, change) {
  const removedText = buffer.slice(
    change.fromLine,
    change.fromCol,
    change.toLine,
    change.toCol
  );
  const newLines = change.insert.split("\n");
  const endLine = change.fromLine + newLines.length - 1;
  const endCol =
    newLines.length === 1 ?
    change.fromCol + change.insert.length :
    newLines[newLines.length - 1].length;
  return new EditorChange(
    change.fromLine,
    change.fromCol,
    endLine,
    endCol,
    removedText
  );
}