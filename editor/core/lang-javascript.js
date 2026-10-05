import { TOKEN, Token, HighlightState } from "./highlighter.js";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "break", "continue", "new", "this", "class", "extends", "super",
  "try", "catch", "finally", "throw", "switch", "case", "default",
  "typeof", "instanceof", "in", "of", "delete", "void", "yield",
  "await", "async", "static", "get", "set", "import", "export", "from", "as",
]);

const LITERALS = new Set([
  "true", "false", "null", "undefined", "NaN", "Infinity",
]);

const BUILTINS = new Set([
  "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date",
  "Set", "Map", "Promise", "Error", "RegExp", "Symbol", "WeakMap", "WeakSet",
  "console", "window", "document", "globalThis",
  "Display", "Component", "Tctxt", "Camera", "Sprite", "AnimatedSprite",
  "Tile", "TileMap", "Particle", "ParticleSystem", "Sound", "SoundManager",
]);

function isIdentStart(c) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$";
}

function isIdentPart(c) {
  return isIdentStart(c) || (c >= "0" && c <= "9");
}

function isDigit(c) {
  return c >= "0" && c <= "9";
}

function isWhitespace(c) {
  return c === " " || c === "\t" || c === "\r";
}

function pushToken(tokens, type, start, end, text) {
  if (end > start) tokens.push(new Token(type, start, end, text.slice(start, end)));
}

export function tokenizeLine(line, startState) {
  const tokens = [];
  const state = startState ? startState.clone() : new HighlightState();
  const n = line.length;
  let i = 0;

  if (state.inBlockComment) {
    const end = line.indexOf("*/");
    if (end === -1) {
      pushToken(tokens, TOKEN.COMMENT, 0, n, line);
      return { tokens, state };
    }
    pushToken(tokens, TOKEN.COMMENT, 0, end + 2, line);
    state.inBlockComment = false;
    i = end + 2;
  }

  while (i < n) {
    const c = line[i];

    if (isWhitespace(c)) {
      let j = i;
      while (j < n && isWhitespace(line[j])) j++;
      pushToken(tokens, TOKEN.TEXT, i, j, line);
      i = j;
      continue;
    }

    if (c === "/" && line[i + 1] === "/") {
      pushToken(tokens, TOKEN.COMMENT, i, n, line);
      i = n;
      continue;
    }

    if (c === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        pushToken(tokens, TOKEN.COMMENT, i, n, line);
        state.inBlockComment = true;
        i = n;
      } else {
        pushToken(tokens, TOKEN.COMMENT, i, end + 2, line);
        i = end + 2;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === quote) { j++; break; }
        j++;
      }
      pushToken(tokens, TOKEN.STRING, i, j, line);
      i = j;
      continue;
    }

    if (c === "`") {
      let j = i + 1;
      let closed = false;
      let foundInterp = false;
      while (j < n) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === "`") { j++; closed = true; break; }
        if (line[j] === "$" && line[j + 1] === "{") {
          pushToken(tokens, TOKEN.STRING, i, j + 2, line);
          state.inTemplateLiteral = true;
          state.templateDepth = 1;
          i = j + 2;
          foundInterp = true;
          break;
        }
        j++;
      }
      if (closed) {
        pushToken(tokens, TOKEN.STRING, i, j, line);
        i = j;
      } else if (!foundInterp) {
        pushToken(tokens, TOKEN.STRING, i, n, line);
        i = n;
      }
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(line[i + 1]))) {
      let j = i;
      if (c === "0" && (line[i + 1] === "x" || line[i + 1] === "X" ||
                        line[i + 1] === "b" || line[i + 1] === "B" ||
                        line[i + 1] === "o" || line[i + 1] === "O")) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F_]/.test(line[j])) j++;
      } else {
        while (j < n && /[0-9_]/.test(line[j])) j++;
        if (line[j] === ".") {
          j++;
          while (j < n && /[0-9_]/.test(line[j])) j++;
        }
        if (line[j] === "e" || line[j] === "E") {
          j++;
          if (line[j] === "+" || line[j] === "-") j++;
          while (j < n && isDigit(line[j])) j++;
        }
      }
      pushToken(tokens, TOKEN.NUMBER, i, j, line);
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(line[j])) j++;
      const word = line.slice(i, j);

      let k = j;
      while (k < n && isWhitespace(line[k])) k++;
      const isCall = line[k] === "(";

      let lb = i - 1;
      while (lb >= 0 && isWhitespace(line[lb])) lb--;
      const isProperty = lb >= 0 && line[lb] === ".";

      let type = TOKEN.TEXT;
      if (LITERALS.has(word)) type = TOKEN.BOOLEAN;
      else if (KEYWORDS.has(word)) type = TOKEN.KEYWORD;
      else if (BUILTINS.has(word)) type = TOKEN.TYPE;
      else if (isProperty) type = TOKEN.PROPERTY;
      else if (isCall) type = TOKEN.FUNCTION;
      else if (word[0] >= "A" && word[0] <= "Z") type = TOKEN.TYPE;

      pushToken(tokens, type, i, j, line);
      i = j;
      continue;
    }

    if ("+-*/%=<>!&|^~?:".includes(c)) {
      let j = i;
      while (j < n && "+-*/%=<>!&|^~?:".includes(line[j])) j++;
      pushToken(tokens, TOKEN.OPERATOR, i, j, line);
      i = j;
      continue;
    }

    if ("()[]{};,.".includes(c)) {
      if (c === "}" && state.templateDepth > 0) {
        state.templateDepth--;
        if (state.templateDepth === 0) {
          pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
          i++;
          let j = i;
          let closed = false;
          while (j < n) {
            if (line[j] === "\\") { j += 2; continue; }
            if (line[j] === "`") { j++; closed = true; break; }
            if (line[j] === "$" && line[j + 1] === "{") {
              pushToken(tokens, TOKEN.STRING, i, j + 2, line);
              state.templateDepth = 1;
              i = j + 2;
              break;
            }
            j++;
          }
          if (closed) {
            pushToken(tokens, TOKEN.STRING, i, j, line);
            state.inTemplateLiteral = false;
            i = j;
          }
          continue;
        }
      }
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
      continue;
    }

    pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
    i++;
  }

  return { tokens, state };
}

export const javascript = {
  name: "javascript",
  tokenizeLine,
  keywords: KEYWORDS,
  literals: LITERALS,
  builtins: BUILTINS,
};