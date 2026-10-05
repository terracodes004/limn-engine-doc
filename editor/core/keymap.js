export const KEY = {
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  ENTER: "Enter",
  TAB: "Tab",
  ESCAPE: "Escape",
  SPACE: " ",
};

export function isWordChar(c) {
  return /[A-Za-z0-9_$]/.test(c);
}

export function findWordLeft(line, col) {
  let i = col;
  while (i > 0 && !isWordChar(line[i - 1])) i--;
  while (i > 0 && isWordChar(line[i - 1])) i--;
  return i;
}

export function findWordRight(line, col) {
  let i = col;
  const n = line.length;
  while (i < n && !isWordChar(line[i])) i++;
  while (i < n && isWordChar(line[i])) i++;
  return i;
}

export function findLineStart(line) {
  return 0;
}

export function findLineEnd(line) {
  return line.length;
}

export function firstNonWhitespace(line) {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  return i;
}

export function indentOf(line) {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  return line.slice(0, i);
}

export function computeIndent(buffer, line, tabSize) {
  const text = buffer.getLine(line);
  const base = indentOf(text);
  const trimmed = text.replace(/\s+$/, "");
  const last = trimmed[trimmed.length - 1];
  if (last === "{" || last === "(" || last === "[") {
    return base + " ".repeat(tabSize);
  }
  return base;
}

export function isOpenBracket(c) {
  return c === "(" || c === "[" || c === "{";
}

export function isCloseBracket(c) {
  return c === ")" || c === "]" || c === "}";
}

export const PAIRS = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

export const CLOSERS = {
  ")": "(",
  "]": "[",
  "}": "{",
};

export function matchingClose(open) {
  return PAIRS[open] || null;
}

export function isQuote(c) {
  return c === '"' || c === "'" || c === "`";
}