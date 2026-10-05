export const HTML_TAGS = [
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
];

export const HTML_VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

export function isVoidTag(name) {
  return HTML_VOID_TAGS.has(name);
}