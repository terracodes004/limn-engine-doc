let v2t = "", v3t = "", v4t = "";
let enginesLoaded = 0;

function loadScript(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open("get", url);
    xhr.onload = () => {
        if (xhr.status === 200) {
            callback(xhr.responseText);
            enginesLoaded++;
            if (enginesLoaded === 3) window.__enginesReady = true;
        } else {
            console.error("Failed to load " + url + " status " + xhr.status);
        }
    };
    xhr.onerror = () => console.error("Network error " + url);
    xhr.send();
}

loadScript("tcjsgame-v2.js", (t) => v2t = t);
loadScript("tcjsgame-v3.js", (t) => v3t = t);
loadScript("epic.js", (t) => v4t = t);

function buildConsoleForwarder() {
    return '<script>\n' +
    '(function(){\n' +
    '  function send(kind, args, stack) {\n' +
    '    try {\n' +
    '      var serialized = [];\n' +
    '      for (var i = 0; i < args.length; i++) {\n' +
    '        var a = args[i];\n' +
    '        if (a === undefined) serialized.push("undefined");\n' +
    '        else if (a === null) serialized.push("null");\n' +
    '        else if (typeof a === "function") serialized.push("[Function " + (a.name || "anonymous") + "]");\n' +
    '        else if (a instanceof Error) serialized.push(a.name + ": " + a.message);\n' +
    '        else if (typeof a === "object") {\n' +
    '          try { serialized.push(JSON.stringify(a)); } catch (e) { serialized.push(String(a)); }\n' +
    '        }\n' +
    '        else serialized.push(String(a));\n' +
    '      }\n' +
    '      window.parent.postMessage({ type: "console", kind: kind, args: serialized, stack: stack || null }, "*");\n' +
    '    } catch (e) {}\n' +
    '  }\n' +
    '  var origLog = console.log;\n' +
    '  var origWarn = console.warn;\n' +
    '  var origError = console.error;\n' +
    '  var origInfo = console.info;\n' +
    '  console.log = function() { origLog.apply(console, arguments); send("log", arguments, null); };\n' +
    '  console.warn = function() { origWarn.apply(console, arguments); send("warn", arguments, null); };\n' +
    '  console.error = function() { origError.apply(console, arguments); send("error", arguments, null); };\n' +
    '  console.info = function() { origInfo.apply(console, arguments); send("info", arguments, null); };\n' +
    '  window.addEventListener("error", function(e) {\n' +
    '    var msg = e.message || "Unknown error";\n' +
    '    var stack = e.error && e.error.stack ? e.error.stack : null;\n' +
    '    send("error", [msg], stack);\n' +
    '  });\n' +
    '  window.addEventListener("unhandledrejection", function(e) {\n' +
    '    var r = e.reason;\n' +
    '    var msg = r && r.message ? r.message : String(r);\n' +
    '    var stack = r && r.stack ? r.stack : null;\n' +
    '    send("error", ["Unhandled promise rejection: " + msg], stack);\n' +
    '  });\n' +
    '})();\n' +
    '<\/script>\n';
}

function buildErrorOverlay() {
    return '<script>\n' +
    'window.onerror = function(msg, src, line, col, err) {\n' +
    '  var stack = err && err.stack ? err.stack : "";\n' +
    '  var location = src ? (src + ":" + line + ":" + col) : "";\n' +
    '  document.body.innerHTML = "<pre style=\\"color:#f66;padding:20px;font-family:monospace;white-space:pre-wrap;background:#0a0a0a;margin:0;min-height:100vh;box-sizing:border-box\\">RUNTIME ERROR\\n\\n" + msg + "\\n\\n" + location + "\\n\\n" + stack + "</pre>";\n' +
    '  return true;\n' +
    '};\n' +
    '<\/script>\n';
}

function runn() {
    if (!window.__enginesReady) {
        alert("Engine still loading. Wait 2 seconds and tap Run again.");
        return;
    }

    if (window.jQuery) window.jQuery('dialog').fadeIn(300);
    else { var d = document.querySelector('dialog'); if (d) d.setAttribute('open', ''); }

    let iframe = document.querySelector('iframe');
    if (iframe) {
        iframe.style.width = "100%";
        iframe.style.height = "70vh";
        iframe.style.border = "none";
        iframe.style.display = "block";
    }

    let mainTextarea = document.getElementById('js');
    if (!mainTextarea) return;

    let userEditorCode = mainTextarea.value;
    if (!userEditorCode || !userEditorCode.trim()) {
        alert("Nothing to run. Write or generate some code first.");
        return;
    }

    let engineScriptFile = v4t;
    let versionDropdown = document.getElementById('version');
    if (versionDropdown) {
        let v = versionDropdown.value.toLowerCase();
        if (v.includes('v2')) engineScriptFile = v2t;
        else if (v.includes('v3')) engineScriptFile = v3t;
        else if (v.includes('v4')) engineScriptFile = v4t;
    }

    if (!engineScriptFile || !engineScriptFile.trim()) {
        alert("Engine failed to load. Check that epic.js is in /editor/.");
        return;
    }

    let safeUserCode = userEditorCode.replace(/<\/script>/gi, '<\\/script>');

    let code = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<script>' + engineScriptFile + '<\/script>\n' +
buildConsoleForwarder() +
buildErrorOverlay() +
'</head>\n' +
'<body>\n' +
'<script>\n' +
safeUserCode + '\n' +
'<\/script>\n' +
'</body>\n' +
'</html>';

    if (iframe) iframe.srcdoc = code;
}
