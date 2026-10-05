import { TOKEN, Token, HighlightState } from "./highlighter.js";

const PROPERTIES = new Set([
  "color", "background", "background-color", "background-image", "background-position",
  "background-size", "background-repeat", "background-attachment", "background-clip",
  "background-origin", "background-blend-mode",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-radius",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "display", "position", "top", "right", "bottom", "left", "float", "clear",
  "flex", "flex-direction", "flex-wrap", "flex-flow", "flex-grow", "flex-shrink",
  "flex-basis", "justify-content", "align-items", "align-self", "align-content",
  "gap", "row-gap", "column-gap",
  "grid", "grid-template", "grid-template-columns", "grid-template-rows",
  "grid-template-areas", "grid-column", "grid-row", "grid-area", "grid-gap",
  "font", "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-decoration",
  "text-transform", "text-indent", "text-shadow", "text-overflow", "white-space",
  "overflow", "overflow-x", "overflow-y", "opacity", "visibility",
  "cursor", "pointer-events", "user-select", "touch-action",
  "transform", "transform-origin", "transition", "transition-property",
  "transition-duration", "transition-timing-function", "transition-delay",
  "animation", "animation-name", "animation-duration", "animation-timing-function",
  "animation-delay", "animation-iteration-count", "animation-direction",
  "animation-fill-mode", "animation-play-state",
  "box-shadow", "box-sizing", "outline", "outline-color", "outline-style",
  "outline-width", "outline-offset",
  "content", "z-index", "resize", "object-fit", "object-position",
  "filter", "backdrop-filter", "mix-blend-mode",
  "clip-path", "mask", "will-change", "aspect-ratio",
  "color-scheme", "accent-color", "scroll-behavior", "scroll-snap-type",
]);

function isWhitespace(c) {
  return c === " " || c === "\t" || c === "\r";
}

function isIdentStart(c) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "-" || c === "_";
}

function isIdentPart(c) {
  return isIdentStart(c) || (c >= "0" && c <= "9");
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
  
  let insideBlock = false;
  let braceDepth = 0;
  for (let k = 0; k < i; k++) {
    if (line[k] === "{") braceDepth++;
    else if (line[k] === "}") braceDepth = Math.max(0, braceDepth - 1);
  }
  insideBlock = braceDepth > 0;
  
  while (i < n) {
    const c = line[i];
    
    if (isWhitespace(c)) {
      let j = i;
      while (j < n && isWhitespace(line[j])) j++;
      pushToken(tokens, TOKEN.TEXT, i, j, line);
      i = j;
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
    
    if (c === "{") {
      insideBlock = true;
      braceDepth++;
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
      continue;
    }
    
    if (c === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      if (braceDepth === 0) insideBlock = false;
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
      continue;
    }
    
    if (c === "(" || c === ")" || c === ";" || c === ",") {
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
      continue;
    }
    
    if (c === ":" && insideBlock) {
      pushToken(tokens, TOKEN.PUNCTUATION, i, i + 1, line);
      i++;
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
    
    if (c === "#" && (line[i + 1] === "#" || /[0-9a-fA-F]/.test(line[i + 1] || ""))) {
      let j = i;
      if (line[i + 1] === "#") {
        j = i + 2;
        while (j < n && isIdentPart(line[j])) j++;
      } else {
        j++;
        while (j < n && /[0-9a-fA-F]/.test(line[j])) j++;
      }
      pushToken(tokens, TOKEN.NUMBER, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "." || c === "#" || c === "[" || c === "]") {
      if (!insideBlock) {
        let j = i + 1;
        while (j < n && (isIdentPart(line[j]) || line[j] === ":" || line[j] === ".")) j++;
        pushToken(tokens, TOKEN.CLASS || TOKEN.TYPE, i, j, line);
        i = j;
        continue;
      }
    }
    
    if (c === "@") {
      let j = i + 1;
      while (j < n && isIdentPart(line[j])) j++;
      pushToken(tokens, TOKEN.KEYWORD, i, j, line);
      i = j;
      continue;
    }
    
    if (c === "!" && line[i + 1] === "i") {
      let j = i + 1;
      while (j < n && isIdentPart(line[j])) j++;
      if (line.slice(i, j).toLowerCase() === "!important") {
        pushToken(tokens, TOKEN.KEYWORD, i, j, line);
        i = j;
        continue;
      }
    }
    
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(line[j])) j++;
      const word = line.slice(i, j);
      const wordLower = word.toLowerCase();
      
      let k = j;
      while (k < n && isWhitespace(line[k])) k++;
      
      if (insideBlock && line[k] === ":") {
        const type = PROPERTIES.has(wordLower) ? TOKEN.PROPERTY : TOKEN.TEXT;
        pushToken(tokens, type, i, j, line);
      } else if (wordLower === "important") {
        pushToken(tokens, TOKEN.KEYWORD, i, j, line);
      } else if (!insideBlock) {
        pushToken(tokens, TOKEN.TYPE, i, j, line);
      } else {
        pushToken(tokens, TOKEN.TEXT, i, j, line);
      }
      i = j;
      continue;
    }
    
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9.]/.test(line[j])) j++;
      while (j < n && /[a-z%]/.test(line[j])) j++;
      pushToken(tokens, TOKEN.NUMBER, i, j, line);
      i = j;
      continue;
    }
    
    if ("+-*/=<>!&|^~?".includes(c)) {
      let j = i;
      while (j < n && "+-*/=<>!&|^~?".includes(line[j])) j++;
      pushToken(tokens, TOKEN.OPERATOR, i, j, line);
      i = j;
      continue;
    }
    
    pushToken(tokens, TOKEN.TEXT, i, i + 1, line);
    i++;
  }
  
  return { tokens, state };
}

export const css = {
  name: "css",
  tokenizeLine,
};