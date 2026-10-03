import { TOKEN, Highlighter, HighlightState, Token } from "./highlighter.js";
import { javascript, tokenizeLine } from "./lang-javascript.js";
import { TextBuffer } from "./buffer.js";

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

function eq(a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`expected ${sb}, got ${sa}`);
}

function assert(cond, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

function typesOf(tokens) {
  return tokens.map((t) => t.type);
}

function textsOf(tokens) {
  return tokens.map((t) => t.text);
}

function firstOfType(tokens, type) {
  return tokens.find((t) => t.type === type);
}

group("HighlightState");

check("new state is empty", () => {
  const s = new HighlightState();
  assert(!s.inBlockComment);
  assert(!s.inTemplateLiteral);
  eq(s.templateDepth, 0);
});

check("clone copies fields", () => {
  const s = new HighlightState();
  s.inBlockComment = true;
  s.templateDepth = 2;
  const c = s.clone();
  eq(c.inBlockComment, true);
  eq(c.templateDepth, 2);
  c.inBlockComment = false;
  eq(s.inBlockComment, true);
});

check("equals compares fields", () => {
  const a = new HighlightState();
  const b = new HighlightState();
  assert(a.equals(b));
  b.inBlockComment = true;
  assert(!a.equals(b));
});

group("tokenizeLine — keywords");

check("const is keyword", () => {
  const { tokens } = tokenizeLine("const x = 1;", new HighlightState());
  const kw = firstOfType(tokens, TOKEN.KEYWORD);
  assert(kw);
  eq(kw.text, "const");
});

check("let, var, function are keywords", () => {
  const { tokens } = tokenizeLine("let a; var b; function c() {}", new HighlightState());
  const kws = tokens.filter((t) => t.type === TOKEN.KEYWORD).map((t) => t.text);
  assert(kws.includes("let"));
  assert(kws.includes("var"));
  assert(kws.includes("function"));
});

group("tokenizeLine — literals");

check("true is boolean", () => {
  const { tokens } = tokenizeLine("true", new HighlightState());
  eq(tokens[0].type, TOKEN.BOOLEAN);
});

check("null and undefined are boolean tokens", () => {
  const { tokens } = tokenizeLine("null undefined", new HighlightState());
  const bs = tokens.filter((t) => t.type === TOKEN.BOOLEAN).map((t) => t.text);
  assert(bs.includes("null"));
  assert(bs.includes("undefined"));
});

group("tokenizeLine — numbers");

check("integer literal", () => {
  const { tokens } = tokenizeLine("42", new HighlightState());
  eq(tokens[0].type, TOKEN.NUMBER);
  eq(tokens[0].text, "42");
});

check("float literal", () => {
  const { tokens } = tokenizeLine("3.14", new HighlightState());
  eq(tokens[0].type, TOKEN.NUMBER);
  eq(tokens[0].text, "3.14");
});

check("hex literal", () => {
  const { tokens } = tokenizeLine("0xff", new HighlightState());
  eq(tokens[0].type, TOKEN.NUMBER);
  eq(tokens[0].text, "0xff");
});

check("exponent literal", () => {
  const { tokens } = tokenizeLine("1e10", new HighlightState());
  eq(tokens[0].type, TOKEN.NUMBER);
  eq(tokens[0].text, "1e10");
});

group("tokenizeLine — strings");

check("double-quoted string", () => {
  const { tokens } = tokenizeLine('"hello"', new HighlightState());
  eq(tokens[0].type, TOKEN.STRING);
  eq(tokens[0].text, '"hello"');
});

check("single-quoted string", () => {
  const { tokens } = tokenizeLine("'world'", new HighlightState());
  eq(tokens[0].type, TOKEN.STRING);
  eq(tokens[0].text, "'world'");
});

check("string with escaped quote", () => {
  const { tokens } = tokenizeLine('"a\\"b"', new HighlightState());
  eq(tokens[0].type, TOKEN.STRING);
  eq(tokens[0].text, '"a\\"b"');
});

check("template literal", () => {
  const { tokens } = tokenizeLine("`hi`", new HighlightState());
  eq(tokens[0].type, TOKEN.STRING);
  eq(tokens[0].text, "`hi`");
});

group("tokenizeLine — comments");

check("line comment", () => {
  const { tokens } = tokenizeLine("x = 1; // note", new HighlightState());
  const c = firstOfType(tokens, TOKEN.COMMENT);
  assert(c);
  eq(c.text, "// note");
});

check("block comment on one line", () => {
  const { tokens } = tokenizeLine("/* hi */ x", new HighlightState());
  const c = firstOfType(tokens, TOKEN.COMMENT);
  assert(c);
  eq(c.text, "/* hi */");
});

check("unterminated block comment sets state", () => {
  const { tokens, state } = tokenizeLine("/* start", new HighlightState());
  assert(state.inBlockComment);
  eq(tokens[0].type, TOKEN.COMMENT);
});

check("continuing block comment from state", () => {
  const s = new HighlightState();
  s.inBlockComment = true;
  const { tokens, state } = tokenizeLine("still comment */ x", s);
  eq(tokens[0].type, TOKEN.COMMENT);
  eq(tokens[0].text, "still comment */");
  assert(!state.inBlockComment);
});

group("tokenizeLine — identifiers and calls");

check("function call gets FUNCTION type", () => {
  const { tokens } = tokenizeLine("foo()", new HighlightState());
  const fn = firstOfType(tokens, TOKEN.FUNCTION);
  assert(fn);
  eq(fn.text, "foo");
});

check("property access gets PROPERTY type", () => {
  const { tokens } = tokenizeLine("a.b", new HighlightState());
  const p = firstOfType(tokens, TOKEN.PROPERTY);
  assert(p);
  eq(p.text, "b");
});

check("capitalized identifier gets TYPE type", () => {
  const { tokens } = tokenizeLine("Foo", new HighlightState());
  const t = firstOfType(tokens, TOKEN.TYPE);
  assert(t);
  eq(t.text, "Foo");
});

check("builtin Display gets TYPE", () => {
  const { tokens } = tokenizeLine("new Display()", new HighlightState());
  const t = tokens.find((t) => t.type === TOKEN.TYPE && t.text === "Display");
  assert(t);
});

group("tokenizeLine — operators and punctuation");

check("operators get OPERATOR type", () => {
  const { tokens } = tokenizeLine("a + b", new HighlightState());
  const op = firstOfType(tokens, TOKEN.OPERATOR);
  assert(op);
  eq(op.text, "+");
});

check("multiple operators merge", () => {
  const { tokens } = tokenizeLine("a === b", new HighlightState());
  const op = firstOfType(tokens, TOKEN.OPERATOR);
  assert(op);
  eq(op.text, "===");
});

check("punctuation gets PUNCTUATION type", () => {
  const { tokens } = tokenizeLine("(a)", new HighlightState());
  const ps = tokens.filter((t) => t.type === TOKEN.PUNCTUATION).map((t) => t.text);
  assert(ps.includes("("));
  assert(ps.includes(")"));
});

group("Highlighter with buffer");

check("tokenize through Highlighter", () => {
  const h = new Highlighter(javascript);
  const b = new TextBuffer("const x = 1;");
  const entry = h.getLineTokens(0, b.getLine(0));
  const kw = entry.tokens.find((t) => t.type === TOKEN.KEYWORD);
  assert(kw);
  eq(kw.text, "const");
});

check("state carries from block comment", () => {
  const h = new Highlighter(javascript);
  const b = new TextBuffer("/* start\nmiddle\nend */ x");
  const e0 = h.getLineTokens(0, b.getLine(0));
  assert(e0.state.inBlockComment);
  const e1 = h.getLineTokens(1, b.getLine(1));
  assert(e1.state.inBlockComment);
  eq(e1.tokens[0].type, TOKEN.COMMENT);
  const e2 = h.getLineTokens(2, b.getLine(2));
  assert(!e2.state.inBlockComment);
});

check("invalidating from line clears cache", () => {
  const h = new Highlighter(javascript);
  const b = new TextBuffer("const a = 1;\nconst b = 2;");
  h.getLineTokens(0, b.getLine(0));
  h.getLineTokens(1, b.getLine(1));
  eq(h.lineCache.size, 2);
  h.invalidateFrom(1);
  eq(h.lineCache.size, 1);
});

check("invalidateAll clears everything", () => {
  const h = new Highlighter(javascript);
  h.getLineTokens(0, "const a = 1;");
  h.getLineTokens(1, "const b = 2;");
  h.invalidateAll();
  eq(h.lineCache.size, 0);
  eq(h.stateCache.length, 1);
});

check("recomputeStates walks until state stable", () => {
  const h = new Highlighter(javascript);
  const b = new TextBuffer("a\nb\nc\nd");
  h.recomputeStates(b, 0);
  eq(h.stateCache.length, 5);
});

group("token positions");

check("token positions match text", () => {
  const { tokens } = tokenizeLine("const x", new HighlightState());
  for (const t of tokens) {
    eq(t.text, "const x".slice(t.start, t.end));
  }
});

check("tokens cover all non-whitespace characters", () => {
  const line = "const x = 42;";
  const { tokens } = tokenizeLine(line, new HighlightState());
  let joined = "";
  let cursor = 0;
  for (const t of tokens) {
    assert(t.start >= cursor);
    joined += line.slice(t.start, t.end);
    cursor = t.end;
  }
  eq(joined, line);
});

log(
  `\n<span class="${failed ? "fail" : "pass"}">` +
  `${passed} passed, ${failed} failed</span>`
);