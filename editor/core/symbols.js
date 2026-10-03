export function extractSymbols(buffer) {
  const items = [];
  const lineCount = buffer.lineCount();
  
  for (let i = 0; i < lineCount; i++) {
    const text = buffer.getLine(i);
    if (!text) continue;
    
    const trimmed = text.replace(/^\s+/, "");
    if (!trimmed) continue;
    if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    
    let m;
    
    m = /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.exec(trimmed);
    if (m) {
      items.push({ name: m[1] + "()", kind: "function", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^class\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(trimmed);
    if (m) {
      items.push({ name: m[1], kind: "class", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][A-Za-z0-9_$]*\s*=>)/.exec(trimmed);
    if (m) {
      items.push({ name: m[1] + "()", kind: "function", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=/.exec(trimmed);
    if (m) {
      items.push({ name: m[1], kind: "constant", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{/.exec(trimmed);
    if (m) {
      items.push({ name: m[1] + "()", kind: "method", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)/.exec(trimmed);
    if (m) {
      items.push({ name: m[1] + "()", kind: "method", line: i, col: text.indexOf(m[1]) });
      continue;
    }
    
    m = /^([.#]?[A-Za-z_][A-Za-z0-9_-]*)\s*\{/.exec(trimmed);
    if (m && /[.#{]/.test(trimmed)) {
      items.push({ name: m[1], kind: "selector", line: i, col: 0 });
      continue;
    }
  }
  
  return items;
}

export function currentSymbolAt(symbols, line) {
  let current = null;
  for (const s of symbols) {
    if (s.line <= line) current = s;
    else break;
  }
  return current;
}