const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const KNOWN_TAGS = new Set([
  "html", "head", "body", "title", "meta", "link", "script", "style",
  "base", "noscript",
  "div", "span", "p", "a", "img", "br", "hr",
  "header", "footer", "nav", "main", "section", "article", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "form", "input", "button", "select", "option", "optgroup", "textarea", "label", "fieldset", "legend", "datalist", "output", "progress", "meter",
  "figure", "figcaption", "picture", "source", "video", "audio", "track", "canvas", "svg", "math",
  "details", "summary", "dialog", "template", "slot",
  "blockquote", "pre", "code", "em", "strong", "b", "i", "u", "s", "small", "sub", "sup", "mark", "abbr", "cite", "q", "time", "var", "kbd", "samp", "dfn",
  "iframe", "embed", "object", "param", "map", "area",
  "del", "ins", "wbr",
]);

export function isEmmetVoidTag(name) {
  return VOID_TAGS.has(String(name || "").toLowerCase());
}

export function extractAbbreviation(text, col) {
  let start = col;
  while (start > 0) {
    const c = text[start - 1];
    if (/[A-Za-z0-9_$]/.test(c)) { start--; continue; }
    if (c === "." || c === "#" || c === ">" || c === "+" || c === "*" ||
        c === "[" || c === "]" || c === "{" || c === "}" || c === "-") {
      start--;
      continue;
    }
    break;
  }
  if (start === col) return null;

  let abbrStart = start;
  if (start > 0 && text[start - 1] === "<") {
    abbrStart = start - 1;
  }

  const rawAbbr = text.slice(start, col);
  if (!/^[A-Za-z.#\[{>+*]/.test(rawAbbr)) return null;
  if (!/[A-Za-z.#\[\]{}>+*]/.test(rawAbbr)) return null;

  if (abbrStart > 0) {
    const before = text[abbrStart - 1];
    if (before === "<" || before === "/" || before === ">" ||
        before === '"' || before === "'" || before === "=") {
      return null;
    }
    if (/[A-Za-z0-9_$.\-#\[\]{}>+*]/.test(before)) return null;
  }

  if (rawAbbr.indexOf("/") !== -1) return null;
  if (rawAbbr.indexOf("<") !== -1) return null;

  const closeBracket = rawAbbr.indexOf(">");
  if (closeBracket === -1 && rawAbbr.startsWith(">")) return null;

  return {
    text: rawAbbr,
    startCol: abbrStart,
    endCol: col,
  };
}

function parseAbbreviation(abbr) {
  const state = { s: abbr, i: 0 };
  const node = parseExpression(state);
  if (!node) return null;
  if (state.i < state.s.length) return null;
  return node;
}

function parseExpression(state) {
  const children = [parseSequence(state)];
  while (children[children.length - 1] === null && state.i < state.s.length) {
    children[children.length - 1] = parseSequence(state);
  }
  if (children[0] === null) return null;
  return children[0];
}

function parseSequence(state) {
  let node = parseTerm(state);
  if (!node) return null;
  while (state.s[state.i] === "+") {
    state.i++;
    const next = parseTerm(state);
    if (!next) return null;
    if (!node.siblings) node.siblings = [];
    node.siblings.push(next);
  }
  return node;
}

function parseTerm(state) {
  let node = parseElement(state);
  if (!node) return null;
  while (state.s[state.i] === ">") {
    state.i++;
    const child = parseElement(state);
    if (!child) return null;
    if (!node.children) node.children = [];
    node.children.push(child);
  }
  return node;
}

function parseElement(state) {
  const start = state.i;
  const s = state.s;

  let tagName = "";
  while (state.i < s.length && /[A-Za-z0-9-]/.test(s[state.i])) {
    tagName += s[state.i];
    state.i++;
  }

  const classes = [];
  const ids = [];
  const attrs = [];
  let text = null;
  let repeat = null;

  while (state.i < s.length) {
    const c = s[state.i];

    if (c === ".") {
      state.i++;
      let name = "";
      while (state.i < s.length && /[A-Za-z0-9_-]/.test(s[state.i])) {
        name += s[state.i];
        state.i++;
      }
      if (!name) return null;
      classes.push(name);
      continue;
    }

    if (c === "#") {
      state.i++;
      let name = "";
      while (state.i < s.length && /[A-Za-z0-9_-]/.test(s[state.i])) {
        name += s[state.i];
        state.i++;
      }
      if (!name) return null;
      ids.push(name);
      continue;
    }

    if (c === "[") {
      state.i++;
      let inner = "";
      while (state.i < s.length && s[state.i] !== "]") {
        inner += s[state.i];
        state.i++;
      }
      if (s[state.i] !== "]") return null;
      state.i++;
      const parts = inner.split(/\s+/).filter(Boolean);
      for (const p of parts) {
        const eq = p.indexOf("=");
        if (eq === -1) attrs.push({ name: p, value: null });
        else {
          let v = p.slice(eq + 1);
          if ((v.startsWith('"') && v.endsWith('"')) ||
              (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          attrs.push({ name: p.slice(0, eq), value: v });
        }
      }
      continue;
    }

    if (c === "{") {
      state.i++;
      let inner = "";
      while (state.i < s.length && s[state.i] !== "}") {
        inner += s[state.i];
        state.i++;
      }
      if (s[state.i] !== "}") return null;
      state.i++;
      text = inner;
      continue;
    }

    if (c === "*") {
      state.i++;
      let numStr = "";
      while (state.i < s.length && /[0-9]/.test(s[state.i])) {
        numStr += s[state.i];
        state.i++;
      }
      const n = parseInt(numStr, 10);
      if (isNaN(n) || n < 1) return null;
      repeat = n;
      continue;
    }

    break;
  }

  if (state.i === start) return null;

  if (!tagName) {
    tagName = classes.length === 0 && ids.length === 0 ? null : "div";
  }
  if (!tagName) return null;

  return {
    tagName,
    classes,
    ids,
    attrs,
    text,
    repeat,
    children: null,
    siblings: null,
  };
}

function renderNode(node, depth, options, out, cursorRef) {
  const indentUnit = options.indentUnit || "  ";
  const baseIndent = options.baseIndent || "";
  const count = node.repeat || 1;

  for (let r = 0; r < count; r++) {
    renderSingle(node, depth, indentUnit, baseIndent, options, out, cursorRef);
  }
}

function renderSingle(node, depth, indentUnit, baseIndent, options, out, cursorRef) {
  const indent = baseIndent + indentUnit.repeat(depth);
  const tag = node.tagName;
  const isVoid = VOID_TAGS.has(tag.toLowerCase());

  let open = "<" + tag;

  if (node.ids.length > 0) {
    open += ' id="' + node.ids[0] + '"';
  }

  if (node.classes.length > 0) {
    open += ' class="' + node.classes.join(" ") + '"';
  }

  for (const a of node.attrs) {
    if (a.value === null) open += " " + a.name;
    else open += " " + a.name + '="' + a.value + '"';
  }

  if (isVoid) {
    open += ">";
    out.push(indent + open);
    return;
  }

  const hasChildren = node.children && node.children.length > 0;
  const hasSiblings = node.siblings && node.siblings.length > 0;

  if (!hasChildren && node.text === null) {
    open += ">";
    if (cursorRef && cursorRef.set === false) {
      cursorRef.set = true;
      cursorRef.line = out.length;
      cursorRef.col = indent.length + open.length;
    }
    out.push(indent + open + "</" + tag + ">");
    if (hasSiblings) {
      for (const sib of node.siblings) {
        renderNode(sib, depth, { indentUnit, baseIndent }, out, cursorRef);
      }
    }
    return;
  }

  if (node.text !== null && !hasChildren) {
    open += ">";
    const close = "</" + tag + ">";
    if (cursorRef && cursorRef.set === false) {
      cursorRef.set = true;
      cursorRef.line = out.length;
      cursorRef.col = indent.length + open.length + node.text.length;
    }
    out.push(indent + open + node.text + close);
    if (hasSiblings) {
      for (const sib of node.siblings) {
        renderNode(sib, depth, { indentUnit, baseIndent }, out, cursorRef);
      }
    }
    return;
  }

  open += ">";
  out.push(indent + open);

  if (node.text !== null) {
    const textIndent = baseIndent + indentUnit.repeat(depth + 1);
    out.push(textIndent + node.text);
  }

  if (hasChildren) {
    for (const child of node.children) {
      renderNode(child, depth + 1, { indentUnit, baseIndent }, out, cursorRef);
    }
  } else if (cursorRef && cursorRef.set === false) {
    cursorRef.set = true;
    cursorRef.line = out.length;
    cursorRef.col = (baseIndent + indentUnit.repeat(depth + 1)).length;
  }

  out.push(indent + "</" + tag + ">");

  if (hasSiblings) {
    for (const sib of node.siblings) {
      renderNode(sib, depth, { indentUnit, baseIndent }, out, cursorRef);
    }
  }
}

export function expandAbbreviation(abbr, options) {
  options = options || {};
  const ast = parseAbbreviation(abbr);
  if (!ast) return null;

  const out = [];
  const cursorRef = { set: false, line: 0, col: 0 };
  renderNode(ast, 0, options, out, cursorRef);

  if (!cursorRef.set) {
    const last = out.length - 1;
    cursorRef.line = last;
    cursorRef.col = out[last].length;
  }

  return {
    text: out.join("\n"),
    cursorLine: cursorRef.line,
    cursorCol: cursorRef.col,
  };
}