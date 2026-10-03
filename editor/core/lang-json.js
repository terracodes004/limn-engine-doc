import { TOKEN, Token, HighlightState } from "./highlighter.js";

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
    
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === '"') { j++; break; }
        j++;
      }
      pushToken(tokens, TOKEN.STRING, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "-" || isDigit(c)) {
      let j = i;
      if (c === "-") j++;
      while (j < n && isDigit(line[j])) j++;
      if (line[j] === ".") {
        j++;
        while (j < n && isDigit(line[j])) j++;
      }
      if (line[j] === "e" || line[j] === "E") {
        j++;
        if (line[j] === "+" || line[j] === "-") j++;
        while (j < n && isDigit(line[j])) j++;
      }
      if (j > i) {
        pushToken(tokens, TOKEN.NUMBER, i, j, line);
        i = j;
        continue;
      }
    }
    
    if (c === "t" && line.slice(i, i + 4) === "true") {
      pushToken(tokens, TOKEN.BOOLEAN, i, i + 4, line);
      i += 4;
      continue;
    }
    
    if (c === "f" && line.slice(i, i + 5) === "false") {
      pushToken(tokens, TOKEN.BOOLEAN, i, i + 5, line);
      i += 5;
      continue;
    }
    
    if (c === "n" && line.slice(i, i + 4) === "null") {
      pushToken(tokens, TOKEN.BOOLEAN, i, i + 4, line);
      i += 4;
      continue;
    }
    
    if (c === ":" || c === "," || c === "{" || c === "}" ||
      c === "[" || c === "]") {
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
      continue;
    }
    
    pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
    i++;
  }
  
  return { tokens, state };
}

export const json = {
  name: "json",
  tokenizeLine,
};