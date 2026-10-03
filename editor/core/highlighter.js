export const TOKEN = {
  TEXT: "text",
  KEYWORD: "keyword",
  STRING: "string",
  NUMBER: "number",
  COMMENT: "comment",
  FUNCTION: "function",
  TYPE: "type",
  PROPERTY: "property",
  OPERATOR: "operator",
  PUNCTUATION: "punctuation",
  BOOLEAN: "boolean",
  REGEX: "regex",
  CLASS: "class",
};

export class HighlightState {
  constructor() {
    this.inBlockComment = false;
    this.inTemplateLiteral = false;
    this.templateDepth = 0;
    this.inComment = false;
    this.inCodeFence = false;
  }
  
  clone() {
    const s = new HighlightState();
    s.inBlockComment = this.inBlockComment;
    s.inTemplateLiteral = this.inTemplateLiteral;
    s.templateDepth = this.templateDepth;
    s.inComment = this.inComment;
    s.inCodeFence = this.inCodeFence;
    return s;
  }
  
  equals(other) {
    return (
      this.inBlockComment === other.inBlockComment &&
      this.inTemplateLiteral === other.inTemplateLiteral &&
      this.templateDepth === other.templateDepth &&
      this.inComment === other.inComment &&
      this.inCodeFence === other.inCodeFence
    );
  }
}

export class Token {
  constructor(type, start, end, text) {
    this.type = type;
    this.start = start;
    this.end = end;
    this.text = text;
  }
}

export class Highlighter {
  constructor(language) {
    this.language = language;
    this.lineCache = new Map();
    this.stateCache = [];
    this.stateCache[0] = new HighlightState();
  }
  
  setLanguage(language) {
    if (this.language === language) return;
    this.language = language;
    this.invalidateAll();
  }
  
  tokenizeLine(text, startState) {
    if (this.language && typeof this.language.tokenizeLine === "function") {
      return this.language.tokenizeLine(text, startState || new HighlightState());
    }
    return {
      tokens: [new Token(TOKEN.TEXT, 0, text.length, text)],
      state: new HighlightState(),
    };
  }
  
  getLineTokens(lineIndex, text) {
    const key = lineIndex + "\u0000" + text;
    const cached = this.lineCache.get(key);
    if (cached) return cached;
    
    const startState = this.stateCache[lineIndex] || new HighlightState();
    const result = this.tokenizeLine(text, startState);
    
    this.stateCache[lineIndex + 1] = result.state;
    const entry = { tokens: result.tokens, state: result.state };
    this.lineCache.set(key, entry);
    return entry;
  }
  
  invalidateFrom(lineIndex) {
    const toRemove = [];
    for (const key of this.lineCache.keys()) {
      const idx = parseInt(key.split("\u0000")[0], 10);
      if (idx >= lineIndex) toRemove.push(key);
    }
    for (const k of toRemove) this.lineCache.delete(k);
    this.stateCache.length = Math.min(this.stateCache.length, lineIndex + 1);
    if (lineIndex === 0) {
      this.stateCache[0] = new HighlightState();
    }
  }
  
  invalidateAll() {
    this.lineCache.clear();
    this.stateCache.length = 0;
    this.stateCache[0] = new HighlightState();
  }
  
  recomputeStates(buffer, fromLine) {
    let i = fromLine;
    const n = buffer.lineCount();
    while (i < n) {
      const text = buffer.getLine(i);
      const startState = this.stateCache[i] || new HighlightState();
      const result = this.tokenizeLine(text, startState);
      const prev = this.stateCache[i + 1];
      this.stateCache[i + 1] = result.state;
      if (prev && prev.equals(result.state)) break;
      i++;
    }
  }
}