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

    let code = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<script>' + engineScriptFile + '<\/script>\n' +
'</head>\n' +
'<body>\n' +
'<script>\n' +
'const _customLog = console.log;\n' +
'console.log = function() {\n' +
'  _customLog.apply(console, arguments);\n' +
'  var parts = [];\n' +
'  for (var i = 0; i < arguments.length; i++) {\n' +
'    var a = arguments[i];\n' +
'    parts.push(typeof a === "object" ? JSON.stringify(a) : a);\n' +
'  }\n' +
'  try {\n' +
'    var box = window.parent.document.getElementById("editor-console-logs");\n' +
'    if (box) {\n' +
'      var line = window.parent.document.createElement("div");\n' +
'      line.textContent = parts.join(" ");\n' +
'      box.appendChild(line);\n' +
'      box.scrollTop = box.scrollHeight;\n' +
'    }\n' +
'  } catch (e) {}\n' +
'};\n' +
'window.onerror = function(msg, src, line, col, err) {\n' +
'  document.body.innerHTML = "<pre style=\\"color:#f66;padding:20px;font-family:monospace\\">ERROR: " + msg + "\\n\\n" + (err && err.stack ? err.stack : "") + "</pre>";\n' +
'  return true;\n' +
'};\n' +
userEditorCode + '\n' +
'<\/script>\n' +
'</body>\n' +
'</html>';

    if (iframe) iframe.srcdoc = code;
}
