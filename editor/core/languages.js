import { javascript } from "./lang-javascript.js";
import { json } from "./lang-json.js";
import { css } from "./lang-css.js";
import { html } from "./lang-html.js";
import { markdown } from "./lang-markdown.js";
import { plaintext } from "./lang-plaintext.js";

export const LANGUAGES = {
  javascript,
  json,
  css,
  html,
  markdown,
  plaintext,
};

export const EXTENSION_MAP = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  txt: "plaintext",
  text: "plaintext",
};

export const LANGUAGE_META = {
  javascript: { name: "JavaScript", color: "#f7df1e", extension: "js" },
  json: { name: "JSON", color: "#a3aac0", extension: "json" },
  css: { name: "CSS", color: "#2965f1", extension: "css" },
  html: { name: "HTML", color: "#e34c26", extension: "html" },
  markdown: { name: "Markdown", color: "#6ea8fe", extension: "md" },
  plaintext: { name: "Plain Text", color: "#6e7589", extension: "txt" },
};

export function languageForFilename(name) {
  if (!name) return LANGUAGES.plaintext;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return LANGUAGES.plaintext;
  const ext = name.slice(dot + 1).toLowerCase();
  const key = EXTENSION_MAP[ext];
  if (!key) return LANGUAGES.plaintext;
  return LANGUAGES[key] || LANGUAGES.plaintext;
}

export function languageNameForFilename(name) {
  const lang = languageForFilename(name);
  return lang.name || "plaintext";
}

export function metaForFilename(name) {
  const key = languageNameForFilename(name);
  return LANGUAGE_META[key] || LANGUAGE_META.plaintext;
}

export function metaForLanguage(key) {
  return LANGUAGE_META[key] || LANGUAGE_META.plaintext;
}