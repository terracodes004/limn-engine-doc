import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let files = {};
let filesName = [];

function getCodeTextarea() {
    return document.getElementById('js');
}

function getTitleEl() {
    return document.querySelector('h5');
}

async function getActiveUser() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ? session.user : null;
    } catch (e) {
        console.error("Auth session error:", e);
        return null;
    }
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
    // 1. Try modern Clipboard API first
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        // fall through to legacy method
    }

    // 2. Fallback: hidden textarea + execCommand('copy')
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.width = '1px';
        ta.style.height = '1px';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);

        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);

        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

async function loadUserData() {
    const params = new URLSearchParams(window.location.search);
    const snippetId = params.get('id');
    const editSlug = params.get('edit');
    const forkFlag = params.get('fork');

    // ---------- 1. FORK (highest priority) ----------
    if (forkFlag === '1') {
        console.log('[loadUserData] fork mode');
        const code = localStorage.getItem('limn_fork_code');
        const title = localStorage.getItem('limn_fork_title') || 'forked';
        console.log('[loadUserData] fork code length:', code ? code.length : 0);

        if (code) {
            const textarea = getCodeTextarea();
            const h5 = getTitleEl();
            if (textarea) textarea.value = code;
            if (h5) h5.innerText = 'forked-' + title + '.js';

            localStorage.removeItem('limn_fork_code');
            localStorage.removeItem('limn_fork_title');
        }

        await loadFilesFromCloudOrLocal();
        return;
    }

    // ---------- 2. EDIT ----------
    if (editSlug) {
        console.log('[loadUserData] edit mode:', editSlug);
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

                const versionSelect = document.querySelector('#version');
                if (versionSelect && data.engine_version) {
                    const match = ['v2', 'v3', 'v4'].find(v => data.engine_version.includes(v));
                    if (match) versionSelect.value = match;
                }

                const headerTitle = document.querySelector('header h1');
                if (headerTitle) headerTitle.textContent = 'LIMN STUDIO — Editing';
            } else {
                console.log('Edit load failed:', error);
            }
        } catch (e) {
            console.log('Edit loader error:', e.message);
        }

        await loadFilesFromCloudOrLocal();
        return;
    }

    // ---------- 3. SHARED SNIPPET (?id=) ----------
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
                    }
                    return;
                }
            }
        } catch (err) {
            console.error("Error loading shared project:", err);
        }
    }

    // ---------- 4. DEFAULT ----------
    await loadFilesFromCloudOrLocal();
}

async function loadFilesFromCloudOrLocal() {
    const user = await getActiveUser();

    if (user) {
        try {
            const { data, error } = await supabase
                .from('user_documents')
                .select('files, filenames')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) console.error("Cloud fetch error:", error.message);

            if (data) {
                files = data.files || {};
                filesName = data.filenames || [];
            }
        } catch (err) {
            console.error("Failed to load from cloud:", err);
        }
    }

    if (!filesName || filesName.length === 0) {
        try {
            files = JSON.parse(localStorage.getItem("files")) || {};
        } catch (e) {
            files = {};
        }
        let rawNames = localStorage.getItem("filename");
        filesName = rawNames ? rawNames.split(",").filter(Boolean) : [];
    }

    const fileContainer = document.getElementById('file');
    if (fileContainer) fileContainer.innerHTML = '';
    filesName.forEach(e => { if (e) createFileUI(e); });
}

loadUserData();

const editor = document.getElementById("js");
if (editor) {
    editor.addEventListener('keydown', (e) => {
        const pairs = { '(': ')', '<': '>', '"': '"', "'": "'", '[': ']' };
        if (pairs[e.key]) {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.setRangeText(pairs[e.key], start, end, 'preserve');
        } else if (e.key === "{") {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.setRangeText('\n  \n}', start, end, 'preserve');
        }
    });
}

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
    });

    btn.addEventListener("dblclick", () => del(name, np));

    let dbtn = document.createElement('button');
    dbtn.innerHTML = "⬇️";
    dbtn.title = "Click to download standalone game";
    dbtn.addEventListener("click", () => down(name));

    np.appendChild(btn);
    np.appendChild(dbtn);

    const fileListEl = document.getElementById('file');
    if (fileListEl) fileListEl.appendChild(np);
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

        if (error) {
            console.error("Cloud save failed:", error.message);
            alert("⚠️ Cloud Sync Error: " + error.message);
        }
    }
    localStorage.setItem("filename", filesName.join(","));
    localStorage.setItem("files", JSON.stringify(files));
}

window.saveAs = async function() {
    const user = await getActiveUser();
    if (!user) {
        alert("⚠️ You must sign up or log in to save your files!");
        window.location.href = "/signup/frontend/index.html";
        return;
    }

    let name = prompt('Input file name');
    if (name === null || name.trim() === "" || name.includes(",")) {
        alert("⚠️ Save Unsuccessful (Invalid name or contains commas)");
        return;
    }

    const h5 = getTitleEl();
    const textarea = getCodeTextarea();

    if (h5) h5.innerText = name;
    if (textarea) files[name] = textarea.value;

    if (!filesName.includes(name)) {
        filesName.push(name);
    }

    await persistData();
    createFileUI(name);
    alert("Saved Successfully ✅");
};

window.save = async function() {
    const user = await getActiveUser();
    if (!user) {
        alert("⚠️ You must sign up or log in to save your files!");
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
        alert("Saved Successfully ✅");
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
        alert("⚠️ Nothing to publish. Write some code or use the Build tab first.");
        return;
    }

    // Ask user what they want to do
    const wantToPublish = confirm(
        "How do you want to share?\n\n" +
        "OK — Publish to the Arcade (public game, anyone can play)\n\n" +
        "Cancel — Just get a share link (send the code to someone)"
    );

    // ---- Share link only ----
    if (!wantToPublish) {
        await shareAsLink();
        return;
    }

    // ---- Publish to arcade (existing behavior) ----
    const editSlug = localStorage.getItem('limn_edit_slug');

    const versionDropdown = document.querySelector('#version');
    const selectedVersion = versionDropdown ? versionDropdown.value.toLowerCase() : 'v4';
    const engineCode = selectedVersion.includes('v2') ? v2t
                     : selectedVersion.includes('v3') ? v3t
                     : v4t;

    let title = "Untitled";
    const h5Text = h5 ? h5.innerText : "";
    if (h5Text && h5Text !== "*Untitled*") {
        title = h5Text.replace(/\.js$/i, '');
    } else if (window.currentConfig && window.currentConfig.title) {
        title = window.currentConfig.title;
    }

    const config = window.currentConfig || {
        title: title,
        world: { w: 800, h: 600, bg: '#0d0d2a' },
        slots: [],
        palette: []
    };

    const description = getDescriptionField();

    if (editSlug) {
        const { error } = await supabase
            .from('games')
            .update({
                code: liveCode,
                config: config,
                engine_version: selectedVersion,
                engine_code: engineCode,
                description: description || null
            })
            .eq('slug', editSlug)
            .eq('author_id', user ? user.id : null);

        if (error) {
            console.error("Update error:", error.message);
            alert("⚠️ Failed to update: " + error.message);
            return;
        }

        localStorage.removeItem('limn_edit_slug');

        const playUrl = `${window.location.origin}/arcade/game.html?slug=${editSlug}`;
        const copied = await copyText(playUrl);
        alert((copied
            ? "✅ Game updated! Play link copied:\n"
            : "✅ Game updated! Copy this link manually:\n") + playUrl);
        return;
    }

    const slug = (title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30) || 'game') + '-' + Math.random().toString(36).slice(2, 6);

    const { data, error } = await supabase
        .from('games')
        .insert([{
            slug: slug,
            title: title,
            author_id: user ? user.id : null,
            author_name: user ? (user.email || 'anonymous') : 'anonymous',
            config: config,
            code: liveCode,
            engine_version: selectedVersion,
            engine_code: engineCode,
            description: description || null
        }])
        .select('slug')
        .single();

    if (error) {
        console.error("Publish error:", error.message);
        alert("⚠️ Failed to publish: " + error.message);
        return;
    }

    const playUrl = `${window.location.origin}/arcade/game.html?slug=${data.slug}`;
    const copied = await copyText(playUrl);
    window.history.pushState({}, '', `?id=${data.slug}`);
    alert((copied
        ? "🎮 Published! Play link copied:\n"
        : "🎮 Published! Copy this link manually:\n") + playUrl);
};

async function shareAsLink() {
    const h5 = getTitleEl();
    const textarea = getCodeTextarea();

    // Make sure the current file's code is stored in `files`
    let currentFileName = h5 ? h5.innerText : "";
    if (currentFileName && currentFileName !== "*Untitled*" && textarea) {
        files[currentFileName] = textarea.value;
    }

    const payload = JSON.stringify({
        files: files,
        filesName: filesName
    });

    const { data, error } = await supabase
        .from('snippets')
        .insert([{ code: payload }])
        .select('id')
        .single();

    if (error) {
        console.error("Snippet save failed:", error.message);
        alert("⚠️ Failed to create share link: " + error.message);
        return;
    }

    const shareUrl = `${window.location.origin}/editor/?id=${data.id}`;
    const copied = await copyText(shareUrl);
    alert((copied
        ? "🔗 Share link copied!\n"
        : "🔗 Share link ready — copy manually:\n") + shareUrl);
}

async function del(name, element) {
    let con = confirm("⚠️ Are you sure you want to delete this file?");
    if (con) {
        delete files[name];
        filesName = filesName.filter(e => e !== name);
        await persistData();
        element.remove();
        alert("File deleted 🗑️");
    } else {
        alert("File is still available ✅😁");
    }
}

const textareaEl = document.getElementById("js");
if (textareaEl) {
    textareaEl.addEventListener("keydown", (e) => {
        if (e.ctrlKey) {
            if (e.shiftKey && (e.key === "S" || e.key === "s")) {
                e.preventDefault();
                window.saveAs();
            } else if (e.key === "s" || e.key === "S") {
                e.preventDefault();
                window.save();
            }
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

    const htmlTemplate = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>' + filename + ' - Limn Engine Game</title>\n' +
'    <style>\n' +
'        body { margin: 0; background: #0a0a0a; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }\n' +
'        canvas { display: block; }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'    <script>' + engineCode + '<\/script>\n' +
'    <script>\n' +
'        ' + codeData + '\n' +
'    <\/script>\n' +
'</body>\n' +
'</html>';

    const blob = new Blob([htmlTemplate], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.[^/.]+$/, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
};
