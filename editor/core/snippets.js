export const SNIPPETS = {
  javascript: {
    for: { prefix: "for", body: "for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n    $0\n}" },
    foreach: { prefix: "foreach", body: "${1:array}.forEach((${2:item}) => {\n    $0\n})" },
    fn: { prefix: "fn", body: "function ${1:name}(${2}) {\n    $0\n}" },
    afn: { prefix: "afn", body: "async function ${1:name}(${2}) {\n    $0\n}" },
    arrow: { prefix: "arrow", body: "(${1}) => {\n    $0\n}" },
    if: { prefix: "if", body: "if (${1:condition}) {\n    $0\n}" },
    ife: { prefix: "ife", body: "if (${1:condition}) {\n    $0\n} else {\n    \n}" },
    try: { prefix: "try", body: "try {\n    $0\n} catch (${1:err}) {\n    console.error(${1:err})\n}" },
    class: { prefix: "class", body: "class ${1:Name} {\n    constructor(${2}) {\n        $0\n    }\n}" },
    log: { prefix: "log", body: "console.log(${1})" },
    clg: { prefix: "clg", body: "console.log(${1})" },
    imp: { prefix: "imp", body: "import ${1:name} from \"${2:module}\"" },
    exp: { prefix: "exp", body: "export default ${1:name}" },
    map: { prefix: "map", body: "${1:array}.map((${2:item}) => ${0:item})" },
    filter: { prefix: "filter", body: "${1:array}.filter((${2:item}) => ${0:condition})" },
    reduce: { prefix: "reduce", body: "${1:array}.reduce((${2:acc}, ${3:item}) => {\n    $0\n}, ${4:initial})" },
    settimeout: { prefix: "settimeout", body: "setTimeout(() => {\n    $0\n}, ${1:1000})" },
    setinterval: { prefix: "setinterval", body: "setInterval(() => {\n    $0\n}, ${1:1000})" },
    promise: { prefix: "promise", body: "new Promise((resolve, reject) => {\n    $0\n})" },
    switch: { prefix: "switch", body: "switch (${1:value}) {\n    case ${2:case1}:\n        $0\n        break\n    default:\n        break\n}" },
    while: { prefix: "while", body: "while (${1:condition}) {\n    $0\n}" },
    disp: { prefix: "disp", body: "const display = new Display()\ndisplay.perform()\ndisplay.start(${1:800}, ${2:600})\ndisplay.backgroundColor(\"${3:#0a0a0a}\")" },
    comp: { prefix: "comp", body: "const ${1:player} = new Component(${2:36}, ${3:36}, \"${4:#6ea8fe}\", ${5:400}, ${6:200}, \"${7:rect}\")\ndisplay.add(${1:player})" },
    upd: { prefix: "upd", body: "function update(dt) {\n    $0\n}" },
  },
  
  html: {
    html5: { prefix: "html5", body: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"utf-8\">\n    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n    <title>${1:Document}</title>\n</head>\n<body>\n    $0\n</body>\n</html>" },
    divc: { prefix: "divc", body: "<div class=\"${1:name}\">$0</div>" },
    divi: { prefix: "divi", body: "<div id=\"${1:name}\">$0</div>" },
    a: { prefix: "a", body: "<a href=\"${1:url}\">${2:text}</a>" },
    img: { prefix: "img", body: "<img src=\"${1:src}\" alt=\"${2:alt}\">" },
    input: { prefix: "input", body: "<input type=\"${1:text}\" name=\"${2:name}\">" },
    link: { prefix: "link", body: "<link rel=\"stylesheet\" href=\"${1:style.css}\">" },
    script: { prefix: "script", body: "<script src=\"${1:app.js}\"></script>" },
    style: { prefix: "style", body: "<style>\n    $0\n</style>" },
    ul: { prefix: "ul", body: "<ul>\n    <li>$0</li>\n</ul>" },
  },
  
  css: {
    m0: { prefix: "m0", body: "margin: 0" },
    p0: { prefix: "p0", body: "padding: 0" },
    ff: { prefix: "ff", body: "font-family: ${1:sans-serif}" },
    bg: { prefix: "bg", body: "background: ${1:#000}" },
    flex: { prefix: "flex", body: "display: flex\n align-items: ${1:center}\n justify-content: ${2:center}" },
    grid: { prefix: "grid", body: "display: grid\n grid-template-columns: ${1:repeat(3, 1fr)}\n gap: ${2:16px}" },
    trans: { prefix: "trans", body: "transition: ${1:all} ${2:0.2s} ${3:ease}" },
    anim: { prefix: "anim", body: "animation: ${1:name} ${2:1s} ${3:ease} ${4:infinite}" },
    media: { prefix: "media", body: "@media (${1:max-width}: ${2:768px}) {\n    $0\n}" },
    kf: { prefix: "kf", body: "@keyframes ${1:name} {\n    from {\n        $0\n    }\n    to {\n        \n    }\n}" },
  },
  
  json: {
    obj: { prefix: "obj", body: "{\n    \"${1:key}\": \"${2:value}\"\n}" },
    arr: { prefix: "arr", body: "[\n    $0\n]" },
  },
  
  markdown: {
    link: { prefix: "link", body: "[${1:text}](${2:url})" },
    img: { prefix: "img", body: "![${1:alt}](${2:url})" },
    code: { prefix: "code", body: "```${1:js}\n$0\n```" },
    h1: { prefix: "h1", body: "# ${1:Heading}\n$0" },
    h2: { prefix: "h2", body: "## ${1:Heading}\n$0" },
    h3: { prefix: "h3", body: "### ${1:Heading}\n$0" },
    ul: { prefix: "ul", body: "- ${1:item}\n- ${2:item}\n- $0" },
    ol: { prefix: "ol", body: "1. ${1:item}\n2. ${2:item}\n3. $0" },
    todo: { prefix: "todo", body: "- [ ] ${1:task}\n- [ ] $0" },
    quote: { prefix: "quote", body: "> ${1:quote}\n$0" },
    table: { prefix: "table", body: "| ${1:Header} | ${2:Header} |\n| --- | --- |\n| $0 | |" },
  },
};

export function snippetsForLanguage(langName) {
  if (!langName) return {};
  return SNIPPETS[langName] || {};
}

export function findSnippet(buffer, line, col, langName) {
  const table = snippetsForLanguage(langName);
  if (!table) return null;
  
  const text = buffer.getLine(line);
  if (col < 1) return null;
  
  let start = col;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
  if (start === col) return null;
  
  const word = text.slice(start, col);
  const snippet = table[word];
  if (!snippet) return null;
  
  return {
    prefix: word,
    body: snippet.body,
    startCol: start,
    endCol: col,
    line,
  };
}

function parseBody(body) {
  const stops = [];
  let template = "";
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === "$" && i + 1 < body.length) {
      const next = body[i + 1];
      if (next === "{") {
        const end = body.indexOf("}", i + 2);
        if (end !== -1) {
          const inner = body.slice(i + 2, end);
          const colon = inner.indexOf(":");
          let numStr = inner;
          let def = "";
          if (colon !== -1) {
            numStr = inner.slice(0, colon);
            def = inner.slice(colon + 1);
          }
          const num = parseInt(numStr, 10);
          if (!isNaN(num)) {
            const marker = "\u0000" + stops.length + "\u0000";
            stops.push({ index: num, default: def, marker });
            template += marker;
            i = end + 1;
            continue;
          }
        }
      } else if (next >= "0" && next <= "9") {
        let j = i + 1;
        while (j < body.length && body[j] >= "0" && body[j] <= "9") j++;
        const num = parseInt(body.slice(i + 1, j), 10);
        const marker = "\u0000" + stops.length + "\u0000";
        stops.push({ index: num, default: "", marker });
        template += marker;
        i = j;
        continue;
      }
    }
    template += c;
    i++;
  }
  return { template, stops };
}

export function prepareSnippet(snippet) {
  const parsed = parseBody(snippet.body);
  const template = parsed.template;
  const stops = parsed.stops;
  
  const byIndex = new Map();
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (!byIndex.has(s.index)) byIndex.set(s.index, []);
    byIndex.get(s.index).push(s);
  }
  
  const ordered = Array.from(byIndex.keys()).sort(function(a, b) {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });
  
  const parts = template.split(/(\u0000\d+\u0000)/);
  const expanded = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = part.match(/^\u0000(\d+)\u0000$/);
    if (!m) {
      expanded.push({ text: part, stopMarker: null });
    } else {
      const stop = stops[parseInt(m[1], 10)];
      expanded.push({ text: stop.default, stopMarker: stop });
    }
  }
  
  let text = "";
  for (let i = 0; i < expanded.length; i++) text += expanded[i].text;
  
  const offsets = [];
  let cursor = 0;
  for (let i = 0; i < expanded.length; i++) {
    const p = expanded[i];
    const start = cursor;
    cursor += p.text.length;
    if (p.stopMarker) {
      offsets.push({
        index: p.stopMarker.index,
        start: start,
        end: cursor,
      });
    }
  }
  
  const stopsByIndex = new Map();
  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[i];
    if (!stopsByIndex.has(o.index)) stopsByIndex.set(o.index, []);
    stopsByIndex.get(o.index).push(o);
  }
  
  const stopOrder = ordered.filter(function(n) { return n !== 0; });
  const hasFinal = ordered.indexOf(0) !== -1;
  
  return {
    text: text,
    stopOrder: stopOrder,
    stopsByIndex: stopsByIndex,
    hasFinal: hasFinal,
    finalOffset: (function() {
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i].index === 0) return offsets[i];
      }
      return null;
    })(),
  };
}