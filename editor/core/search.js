export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRegex(query, options) {
  options = options || {};
  if (!query) return null;
  let pattern = options.regex ? query : escapeRegex(query);
  if (options.wholeWord) pattern = "\\b" + pattern + "\\b";
  const flags = "g" + (options.caseSensitive ? "" : "i");
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    return null;
  }
}

export function findAll(buffer, query, options) {
  options = options || {};
  if (!query) return [];
  
  const re = buildRegex(query, options);
  if (!re) return [];
  
  const results = [];
  const lineCount = buffer.lineCount();
  
  for (let i = 0; i < lineCount; i++) {
    const text = buffer.getLine(i);
    if (!text) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      results.push({
        line: i,
        col: m.index,
        length: m[0].length,
        text: m[0],
      });
      if (m.index === re.lastIndex) re.lastIndex++;
      if (results.length > 10000) return results;
    }
  }
  
  return results;
}

export function findAt(buffer, query, options, fromLine, fromCol, direction) {
  options = options || {};
  const matches = findAll(buffer, query, options);
  if (matches.length === 0) return null;
  
  if (direction === "prev") {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (m.line < fromLine || (m.line === fromLine && m.col < fromCol)) {
        return { match: m, index: i, total: matches.length };
      }
    }
    return { match: matches[matches.length - 1], index: matches.length - 1, total: matches.length };
  }
  
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.line > fromLine || (m.line === fromLine && m.col >= fromCol)) {
      return { match: m, index: i, total: matches.length };
    }
  }
  return { match: matches[0], index: 0, total: matches.length };
}

export function replaceOne(buffer, match, replacement) {
  if (!match) return false;
  buffer.remove(match.line, match.col, match.line, match.col + match.length);
  if (replacement) {
    buffer.insert(match.line, match.col, replacement);
  }
  return true;
}

export function replaceAllInLine(text, query, options, replacement) {
  const re = buildRegex(query, options);
  if (!re) return text;
  re.lastIndex = 0;
  return text.replace(re, replacement);
}