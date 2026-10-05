import { TOKEN, Token, HighlightState } from "./highlighter.js";

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
  
  if (state.inComment) {
    const end = line.indexOf("-->");
    if (end === -1) {
      pushToken(tokens, TOKEN.COMMENT, 0, n, line);
      return { tokens, state };
    }
    pushToken(tokens, TOKEN.COMMENT, 0, end + 3, line);
    state.inComment = false;
    i = end + 3;
  }
  
  while (i < n) {
    const c = line[i];
    
    if (c === "<" && line.slice(i, i + 4) === "<!--") {
      const end = line.indexOf("-->", i + 4);
      if (end === -1) {
        pushToken(tokens, TOKEN.COMMENT, i, n, line);
        state.inComment = true;
        i = n;
      } else {
        pushToken(tokens, TOKEN.COMMENT, i, end + 3, line);
        i = end + 3;
      }
      continue;
    }
    
    if (c === "<" && line[i + 1] === "!") {
      const end = line.indexOf(">", i);
      if (end === -1) {
        pushToken(tokens, TOKEN.TEXT, i, n, line);
        i = n;
      } else {
        pushToken(tokens, TOKEN.TEXT, i, end + 1, line);
        i = end + 1;
      }
      continue;
    }
    
    if (c === "<") {
      const tagStart = i;
      i++;
      
      const closing = line[i] === "/";
      if (closing) i++;
      
      let nameStart = i;
      while (i < n && /[a-zA-Z0-9-]/.test(line[i])) i++;
      const tagName = line.slice(nameStart, i);
      
      pushToken(tokens, closing ? TOKEN.TYPE : TOKEN.KEYWORD, tagStart, i, line);
      
      while (i < n && line[i] !== ">") {
        if (isWhitespace(line[i])) {
          let j = i;
          while (j < n && isWhitespace(line[j])) j++;
          pushToken(tokens, TOKEN.TEXT, i, j, line);
          i = j;
          continue;
        }
        
        if (line[i] === "/" && line[i + 1] === ">") {
          pushToken(tokens, TOKEN.PUNCTUATION, i, i + 2, line);
          i += 2;
          break;
        }
        
        if (line[i] === ">") {
          pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
          i++;
          break;
        }
        
        if (line[i] === "=") {
          pushToken(tokens, TOKEN.OPERATOR, i, i + 1, line);
          i++;
          continue;
        }
        
        if (line[i] === '"' || line[i] === "'") {
          const quote = line[i];
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
        
        if (/[a-zA-Z]/.test(line[i])) {
          let j = i;
          while (j < n && /[a-zA-Z0-9-_:]/.test(line[j])) j++;
          pushToken(tokens, TOKEN.PROPERTY, i, j, line);
          i = j;
          continue;
        }
        
        pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
        i++;
      }
      
      if (i <= n && line[i - 1] === ">") {
        continue;
      }
      continue;
    }
    
    if (c === "&") {
      let j = i + 1;
      while (j < n && line[j] !== ";" && j - i < 10) j++;
      if (line[j] === ";") {
        pushToken(tokens, TOKEN.NUMBER, i, j + 1, line);
        i = j + 1;
        continue;
      }
    }
    
    let j = i;
    while (j < n && line[j] !== "<" && line[j] !== "&") j++;
    if (j > i) {
      pushToken(tokens, TOKEN.TEXT, i, j, line);
      i = j;
      continue;
    }
    
    pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
    i++;
  }
  
  return { tokens, state };
}

export const html = {
  name: "html",
  tokenizeLine,
};