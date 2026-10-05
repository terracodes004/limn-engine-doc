let v4t = "";

window.__v2t = "";
window.__v3t = "";
window.__v4t = "";
window.__enginesReady = false;

function loadScript(url, key, onDone) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            const text = xhr.responseText;
            if (key === 'v4') { v4t = text; window.__v4t = text; }
            window.__enginesReady = true;
            try { window.dispatchEvent(new Event('enginesready')); } catch (e) {}
            if (typeof onDone === 'function') onDone(null, text);
        } else {
            const err = new Error('Failed to load ' + url + ' — status ' + xhr.status);
            console.error(err);
            if (typeof onDone === 'function') onDone(err);
        }
    };
    xhr.onerror = function () {
        const err = new Error('Network error loading ' + url);
        console.error(err);
        if (typeof onDone === 'function') onDone(err);
    };
    xhr.send();
}

loadScript("epic.js", 'v4');

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

function normalizeAssets(assets) {
    var a = assets && typeof assets === 'object' ? assets : {};
    var head = typeof a.head === 'string' ? a.head : '';
    var css = typeof a.css === 'string' ? a.css : '';
    var scriptsRaw = typeof a.scripts === 'string' ? a.scripts : '';
    var scriptList = scriptsRaw
        .split(/\r?\n/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
    return { head: head, css: css, scripts: scriptList };
}

function buildAssetsHeadHtml(assets) {
    var parts = [];
    var norm = normalizeAssets(assets);

    if (norm.head.trim()) {
        parts.push(norm.head.trim());
    }

    for (var i = 0; i < norm.scripts.length; i++) {
        var url = norm.scripts[i].replace(/"/g, '&quot;');
        parts.push('<script src="' + url + '"><\/script>');
    }

    if (norm.css.trim()) {
        parts.push('<style>\n' + norm.css + '\n</style>');
    }

    return parts.length ? parts.join('\n') + '\n' : '';
}

window.buildGameHTML = function (engineCode, userCode, assets) {
    var safeUserCode = String(userCode || '').replace(/<\/script>/gi, '<\\/script>');
    var safeEngine = String(engineCode || '');
    var assetsHead = buildAssetsHeadHtml(assets);

    return '<!DOCTYPE html>\n' +
        '<html lang="en">\n' +
        '<head>\n' +
        '<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
        assetsHead +
        '<style>\n' +
        'html,body{margin:0;padding:0;background:#0a0a0a;overflow:hidden;height:100%;}\n' +
        'canvas{display:block;margin:0 auto;}\n' +
        '</style>\n' +
        '<script>' + safeEngine + '<\/script>\n' +
        buildConsoleForwarder() +
        buildErrorOverlay() +
        '</head>\n' +
        '<body>\n' +
        '<script>\n' +
        safeUserCode + '\n' +
        '<\/script>\n' +
        '</body>\n' +
        '</html>';
};

window.runn = function () {
    if (!window.__enginesReady) {
        alert("Engine still loading. Wait 2 seconds and tap Run again.");
        return;
    }

    var dialog = document.getElementById('runDialog');
    if (!dialog) return;

    if (typeof dialog.showModal === 'function') {
        if (!dialog.hasAttribute('open')) {
            try { dialog.showModal(); } catch (e) {
                dialog.setAttribute('open', '');
            }
        }
    } else {
        dialog.setAttribute('open', '');
    }

    var iframe = document.getElementById('gameFrame');
    if (!iframe) return;

    var code = window.__editor ? window.__editor.getValue() : "";
    if (!code || !code.trim()) {
        alert("Nothing to run. Write or generate some code first.");
        return;
    }

    var engineCode = window.__v4t;
    if (!engineCode || !engineCode.trim()) {
        alert("Engine failed to load. Check that epic.js is in /editor/.");
        return;
    }

    var assets = (typeof window.getCurrentAssets === 'function')
        ? window.getCurrentAssets()
        : { head: '', css: '', scripts: '' };

    var html = window.buildGameHTML(engineCode, code, assets);

    iframe.srcdoc = html;
};
