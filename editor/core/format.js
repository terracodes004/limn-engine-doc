export function formatBuffer(buffer, tabSize, languageName) {
  const lines = [];
  const n = buffer.lineCount();
  for (let i = 0; i < n; i++) lines.push(buffer.getLine(i));

  if (languageName === "html") return formatHtml(lines, tabSize);
  if (languageName === "css") return formatCss(lines, tabSize);
  if (languageName === "json") return formatJson(lines, tabSize);
  return formatJsLike(lines, tabSize);
}

function indent(str, n, tabSize) {
  return " ".repeat(n * tabSize) + str;
}

function formatJsLike(lines, tabSize) {
  const out = [];
  let depth = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.replace(/^\s+/, "");
    const trimmedEnd = trimmed.replace(/\s+$/, "");

    if (trimmedEnd === "") {
      out.push("");
      continue;
    }

    let openAfter = 0;
    let closeBefore = 0;
    let inString = null;
    let inLineComment = false;
    let j = 0;
    const len = trimmedEnd.length;

    if (inBlockComment) {
      const endIdx = trimmedEnd.indexOf("*/");
      if (endIdx === -1) {
        out.push(indent(trimmedEnd, depth, tabSize));
        continue;
      }
      inBlockComment = false;
      j = endIdx + 2;
    }

    while (j < len) {
      const c = trimmedEnd[j];
      const next = trimmedEnd[j + 1];

      if (inString) {
        if (c === "\\") { j += 2; continue; }
        if (c === inString) { inString = null; j++; continue; }
        j++;
        continue;
      }

      if (inLineComment) break;

      if (c === "/" && next === "/") { inLineComment = true; break; }
      if (c === "/" && next === "*") {
        const endIdx = trimmedEnd.indexOf("*/", j + 2);
        if (endIdx === -1) { inBlockComment = true; break; }
        j = endIdx + 2;
        continue;
      }

      if (c === '"' || c === "'" || c === "`") { inString = c; j++; continue; }

      if (c === "{" || c === "[" || c === "(") openAfter++;
      else if (c === "}" || c === "]" || c === ")") {
        if (openAfter === 0) closeBefore++;
        else openAfter--;
      }
      j++;
    }

    if (trimmedEnd.startsWith("}") || trimmedEnd.startsWith("]") || trimmedEnd.startsWith(")")) {
      if (closeBefore === 0 && depth > 0) closeBefore = 1;
    }

    const lineDepth = Math.max(0, depth - closeBefore);
    out.push(indent(trimmedEnd, lineDepth, tabSize));

    depth += openAfter - closeBefore;
    if (depth < 0) depth = 0;
  }

  return out.join("\n");
}

function formatJson(lines, tabSize) {
  const text = lines.join("\n");
  let i = 0;
  const n = text.length;
  let depth = 0;
  let out = "";
  let atLineStart = true;

  while (i < n) {
    const c = text[i];

    if (c === "\n") { out += "\n"; atLineStart = true; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }

    if (atLineStart) {
      out += " ".repeat(depth * tabSize);
      atLineStart = false;
    }

    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === '"') { j++; break; }
        j++;
      }
      out += text.slice(i, j);
      i = j;
      continue;
    }

    if (c === "{" || c === "[") {
      out += c;
      depth++;
      while (i + 1 < n && (text[i + 1] === " " || text[i + 1] === "\t")) i++;
      if (i + 1 < n && text[i + 1] !== "\n") out += "\n";
      atLineStart = true;
      i++;
      continue;
    }

    if (c === "}" || c === "]") {
      depth = Math.max(0, depth - 1);
      if (!atLineStart) {
        out += "\n" + " ".repeat(depth * tabSize);
      } else {
        out = out.replace(/\s+$/, "");
        out += " ".repeat(depth * tabSize);
      }
      atLineStart = false;
      out += c;
      i++;
      continue;
    }

    if (c === ",") {
      out += ",\n";
      atLineStart = true;
      i++;
      while (i < n && (text[i] === " " || text[i] === "\t")) i++;
      continue;
    }

    if (c === ":") {
      out += ": ";
      i++;
      while (i < n && (text[i] === " " || text[i] === "\t")) i++;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

function formatCss(lines, tabSize) {
  const text = lines.join("\n");
  let i = 0;
  const n = text.length;
  let depth = 0;
  let out = "";
  let atLineStart = true;

  while (i < n) {
    const c = text[i];

    if (c === "\n") { out += "\n"; atLineStart = true; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }

    if (atLineStart) {
      out += " ".repeat(depth * tabSize);
      atLineStart = false;
    }

    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) { out += text.slice(i); break; }
      out += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    if (c === "{" || c === "(") { out += c; depth++; i++; continue; }

    if (c === "}" || c === ")") {
      depth = Math.max(0, depth - 1);
      if (!atLineStart && c === "}") {
        out += "\n" + " ".repeat(depth * tabSize);
      }
      atLineStart = false;
      out += c;
      i++;
      continue;
    }

    if (c === ";") { out += ";\n"; atLineStart = true; i++; continue; }

    out += c;
    i++;
  }

  return out;
}

function formatHtml(lines, tabSize) {
  const out = [];
  let depth = 0;
  const voidTags = new Set([
    "area","base","br","col","embed","hr","img","input",
    "link","meta","param","source","track","wbr"
  ]);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) { out.push(""); continue; }

    const isClose = /^<\//.test(trimmed);
    const isOpen = /^<[a-zA-Z][^>]*>$/.test(trimmed) && !/\/>$/.test(trimmed);
    const tagMatch = trimmed.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : "";

    if (isClose) depth = Math.max(0, depth - 1);
    out.push(indent(trimmed, depth, tabSize));
    if (isOpen && !voidTags.has(tagName)) depth++;
  }

  return out.join("\n");
}