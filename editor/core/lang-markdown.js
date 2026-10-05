import { TOKEN, Token, HighlightState } from "./highlighter.js";

function pushToken(tokens, type, start, end, text) {
  if (end > start) tokens.push(new Token(type, start, end, text.slice(start, end)));
}

export function tokenizeLine(line, startState) {
  const tokens = [];
  const state = startState ? startState.clone() : new HighlightState();
  const n = line.length;
  let i = 0;
  
  if (state.inCodeFence) {
    if (/^```/.test(line)) {
      pushToken(tokens, TOKEN.PUNCTUATION, 0, n, line);
      state.inCodeFence = false;
    } else {
      pushToken(tokens, TOKEN.STRING, 0, n, line);
    }
    return { tokens, state };
  }
  
  if (/^```/.test(line)) {
    pushToken(tokens, TOKEN.PUNCTUATION, 0, n, line);
    state.inCodeFence = true;
    return { tokens, state };
  }
  
  if (/^#{1,6}\s/.test(line)) {
    const match = line.match(/^#{1,6}\s/);
    pushToken(tokens, TOKEN.KEYWORD, 0, match[0].length, line);
    pushToken(tokens, TOKEN.TYPE, match[0].length, n, line);
    return { tokens, state };
  }
  
  if (/^>\s?/.test(line)) {
    const match = line.match(/^>\s?/);
    pushToken(tokens, TOKEN.KEYWORD, 0, match[0].length, line);
    i = match[0].length;
  }
  
  if (/^\s*[-*+]\s/.test(line)) {
    const match = line.match(/^\s*[-*+]\s/);
    pushToken(tokens, TOKEN.TEXT, 0, match[0].length - 1, line);
    pushToken(tokens, TOKEN.OPERATOR, match[0].length - 1, match[0].length, line);
    i = match[0].length;
  } else if (/^\s*\d+\.\s/.test(line)) {
    const match = line.match(/^\s*\d+\.\s/);
    pushToken(tokens, TOKEN.TEXT, 0, match[0].length - 1, line);
    pushToken(tokens, TOKEN.OPERATOR, match[0].length - 1, match[0].length, line);
    i = match[0].length;
  }
  
  while (i < n) {
    const c = line[i];
    
    if (c === "`") {
      let j = i + 1;
      while (j < n && line[j] !== "`") j++;
      if (line[j] === "`") j++;
      pushToken(tokens, TOKEN.STRING, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "*" && line[i + 1] === "*") {
      let j = i + 2;
      while (j < n - 1 && !(line[j] === "*" && line[j + 1] === "*")) j++;
      if (line[j] === "*" && line[j + 1] === "*") j += 2;
      pushToken(tokens, TOKEN.KEYWORD, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "*" || c === "_") {
      let j = i + 1;
      while (j < n && line[j] !== c) j++;
      if (line[j] === c) j++;
      pushToken(tokens, TOKEN.TYPE, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "[") {
      const close = line.indexOf("]", i);
      if (close !== -1 && line[close + 1] === "(") {
        const end = line.indexOf(")", close + 2);
        if (end !== -1) {
          pushToken(tokens, TOKEN.TYPE, i, close + 1, line);
          pushToken(tokens, TOKEN.STRING, close + 1, end + 1, line);
          i = end + 1;
          continue;
        }
      }
    }
    
    pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
    i++;
  }
  
  return { tokens, state };
}

export const markdown = {
  name: "markdown",
  tokenizeLine,
};