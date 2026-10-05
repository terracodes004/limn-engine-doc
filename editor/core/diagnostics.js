import * as acorn from "./acorn.js";

export function analyze(buffer, languageName) {
  const results = [];
  const lineCount = buffer.lineCount();

  if (languageName === "javascript") {
    checkJavaScript(buffer, results);
    checkQuotes(buffer, lineCount, results);
    checkBlockComments(buffer, lineCount, results);
    checkTemplateLiterals(buffer, lineCount, results);
  } else if (languageName === "json") {
    checkJson(buffer, results);
  } else if (languageName === "html") {
    checkHtmlTags(buffer, lineCount, results);
  } else if (languageName === "css") {
    checkCssBraces(buffer, lineCount, results);
  }

  results.sort((a, b) => a.line - b.line || a.col - b.col);
  return results;
}

function push(results, line, col, severity, message) {
  results.push({ line, col, severity, message });
}

function checkJavaScript(buffer, results) {
  const code = buffer.getText();
  try {
    acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowSuperOutsideMethod: true,
      locations: true,
    });
  } catch (e) {
    if (e && e.loc && typeof e.loc.line === "number") {
      const line = e.loc.line - 1;
      const col = e.loc.column;
      let msg = e.message.replace(/\s*\(\d+:\d+\)\s*$/, "");
      push(results, line, col, "error", msg);
    }
  }
}

function checkJson(buffer, results) {
  const code = buffer.getText();
  if (code.trim() === "") return;
  try {
    JSON.parse(code);
  } catch (e) {
    let line = 0;
    let col = 0;
    const m = /position\s+(\d+)/i.exec(e.message);
    if (m) {
      const offset = parseInt(m[1], 10);
      const info = offsetToLineCol(code, offset);
      line = info.line;
      col = info.col;
    }
    let msg = e.message.replace(/\s*in JSON at position \d+.*$/, "");
    msg = msg.replace(/^JSON\.parse:\s*/, "");
    push(results, line, col, "error", msg);
  }
}

function offsetToLineCol(text, offset) {
  let line = 0;
  let col = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") { line++; col = 0; }
    else col++;
  }
  return { line, col };
}

function checkQuotes(buffer, lineCount, results) {
  for (let line = 0; line < lineCount; line++) {
    const text = buffer.getLine(line);
    let inString = null;
    let startCol = 0;
    let inLineComment = false;

    for (let col = 0; col < text.length; col++) {
      const c = text[col];
      const next = text[col + 1];

      if (inLineComment) break;
      if (inString) {
        if (c === "\\") { col++; continue; }
        if (c === inString) { inString = null; continue; }
        continue;
      }
      if (c === "/" && next === "/") { inLineComment = true; break; }
      if (c === '"' || c === "'") {
        inString = c;
        startCol = col;
      }
    }

    if (inString) {
      const trimmed = text.replace(/\s+$/, "");
      if (!trimmed.endsWith("\\")) {
        push(results, line, startCol, "warning", "Unterminated string");
      }
    }
  }
}

function checkBlockComments(buffer, lineCount, results) {
  let open = false;
  let openLine = 0;
  let openCol = 0;
  for (let line = 0; line < lineCount; line++) {
    const text = buffer.getLine(line);
    let col = 0;
    while (col < text.length) {
      if (!open) {
        const idx = text.indexOf("/*", col);
        if (idx === -1) break;
        open = true;
        openLine = line;
        openCol = idx;
        col = idx + 2;
      } else {
        const idx = text.indexOf("*/", col);
        if (idx === -1) break;
        open = false;
        col = idx + 2;
      }
    }
  }
  if (open) {
    push(results, openLine, openCol, "error", "Unclosed block comment");
  }
}

function checkTemplateLiterals(buffer, lineCount, results) {
  let open = false;
  let openLine = 0;
  let openCol = 0;
  for (let line = 0; line < lineCount; line++) {
    const text = buffer.getLine(line);
    for (let col = 0; col < text.length; col++) {
      const c = text[col];
      if (c === "\\") { col++; continue; }
      if (c === "`") {
        if (open) { open = false; }
        else { open = true; openLine = line; openCol = col; }
      }
    }
  }
  if (open) {
    push(results, openLine, openCol, "error", "Unclosed template literal");
  }
}

function checkCssBraces(buffer, lineCount, results) {
  let depth = 0;
  let openLine = 0;
  let openCol = 0;
  let inComment = false;
  let inString = null;

  for (let line = 0; line < lineCount; line++) {
    const text = buffer.getLine(line);
    for (let col = 0; col < text.length; col++) {
      const c = text[col];
      const next = text[col + 1];

      if (inComment) {
        if (c === "*" && next === "/") { inComment = false; col++; }
        continue;
      }
      if (inString) {
        if (c === "\\") { col++; continue; }
        if (c === inString) inString = null;
        continue;
      }
      if (c === "/" && next === "*") { inComment = true; col++; continue; }
      if (c === '"' || c === "'") { inString = c; continue; }
      if (c === "{") {
        if (depth === 0) { openLine = line; openCol = col; }
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth < 0) {
          push(results, line, col, "error", "Unexpected '}'");
          depth = 0;
        }
      }
    }
  }

  if (depth > 0) {
    push(results, openLine, openCol, "error", "Unclosed '{'");
  }
}

function checkHtmlTags(buffer, lineCount, results) {
  const voidTags = new Set([
    "area","base","br","col","embed","hr","img","input",
    "link","meta","param","source","track","wbr"
  ]);
  const stack = [];

  for (let line = 0; line < lineCount; line++) {
    const text = buffer.getLine(line);
    let col = 0;
    while (col < text.length) {
      const lt = text.indexOf("<", col);
      if (lt === -1) break;
      if (text[lt + 1] === "!") { col = lt + 2; continue; }
      if (text.slice(lt, lt + 4) === "<!--") {
        const end = text.indexOf("-->", lt + 4);
        col = end === -1 ? text.length : end + 3;
        continue;
      }
      const gt = text.indexOf(">", lt);
      if (gt === -1) break;
      const inner = text.slice(lt + 1, gt).trim();
      if (inner.endsWith("/")) { col = gt + 1; continue; }
      const m = inner.match(/^(\/?)([a-zA-Z][a-zA-Z0-9-]*)/);
      if (!m) { col = gt + 1; continue; }
      const closing = m[1] === "/";
      const name = m[2].toLowerCase();
      if (closing) {
        if (stack.length === 0) {
          push(results, line, lt, "error", "Unexpected closing tag </" + name + ">");
        } else {
          const top = stack[stack.length - 1];
          if (top.name === name) {
            stack.pop();
          } else {
            push(results, line, lt, "error", "Mismatched </" + name + "> — expected </" + top.name + ">");
            stack.pop();
          }
        }
      } else if (!voidTags.has(name)) {
        stack.push({ name, line, col: lt });
      }
      col = gt + 1;
    }
  }

  for (const item of stack) {
    push(results, item.line, item.col, "error", "Unclosed <" + item.name + ">");
  }
}