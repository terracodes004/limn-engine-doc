function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  let out = escapeHtml(text);
  
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  
  return out;
}

export function renderMarkdown(text) {
  const lines = String(text || "").split("\n");
  const out = [];
  let i = 0;
  const n = lines.length;
  
  while (i < n) {
    const line = lines[i];
    
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const code = [];
      i++;
      while (i < n && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      const langAttr = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
      out.push("<pre><code" + langAttr + ">" + escapeHtml(code.join("\n")) + "</code></pre>");
      continue;
    }
    
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
      i++;
      continue;
    }
    
    if (/^\s*([-*_]){3,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < n && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push("<ul>");
      for (const it of items) out.push("<li>" + inline(it) + "</li>");
      out.push("</ul>");
      continue;
    }
    
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < n && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push("<ol>");
      for (const it of items) out.push("<li>" + inline(it) + "</li>");
      out.push("</ol>");
      continue;
    }
    
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < n && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + inline(quote.join(" ")) + "</blockquote>");
      continue;
    }
    
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    
    const para = [line];
    i++;
    while (i < n && !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push("<p>" + inline(para.join(" ")) + "</p>");
  }
  
  return out.join("\n");
}

export function wrapMarkdownDocument(html, title) {
  const css = [
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;",
    "max-width:720px;margin:0 auto;padding:32px 20px 80px;",
    "line-height:1.65;color:#1e1e1e;background:#fff;}",
    "h1,h2,h3,h4,h5,h6{font-weight:600;margin:1.6em 0 0.6em;}",
    "h1{font-size:2em;border-bottom:1px solid #eee;padding-bottom:.3em;}",
    "h2{font-size:1.5em;border-bottom:1px solid #eee;padding-bottom:.3em;}",
    "h3{font-size:1.2em;}",
    "p{margin:0 0 1em;}",
    "a{color:#0366d6;text-decoration:none;}",
    "a:hover{text-decoration:underline;}",
    "code{background:#f6f8fa;padding:2px 6px;border-radius:4px;font-size:.9em;",
    "font-family:ui-monospace,'JetBrains Mono',Menlo,monospace;}",
    "pre{background:#f6f8fa;padding:14px 16px;border-radius:8px;overflow-x:auto;}",
    "pre code{background:none;padding:0;}",
    "blockquote{border-left:4px solid #dfe2e5;color:#6a737d;",
    "margin:0 0 1em;padding:0 1em;}",
    "ul,ol{padding-left:1.6em;margin:0 0 1em;}",
    "li{margin:.3em 0;}",
    "hr{border:none;border-top:1px solid #eaecef;margin:1.5em 0;}",
    "img{max-width:100%;}",
    "table{border-collapse:collapse;margin:0 0 1em;}",
    "th,td{border:1px solid #dfe2e5;padding:6px 12px;}",
    "th{background:#f6f8fa;}",
  ].join("");
  const safeTitle = escapeHtml(title || "Preview");
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + safeTitle + "</title>" +
    "<style>" + css + "</style></head><body>" + html + "</body></html>";
}