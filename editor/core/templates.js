const JS_STARTER = [
  "// Limn game",
  "// Runs inside the preview iframe.",
  "",
  "const display = new Display();",
  "display.perform();",
  "display.start(800, 600);",
  "display.backgroundColor(\"#0a0a0a\");",
  "",
  "const player = new Component(36, 36, \"#6ea8fe\", 400, 200, \"rect\");",
  "display.add(player);",
  "",
  "const SPEED = 220;",
  "",
  "function update(dt) {",
  "  player.speedX = 0;",
  "  player.speedY = 0;",
  "  if (display.keys[87]) player.speedY = -SPEED * dt;",
  "  if (display.keys[83]) player.speedY =  SPEED * dt;",
  "  if (display.keys[65]) player.speedX = -SPEED * dt;",
  "  if (display.keys[68]) player.speedX =  SPEED * dt;",
  "",
  "  display.camera.follow(player);",
  "}",
].join("\n");

const HTML_STARTER = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<head>",
  "  <meta charset=\"utf-8\">",
  "  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
  "  <title>Limn Game</title>",
  "  <style>",
  "    html, body { margin: 0; padding: 0; background: #0a0a0a; overflow: hidden; height: 100%; }",
  "    canvas { display: block; margin: 0 auto; }",
  "  </style>",
  "  <script src=\"{{ENGINE_URL}}\"></script>",
  "</head>",
  "<body>",
  "<script>",
  "  const display = new Display();",
  "  display.perform();",
  "  display.start(800, 600);",
  "  display.backgroundColor(\"#0a0a0a\");",
  "",
  "  const player = new Component(36, 36, \"#6ea8fe\", 400, 200, \"rect\");",
  "  display.add(player);",
  "",
  "  const SPEED = 220;",
  "",
  "  function update(dt) {",
  "    player.speedX = 0;",
  "    player.speedY = 0;",
  "    if (display.keys[87]) player.speedY = -SPEED * dt;",
  "    if (display.keys[83]) player.speedY =  SPEED * dt;",
  "    if (display.keys[65]) player.speedX = -SPEED * dt;",
  "    if (display.keys[68]) player.speedX =  SPEED * dt;",
  "",
  "    display.camera.follow(player);",
  "  }",
  "</script>",
  "</body>",
  "</html>",
].join("\n");

const CSS_STARTER = [
  "/* Stylesheet */",
  "",
  "body {",
  "  background: #0a0a0a;",
  "  color: #e6edf3;",
  "  font-family: system-ui, sans-serif;",
  "}",
].join("\n");

const JSON_STARTER = [
  "{",
  "  \"name\": \"untitled\",",
  "  \"version\": 1,",
  "  \"items\": []",
  "}",
].join("\n");

const MD_STARTER = [
  "# Title",
  "",
  "Write something here.",
  "",
  "## Section",
  "",
  "- Item one",
  "- Item two",
  "",
  "```js",
  "const x = 1;",
  "```",
].join("\n");

const TXT_STARTER = "";

export const STARTERS = {
  javascript: JS_STARTER,
  html: HTML_STARTER,
  css: CSS_STARTER,
  json: JSON_STARTER,
  markdown: MD_STARTER,
  plaintext: TXT_STARTER,
};

export function starterForFilename(name) {
  const ext = extensionOf(name);
  return starterForExtension(ext);
}

export function starterForExtension(ext) {
  const key = String(ext || "").toLowerCase();
  if (key === "js" || key === "mjs" || key === "cjs" || key === "jsx") return STARTERS.javascript;
  if (key === "html" || key === "htm") return STARTERS.html;
  if (key === "css") return STARTERS.css;
  if (key === "json") return STARTERS.json;
  if (key === "md" || key === "markdown") return STARTERS.markdown;
  return STARTERS.plaintext;
}

export function extensionOf(name) {
  if (!name) return "";
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1);
}

export function uniqueName(docs, ext) {
  const e = ext || "js";
  const existing = new Set(docs.map((d) => d.name));
  let n = 1;
  let name = "untitled-" + n + "." + e;
  while (existing.has(name)) {
    n++;
    name = "untitled-" + n + "." + e;
  }
  return name;
}

export function resolveEngineUrl(template, engineUrl) {
  if (!template) return template;
  if (!engineUrl) return template;
  return template.replace(/\{\{ENGINE_URL\}\}/g, engineUrl);
}