import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let files = {};
let filesName = [];

function getCodeTextarea() { return document.getElementById('js'); }
function getTitleEl() { return document.getElementById('title'); }

async function getActiveUser() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ? session.user : null;
    } catch (e) { return null; }
}

function getDescriptionField() {
    const el = document.getElementById('gameDescription');
    return el ? el.value.trim() : '';
}

function setDescriptionField(value) {
    const el = document.getElementById('gameDescription');
    if (el) el.value = value || '';
}

async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {}
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) { return false; }
}

async function loadUserData() {
    const params = new URLSearchParams(window.location.search);
    const snippetId = params.get('id');
    const editSlug = params.get('edit');
    const forkFlag = params.get('fork');

    if (forkFlag === '1') {
        const code = localStorage.getItem('limn_fork_code');
        const title = localStorage.getItem('limn_fork_title') || 'forked';
        if (code) {
            const textarea = getCodeTextarea();
            const h5 = getTitleEl();
            if (textarea) textarea.value = code;
            if (h5) h5.innerText = 'forked-' + title + '.js';
            if (window.__renderCode) window.__renderCode();
            localStorage.removeItem('limn_fork_code');
            localStorage.removeItem('limn_fork_title');
        }
        return;
    }

    if (editSlug) {
        localStorage.setItem('limn_edit_slug', editSlug);
        try {
            const { data, error } = await supabase
                .from('games')
                .select('title, description, code, config, engine_version')
                .eq('slug', editSlug)
                .maybeSingle();
            if (!error && data) {
                const textarea = getCodeTextarea();
                const h5 = getTitleEl();
                if (textarea) textarea.value = data.code || '';
                if (h5) h5.innerText = data.title + '.js';
                if (data.config) window.currentConfig = data.config;
                if (data.description) setDescriptionField(data.description);
                if (window.__renderCode) window.__renderCode();
            }
        } catch (e) {}
        return;
    }

    if (snippetId) {
        try {
            const { data, error } = await supabase
                .from('snippets')
                .select('code')
                .eq('id', snippetId)
                .single();
            if (!error && data) {
                const parsed = JSON.parse(data.code);
                if (parsed.files && parsed.filesName) {
                    files = parsed.files;
                    filesName = parsed.filesName;
                    const fileContainer = document.getElementById('file');
                    if (fileContainer) fileContainer.innerHTML = '';
                    filesName.forEach(e => { if (e) createFileUI(e); });
                    if (filesName.length > 0) {
                        const firstFile = filesName[0];
                        const textarea = getCodeTextarea();
                        const h5 = getTitleEl();
                        if (textarea) textarea.value = files[firstFile] || "";
                        if (h5) h5.innerText = firstFile;
                        if (window.__renderCode) window.__renderCode();
                    }
                }
            }
        } catch (err) {}
        return;
    }
}

async function persistData() {
    const user = await getActiveUser();
    if (user) {
        const { error } = await supabase.from('user_documents').upsert({
            user_id: user.id,
            files: files,
            filenames: filesName,
            updated_at: new Date()
        }, { onConflict: 'user_id' });
        if (error) console.error("Cloud save failed:", error.message);
    }
    localStorage.setItem("filename", filesName.join(","));
    localStorage.setItem("files", JSON.stringify(files));
}

window.saveAs = async function() {
    const user = await getActiveUser();
    if (!user) {
        alert("You must sign up or log in to save files.");
        window.location.href = "/signup/frontend/index.html";
        return;
    }

    let name = prompt('Input file name');
    if (name === null || name.trim() === "" || name.includes(",")) {
        alert("Save unsuccessful (invalid name).");
        return;
    }

    const h5 = getTitleEl();
    const textarea = getCodeTextarea();

    if (h5) h5.innerText = name;
    if (textarea) files[name] = textarea.value;
    if (!filesName.includes(name)) filesName.push(name);

    await persistData();
    createFileUI(name);
    alert("Saved successfully ✅");
};

window.save = async function() {
    const user = await getActiveUser();
    if (!user) {
        alert("You must sign up or log in to save files.");
        window.location.href = "/signup/frontend/index.html";
        return;
    }

    const h5 = getTitleEl();
    const textarea = getCodeTextarea();
    let currentFileName = h5 ? h5.innerText : "*Untitled*";

    if (currentFileName === "*Untitled*" || !currentFileName) {
        window.saveAs();
    } else {
        if (textarea) files[currentFileName] = textarea.value;
        await persistData();
        alert("Saved successfully ✅");
    }
};

window.shareProject = async function() {
    const user = await getActiveUser();
    const h5 = getTitleEl();
    const textarea = getCodeTextarea();
    let currentFileName = h5 ? h5.innerText : "";
    if (currentFileName && currentFileName !== "*Untitled*" && textarea) {
        files[currentFileName] = textarea.value;
    }

    const liveCode = textarea ? textarea.value.trim() : "";
    if (!liveCode) {
        alert("Nothing to share. Write some code first.");
        return;
    }

    const payload = JSON.stringify({ files: files, filesName: filesName });
    const { data, error } = await supabase
        .from('snippets')
        .insert([{ code: payload }])
        .select('id')
        .single();

    if (error) {
        alert("Share failed: " + error.message);
        return;
    }

    const shareUrl = window.location.origin + '/editor/?id=' + data.id;
    const copied = await copyText(shareUrl);
    alert((copied ? "🔗 Share link copied:\n" : "🔗 Share link:\n") + shareUrl);
};

function createFileUI(name) {
    let np = document.createElement('p');
    let btn = document.createElement('button');
    btn.innerHTML = name;
    btn.title = "Click to open. Double click to delete";
    btn.addEventListener('click', () => {
        const textarea = getCodeTextarea();
        const h5 = getTitleEl();
        if (textarea) textarea.value = files[name] || "";
        if (h5) h5.innerText = name;
        if (window.__renderCode) window.__renderCode();
    });
    btn.addEventListener("dblclick", () => del(name, np));

    let dbtn = document.createElement('button');
    dbtn.innerHTML = "⬇️";
    dbtn.title = "Download";
    dbtn.addEventListener("click", () => down(name));

    np.appendChild(btn);
    np.appendChild(dbtn);
    const fileListEl = document.getElementById('file');
    if (fileListEl) fileListEl.appendChild(np);
}

async function del(name, element) {
    let con = confirm("Delete this file?");
    if (con) {
        delete files[name];
        filesName = filesName.filter(e => e !== name);
        await persistData();
        element.remove();
    }
}

const textareaEl = document.getElementById("js");
if (textareaEl) {
    textareaEl.addEventListener("keydown", (e) => {
        if (e.ctrlKey) {
            if (e.shiftKey && (e.key === "S" || e.key === "s")) { e.preventDefault(); window.saveAs(); }
            else if (e.key === "s" || e.key === "S") { e.preventDefault(); window.save(); }
        }
    });
}

window.down = function(filename) {
    const textarea = getCodeTextarea();
    const codeData = textarea ? textarea.value : "";
    const versionDropdown = document.querySelector('#version');
    const selectedVersion = versionDropdown ? versionDropdown.value.toLowerCase() : 'v4';
    const engineCode = selectedVersion.includes('v2') ? v2t
                     : selectedVersion.includes('v3') ? v3t
                     : v4t;

    const htmlTemplate = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>' + filename + '</title>\n<style>body{margin:0;background:#0a0a0a;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{display:block}</style>\n</head>\n<body>\n<script>' + engineCode + '<\/script>\n<script>\n' + codeData + '\n<\/script>\n</body>\n</html>';

    const blob = new Blob([htmlTemplate], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.[^/.]+$/, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
};

loadUserData();
