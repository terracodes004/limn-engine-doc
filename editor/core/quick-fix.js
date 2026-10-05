export function suggestFixes(buffer, diagnostic) {
  if (!diagnostic) return [];
  const msg = diagnostic.message || "";
  const line = diagnostic.line;
  const col = diagnostic.col;
  const lineText = buffer.getLine(line) || "";

  const fixes = [];
  let m;

  m = /^Unclosed '(.+)'$/.exec(msg);
  if (m) {
    const openChar = m[1];
    const closeChar = closingFor(openChar);
    if (closeChar) {
      fixes.push(makeFix("Insert '" + closeChar + "' at end of line", buffer, (buf) => {
        const len = buf.lineLength(line);
        buf.insert(line, len, closeChar);
        return { line: line, col: len + closeChar.length };
      }));
      fixes.push(makeFix("Insert '" + closeChar + "' at end of file", buffer, (buf) => {
        const lastLine = buf.lineCount() - 1;
        const lastLen = buf.lineLength(lastLine);
        buf.insert(lastLine, lastLen, closeChar);
        return { line: lastLine, col: lastLen + closeChar.length };
      }));
    }
  }

  m = /^Unexpected '(.+)'$/.exec(msg);
  if (m) {
    const ch = m[1];
    fixes.push(makeFix("Remove '" + ch + "'", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      if (col >= 0 && col < text.length && text[col] === ch) {
        buf.remove(line, col, line, col + 1);
        return { line: line, col: col };
      }
      const idx = text.indexOf(ch);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + 1);
        return { line: line, col: idx };
      }
      return { line: line, col: col };
    }));
  }

  m = /^Mismatched '(.+)' — expected '(.+)'$/.exec(msg);
  if (m) {
    const found = m[1];
    const expected = m[2];
    fixes.push(makeFix("Replace '" + found + "' with '" + expected + "'", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      if (col >= 0 && col < text.length && text[col] === found) {
        buf.remove(line, col, line, col + 1);
        buf.insert(line, col, expected);
        return { line: line, col: col + expected.length };
      }
      const idx = text.indexOf(found);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + 1);
        buf.insert(line, idx, expected);
        return { line: line, col: idx + expected.length };
      }
      return { line: line, col: col };
    }));
    fixes.push(makeFix("Remove '" + found + "'", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      if (col >= 0 && col < text.length && text[col] === found) {
        buf.remove(line, col, line, col + 1);
        return { line: line, col: col };
      }
      const idx = text.indexOf(found);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + 1);
        return { line: line, col: idx };
      }
      return { line: line, col: col };
    }));
  }

  if (msg === "Unterminated string" || msg === "Unterminated string constant") {
    const ch = lineText[col] || '"';
    const quote = (ch === "'" || ch === '"') ? ch : '"';
    fixes.push(makeFix("Close string with '" + quote + "'", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, quote);
      return { line: line, col: len + quote.length };
    }));
  }

  if (msg === "Unclosed block comment" || msg === "Unterminated comment") {
    fixes.push(makeFix("Insert '*/' at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, "*/");
      return { line: line, col: len + 2 };
    }));
  }

  if (msg === "Unclosed template literal" || msg === "Unterminated template") {
    fixes.push(makeFix("Insert '`' at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, "`");
      return { line: line, col: len + 1 };
    }));
  }

  m = /^Unexpected closing tag <\/(.+)>$/.exec(msg);
  if (m) {
    const tag = m[1];
    fixes.push(makeFix("Remove closing </" + tag + ">", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      const needle = "</" + tag + ">";
      const idx = text.indexOf(needle);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + needle.length);
        return { line: line, col: idx };
      }
      return { line: line, col: col };
    }));
  }

  m = /^Mismatched <\/(.+)> — expected <\/(.+)>$/.exec(msg);
  if (m) {
    const found = m[1];
    const expected = m[2];
    fixes.push(makeFix("Rename </" + found + "> to </" + expected + ">", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      const needle = "</" + found + ">";
      const idx = text.indexOf(needle);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + needle.length);
        buf.insert(line, idx, "</" + expected + ">");
        return { line: line, col: idx + expected.length + 3 };
      }
      return { line: line, col: col };
    }));
    fixes.push(makeFix("Remove </" + found + ">", buffer, (buf) => {
      const text = buf.getLine(line) || "";
      const needle = "</" + found + ">";
      const idx = text.indexOf(needle);
      if (idx !== -1) {
        buf.remove(line, idx, line, idx + needle.length);
        return { line: line, col: idx };
      }
      return { line: line, col: col };
    }));
  }

  m = /^Unclosed <(.+)>$/.exec(msg);
  if (m) {
    const tag = m[1];
    fixes.push(makeFix("Insert </" + tag + "> at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, "</" + tag + ">");
      return { line: line, col: len + tag.length + 3 };
    }));
    fixes.push(makeFix("Insert </" + tag + "> at end of file", buffer, (buf) => {
      const lastLine = buf.lineCount() - 1;
      const lastLen = buf.lineLength(lastLine);
      buf.insert(lastLine, lastLen, "</" + tag + ">");
      return { line: lastLine, col: lastLen + tag.length + 3 };
    }));
  }

  if (fixes.length === 0 && isVagueMessage(msg)) {
    return heuristicFixes(buffer, diagnostic);
  }

  return fixes;
}

function makeFix(label, buffer, applyFn) {
  const beforeText = buffer.getText();
  return {
    label: label,
    apply: applyFn,
    beforeText: beforeText,
  };
}

function closingFor(openChar) {
  if (openChar === "(") return ")";
  if (openChar === "[") return "]";
  if (openChar === "{") return "}";
  return null;
}

function isVagueMessage(msg) {
  if (!msg) return false;
  return (
    msg === "Unexpected token" ||
    msg === "Unexpected end of input" ||
    msg === "Invalid or unexpected token" ||
    msg === "Unexpected number" ||
    msg === "Unexpected string" ||
    msg === "Unexpected identifier" ||
    msg.indexOf("Unexpected token") === 0
  );
}

function heuristicFixes(buffer, diagnostic) {
  const fixes = [];
  const line = diagnostic.line;
  const lineCount = buffer.lineCount();
  if (line < 0 || line >= lineCount) return fixes;

  const text = buffer.getLine(line) || "";
  const stats = unbalancedInLine(text);

  if (stats.openBrace > 0) {
    const n = stats.openBrace;
    fixes.push(makeFix("Insert '" + "}".repeat(n) + "' at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      const insert = "}".repeat(n);
      buf.insert(line, len, insert);
      return { line: line, col: len + insert.length };
    }));
  }
  if (stats.openParen > 0) {
    const n = stats.openParen;
    fixes.push(makeFix("Insert '" + ")".repeat(n) + "' at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      const insert = ")".repeat(n);
      buf.insert(line, len, insert);
      return { line: line, col: len + insert.length };
    }));
  }
  if (stats.openBracket > 0) {
    const n = stats.openBracket;
    fixes.push(makeFix("Insert '" + "]".repeat(n) + "' at end of line", buffer, (buf) => {
      const len = buf.lineLength(line);
      const insert = "]".repeat(n);
      buf.insert(line, len, insert);
      return { line: line, col: len + insert.length };
    }));
  }

  const quoteInfo = unclosedQuoteInLine(text);
  if (quoteInfo) {
    fixes.push(makeFix("Close string with '" + quoteInfo + "'", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, quoteInfo);
      return { line: line, col: len + 1 };
    }));
  }

  const backtick = unclosedBacktickInLine(text);
  if (backtick) {
    fixes.push(makeFix("Close template with '`'", buffer, (buf) => {
      const len = buf.lineLength(line);
      buf.insert(line, len, "`");
      return { line: line, col: len + 1 };
    }));
  }

  fixes.push(makeFix("Delete this line", buffer, (buf) => {
    const nextLine = Math.min(line + 1, buf.lineCount());
    if (nextLine > line) {
      buf.remove(line, 0, nextLine, 0);
    } else {
      const len = buf.lineLength(line);
      if (len > 0) buf.remove(line, 0, line, len);
    }
    if (buf.lineCount() === 0) {
      buf.insert(0, 0, "");
    }
    const newLine = Math.min(line, buf.lineCount() - 1);
    return { line: newLine, col: 0 };
  }));

  return fixes;
}

function unbalancedInLine(text) {
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  let openBrace = 0;
  let openParen = 0;
  let openBracket = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inLineComment) break;
    if (inBlockComment) {
      if (c === "*" && next === "/") { inBlockComment = false; i++; }
      continue;
    }
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && next === "/") { inLineComment = true; break; }
    if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") openBrace++;
    else if (c === "}") openBrace = Math.max(0, openBrace - 1);
    else if (c === "(") openParen++;
    else if (c === ")") openParen = Math.max(0, openParen - 1);
    else if (c === "[") openBracket++;
    else if (c === "]") openBracket = Math.max(0, openBracket - 1);
  }

  return { openBrace, openParen, openBracket };
}

function unclosedQuoteInLine(text) {
  let inStr = null;
  let inLineComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLineComment) break;
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) { inStr = null; continue; }
      continue;
    }
    if (c === "/" && next === "/") { inLineComment = true; break; }
    if (c === '"' || c === "'") {
      inStr = c;
    }
  }
  if (inStr) {
    const trimmed = text.replace(/\s+$/, "");
    if (trimmed.endsWith("\\")) return null;
    return inStr;
  }
  return null;
}

function unclosedBacktickInLine(text) {
  let count = 0;
  let inStr = null;
  let inLineComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLineComment) break;
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) { inStr = null; continue; }
      continue;
    }
    if (c === "/" && next === "/") { inLineComment = true; break; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === "`") count++;
  }
  return count % 2 === 1;
}