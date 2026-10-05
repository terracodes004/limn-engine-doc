import { renderMarkdown, wrapMarkdownDocument } from "./markdown.js";

const out = document.getElementById("out");
let passed = 0;
let failed = 0;

function log(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  out.appendChild(div);
}

function group(name) {
  log(`<span class="group">── ${name} ──</span>`);
}

function check(name, fn) {
  try {
    fn();
    passed++;
    log(`<span class="pass">  ✓ ${name}</span>`);
  } catch (e) {
    failed++;
    log(`<span class="fail">  ✗ ${name}</span>\n    ${e.message}`);
  }
}

function contains(haystack, needle) {
  if (haystack.indexOf(needle) === -1) {
    throw new Error("missing: " + needle + " in " + haystack.slice(0, 200));
  }
}

function eq(a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`expected ${sb}, got ${sa}`);
}

group("headings");

check("h1", () => {
  contains(renderMarkdown("# Hello"), "<h1>Hello</h1>");
});

check("h3", () => {
  contains(renderMarkdown("### Sub"), "<h3>Sub</h3>");
});

check("h6", () => {
  contains(renderMarkdown("###### Six"), "<h6>Six</h6>");
});

group("paragraphs");

check("simple paragraph", () => {
  contains(renderMarkdown("Hello world"), "<p>Hello world</p>");
});

check("multi-line paragraph merges", () => {
  contains(renderMarkdown("Line one\nLine two"), "<p>Line one Line two</p>");
});

group("emphasis");

check("bold with **", () => {
  contains(renderMarkdown("**bold**"), "<strong>bold</strong>");
});

check("italic with *", () => {
  contains(renderMarkdown("*italic*"), "<em>italic</em>");
});

check("strikethrough", () => {
  contains(renderMarkdown("~~gone~~"), "<del>gone</del>");
});

group("code");

check("inline code", () => {
  contains(renderMarkdown("Use `foo()`"), "<code>foo()</code>");
});

check("code block", () => {
  const html = renderMarkdown("```\nconst x = 1;\n```");
  contains(html, "<pre><code>");
  contains(html, "const x = 1;");
});

check("code block with language", () => {
  const html = renderMarkdown("```js\nconst x = 1;\n```");
  contains(html, 'class="language-js"');
});

group("lists");

check("unordered list", () => {
  const html = renderMarkdown("- a\n- b\n- c");
  contains(html, "<ul>");
  contains(html, "<li>a</li>");
  contains(html, "<li>b</li>");
  contains(html, "<li>c</li>");
});

check("ordered list", () => {
  const html = renderMarkdown("1. one\n2. two");
  contains(html, "<ol>");
  contains(html, "<li>one</li>");
  contains(html, "<li>two</li>");
});

group("links and images");

check("link", () => {
  contains(renderMarkdown("[Google](https://google.com)"),
    '<a href="https://google.com">Google</a>');
});

check("image", () => {
  contains(renderMarkdown("![alt](img.png)"),
    '<img alt="alt" src="img.png">');
});

group("blockquote and hr");

check("blockquote", () => {
  contains(renderMarkdown("> quoted"), "<blockquote>quoted</blockquote>");
});

check("horizontal rule", () => {
  contains(renderMarkdown("---"), "<hr>");
});

group("escaping");

check("escapes script tags", () => {
  const html = renderMarkdown("<script>alert(1)</script>");
  if (html.indexOf("<script>") !== -1) throw new Error("not escaped");
  contains(html, "&lt;script&gt;");
});

group("wrapMarkdownDocument");

check("produces full HTML doc", () => {
  const html = wrapMarkdownDocument("<h1>Hi</h1>", "Test");
  contains(html, "<!DOCTYPE html>");
  contains(html, "<h1>Hi</h1>");
  contains(html, "<title>Test</title>");
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
  `${passed} passed, ${failed} failed</span>`
);