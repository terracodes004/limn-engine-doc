import { Decoration, DECORATION_TYPE } from "./decorations.js";

const OPENERS = "([{";
const CLOSERS = ")]}";
const MATCH = { "(": ")", "[": "]", "{": "}" };
const RMATCH = { ")": "(", "]": "[", "}": "{" };

export function findBracketMatch(buffer, line, col, options) {
  options = options || {};
  const maxDistance = options.maxDistance || 10000;
  
  const text = buffer.getLine(line);
  let ch = "";
  let bracketCol = -1;
  let dir = 0;
  
  if (col < text.length && (OPENERS.includes(text[col]) || CLOSERS.includes(text[col]))) {
    ch = text[col];
    bracketCol = col;
    dir = OPENERS.includes(ch) ? 1 : -1;
  } else if (col > 0 && (OPENERS.includes(text[col - 1]) || CLOSERS.includes(text[col - 1]))) {
    ch = text[col - 1];
    bracketCol = col - 1;
    dir = OPENERS.includes(ch) ? 1 : -1;
  } else {
    return null;
  }
  
  const target = OPENERS.includes(ch) ? MATCH[ch] : RMATCH[ch];
  const mySideIsOpen = OPENERS.includes(ch);
  
  let depth = 0;
  let scanned = 0;
  
  let curLine = line;
  let curCol = bracketCol;
  
  const lineCount = buffer.lineCount();
  const lineStep = dir > 0 ? 1 : -1;
  
  while (scanned < maxDistance) {
    const lineText = buffer.getLine(curLine);
    if (curLine !== line) {
      curCol = dir > 0 ? 0 : lineText.length - 1;
    } else if (dir > 0) {
      curCol = curCol + 1;
    } else {
      curCol = curCol - 1;
    }
    
    while (curCol >= 0 && curCol < lineText.length) {
      scanned++;
      if (scanned > maxDistance) return null;
      
      const c = lineText[curCol];
      
      if (dir > 0) {
        if (OPENERS.includes(c)) {
          depth++;
        } else if (CLOSERS.includes(c)) {
          if (depth === 0) {
            if (c === target) {
              return {
                open: { line, col: bracketCol },
                close: { line: curLine, col: curCol },
              };
            }
            return null;
          }
          depth--;
        }
      } else {
        if (CLOSERS.includes(c)) {
          depth++;
        } else if (OPENERS.includes(c)) {
          if (depth === 0) {
            if (c === target) {
              return {
                open: { line: curLine, col: curCol },
                close: { line, col: bracketCol },
              };
            }
            return null;
          }
          depth--;
        }
      }
      
      curCol += dir;
    }
    
    curLine += lineStep;
    if (curLine < 0 || curLine >= lineCount) return null;
  }
  
  return null;
}

export function buildBracketDecorations(buffer, line, col, options) {
  const set = [];
  const match = findBracketMatch(buffer, line, col, options);
  if (!match) return set;
  
  set.push(new Decoration(
    DECORATION_TYPE.BRACKET_MATCH,
    match.open.line,
    match.open.col,
    match.open.line,
    match.open.col + 1,
    null
  ));
  set.push(new Decoration(
    DECORATION_TYPE.BRACKET_MATCH,
    match.close.line,
    match.close.col,
    match.close.line,
    match.close.col + 1,
    null
  ));
  return set;
}