let v2t = "", v3t = "", v4t = "";

function loadScript(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open("get", url);
    xhr.onload = () => {
        if (xhr.status === 200) callback(xhr.responseText);
    };
    xhr.send();
}

loadScript("tcjsgame-v2.js", (text) => v2t = text);
loadScript("tcjsgame-v3.js", (text) => v3t = text);
loadScript("epic.js", (text) => v4t = text);

function runn() {
    $('dialog').fadeIn(300);

    let iframe = document.querySelector('iframe');
    if (iframe) {
        iframe.style.width = "100%";
        iframe.style.height = "70vh";
        iframe.style.border = "none";
        iframe.style.display = "block";
    }

    let mainTextarea = document.getElementById('js');

    if (!mainTextarea) {
        console.error("Run Error: Could not locate the editor text area (#js).");
        return;
    }
    let userEditorCode = mainTextarea.value;

    if (!userEditorCode || !userEditorCode.trim()) {
        console.error("Run Error: Editor is empty.");
        alert("⚠️ Nothing to run. Write or generate some code first.");
        return;
    }

    let engineScriptFile = v4t;
    let versionDropdown = document.getElementById('version');

    if (versionDropdown) {
        let selectedVersion = versionDropdown.value.toLowerCase();

        if (selectedVersion.includes('v2')) {
            engineScriptFile = v2t;
        } else if (selectedVersion.includes('v3')) {
            engineScriptFile = v3t;
        } else if (selectedVersion.includes('v4')) {
            engineScriptFile = v4t;
        }
    }

    let code = `<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <script>${engineScriptFile}<\/script>
</head>
<body>
    <script>
        const _customLog = console.log;
        console.log = function(...args) {
            _customLog.apply(console, args);
            const joinedArgs = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' ');
            
            if (window.parent && window.parent.document) {
                const consoleDisplay = window.parent.document.getElementById('editor-console-logs');
                if (consoleDisplay) {
                    const line = window.parent.document.createElement('div');
                    line.textContent = joinedArgs;
                    consoleDisplay.appendChild(line);
                    consoleDisplay.scrollTop = consoleDisplay.scrollHeight;
                }
            }
        };

        window.onerror = function(msg, src, line, col, err) {
            document.body.innerHTML = '<pre style="color:#f66;padding:20px;font-family:monospace">ERROR: ' +
                msg + '\\n\\n' + (err && err.stack ? err.stack : '') + '</pre>';
            return true;
        };

${userEditorCode}
    <\/script>
</body>
</html>`;

    if (iframe) {
        iframe.srcdoc = code;
    }
           }
