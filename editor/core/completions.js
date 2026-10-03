import { HTML_TAGS, isVoidTag } from "./html-tags.js";
import { CSS_PROPERTY_VALUES, CSS_AT_RULES, CSS_PSEUDO } from "./css-values.js";

const MIN_WORD_LENGTH = 2;
const MAX_COMPLETIONS = 50;

export function wordAtCursor(buffer, line, col) {
  const text = buffer.getLine(line);
  let start = col;
  while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) start--;
  let end = col;
  while (end < text.length && /[A-Za-z0-9_$]/.test(text[end])) end++;
  return {
    word: text.slice(start, end),
    startCol: start,
    endCol: end,
  };
}

export function prefixAtCursor(buffer, line, col) {
  const info = wordAtCursor(buffer, line, col);
  if (col !== info.endCol) return null;
  if (info.word.length < 1) return null;
  return info;
}

export function gatherWords(buffer) {
  const seen = new Map();
  const lineCount = buffer.lineCount();
  for (let i = 0; i < lineCount; i++) {
    const text = buffer.getLine(i);
    let j = 0;
    const n = text.length;
    while (j < n) {
      const c = text[j];
      if (/[A-Za-z_$]/.test(c)) {
        let k = j;
        while (k < n && /[A-Za-z0-9_$]/.test(text[k])) k++;
        const word = text.slice(j, k);
        if (word.length >= MIN_WORD_LENGTH) {
          seen.set(word, (seen.get(word) || 0) + 1);
        }
        j = k;
      } else {
        j++;
      }
    }
  }
  return seen;
}

function detectHtmlTagContext(buffer, line, col) {
  const text = buffer.getLine(line);
  let i = col - 1;
  while (i >= 0 && /[a-zA-Z0-9-]/.test(text[i])) i--;
  if (i < 0) return null;
  if (text[i] !== "<") return null;
  if (i > 0 && /[a-zA-Z0-9]/.test(text[i - 1])) return null;
  const prefix = text.slice(i + 1, col);
  if (!prefix) return null;
  
  // If there's a '>' after the cursor and before the next '<',
  // we're inside a fully-formed tag. Don't re-complete.
  const after = text.slice(col);
  const nextLt = after.indexOf("<");
  const nextGt = after.indexOf(">");
  if (nextGt !== -1 && (nextLt === -1 || nextGt < nextLt)) {
    return null;
  }
  
  return { startCol: i + 1, endCol: col, prefix };
}

function detectCssValueContext(buffer, line, col) {
  const text = buffer.getLine(line);
  let i = col - 1;
  while (i >= 0 && /[a-zA-Z0-9-]/.test(text[i])) i--;
  if (i < 0) return null;
  if (text[i] !== ":") return null;
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  const propEnd = j + 1;
  while (j >= 0 && /[a-zA-Z-]/.test(text[j])) j--;
  const prop = text.slice(j + 1, propEnd);
  if (!prop) return null;
  const prefix = text.slice(i + 1, col);
  if (/\s/.test(prefix)) return null;
  
  const before = text.slice(0, i);
  const lastOpen = before.lastIndexOf("{");
  const lastClose = before.lastIndexOf("}");
  if (lastOpen < lastClose) return null;
  
  return { prop, prefix, startCol: i + 1, endCol: col };
}

function detectCssAtRuleContext(buffer, line, col) {
  const text = buffer.getLine(line);
  let i = col - 1;
  while (i >= 0 && /[a-zA-Z-]/.test(text[i])) i--;
  if (i < 0) return null;
  if (text[i] !== "@") return null;
  const prefix = text.slice(i + 1, col);
  return { startCol: i + 1, endCol: col, prefix };
}

function detectCssPseudoContext(buffer, line, col) {
  const text = buffer.getLine(line);
  let i = col - 1;
  while (i >= 0 && /[a-zA-Z-]/.test(text[i])) i--;
  if (i < 0) return null;
  if (text[i] !== ":") return null;
  if (i > 0 && text[i - 1] === ":") return null;
  
  const before = text.slice(0, i);
  const lastOpen = before.lastIndexOf("{");
  const lastClose = before.lastIndexOf("}");
  if (lastOpen > lastClose) return null;
  
  const prefix = ":" + text.slice(i + 1, col);
  return { startCol: i, endCol: col, prefix };
}

function kindRank(kind) {
  if (kind === "keyword") return 0;
  if (kind === "builtin") return 1;
  if (kind === "literal") return 2;
  if (kind === "property") return 3;
  if (kind === "value") return 4;
  if (kind === "atrule") return 5;
  if (kind === "pseudo") return 6;
  if (kind === "tag") return 7;
  return 8;
}

export function getCompletions(buffer, line, col, language) {
  const langName = language ? language.name : null;
  
  if (langName === "html") {
    const tagCtx = detectHtmlTagContext(buffer, line, col);
    if (tagCtx) {
      const tagPrefix = tagCtx.prefix.toLowerCase();
      const matches = [];
      for (const tag of HTML_TAGS) {
        if (tag === tagPrefix) continue;
        if (!tag.startsWith(tagPrefix)) continue;
        matches.push({
          word: tag,
          kind: "tag",
          isVoid: isVoidTag(tag),
          startCol: tagCtx.startCol,
          endCol: tagCtx.endCol,
          line,
        });
      }
      matches.sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
      if (matches.length > 0) {
        return {
          prefix: tagCtx.prefix,
          startCol: tagCtx.startCol,
          endCol: tagCtx.endCol,
          items: matches.slice(0, MAX_COMPLETIONS),
        };
      }
    }
  }
  
  if (langName === "css") {
    const atCtx = detectCssAtRuleContext(buffer, line, col);
    if (atCtx) {
      const p = atCtx.prefix.toLowerCase();
      const matches = CSS_AT_RULES
        .filter((r) => r.startsWith(p) && r !== p)
        .map((r) => ({
          word: r,
          kind: "atrule",
          startCol: atCtx.startCol,
          endCol: atCtx.endCol,
          line,
        }));
      if (matches.length > 0) {
        return {
          prefix: atCtx.prefix,
          startCol: atCtx.startCol,
          endCol: atCtx.endCol,
          items: matches,
        };
      }
    }
    
    const valCtx = detectCssValueContext(buffer, line, col);
    if (valCtx) {
      const values = CSS_PROPERTY_VALUES[valCtx.prop.toLowerCase()] || [];
      const p = valCtx.prefix.toLowerCase();
      const matches = values
        .filter((v) => v.startsWith(p) && v !== p)
        .map((v) => ({
          word: v,
          kind: "value",
          startCol: valCtx.startCol,
          endCol: valCtx.endCol,
          line,
        }));
      if (matches.length > 0) {
        return {
          prefix: valCtx.prefix,
          startCol: valCtx.startCol,
          endCol: valCtx.endCol,
          items: matches,
        };
      }
    }
    
    const pseudoCtx = detectCssPseudoContext(buffer, line, col);
    if (pseudoCtx) {
      const p = pseudoCtx.prefix.toLowerCase();
      const matches = CSS_PSEUDO
        .filter((s) => s.toLowerCase().startsWith(p) && s !== p)
        .map((s) => ({
          word: s,
          kind: "pseudo",
          startCol: pseudoCtx.startCol,
          endCol: pseudoCtx.endCol,
          line,
        }));
      if (matches.length > 0) {
        return {
          prefix: pseudoCtx.prefix,
          startCol: pseudoCtx.startCol,
          endCol: pseudoCtx.endCol,
          items: matches,
        };
      }
    }
  }
  
  const prefix = prefixAtCursor(buffer, line, col);
  if (!prefix) return null;
  
  const lowerPrefix = prefix.word.toLowerCase();
  const candidates = new Map();
  
  if (language) {
    if (language.keywords) {
      for (const k of language.keywords) candidates.set(k, { label: k, kind: "keyword" });
    }
    if (language.builtins) {
      for (const b of language.builtins) {
        if (!candidates.has(b)) candidates.set(b, { label: b, kind: "builtin" });
      }
    }
    if (language.literals) {
      for (const l of language.literals) {
        if (!candidates.has(l)) candidates.set(l, { label: l, kind: "literal" });
      }
    }
  }
  
  const words = gatherWords(buffer);
  for (const [word] of words) {
    if (!candidates.has(word)) candidates.set(word, { label: word, kind: "word" });
  }
  
  const results = [];
  for (const [word, entry] of candidates) {
    if (word === prefix.word) continue;
    if (word.length < lowerPrefix.length) continue;
    if (word.toLowerCase().startsWith(lowerPrefix)) {
      results.push({ ...entry, word, line, startCol: prefix.startCol, endCol: prefix.endCol });
    }
  }
  
  results.sort((a, b) => {
    const aLower = a.word.toLowerCase();
    const bLower = b.word.toLowerCase();
    const aExact = aLower === lowerPrefix;
    const bExact = bLower === lowerPrefix;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aKind = kindRank(a.kind);
    const bKind = kindRank(b.kind);
    if (aKind !== bKind) return aKind - bKind;
    if (a.word.length !== b.word.length) return a.word.length - b.word.length;
    return a.word.localeCompare(b.word);
  });
  
  return {
    prefix: prefix.word,
    startCol: prefix.startCol,
    endCol: prefix.endCol,
    items: results.slice(0, MAX_COMPLETIONS),
  };
}