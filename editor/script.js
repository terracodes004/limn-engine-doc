import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let files = {};
let filesName = [];

async function getActiveUser() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ? session.user : null;
    } catch (e) {
        console.error("Auth session error:", e);
        return null;
    }
}

async function loadUserData() {
    const params = new URLSearchParams(window.location.search);
    const snippetId = params.get('id');

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
                    filesName.forEach(e => {
                        if (e) createFileUI(e);
                    });

                    if (filesName.length > 0) {
                        const firstFile = filesName[0];
                        const textarea = document.querySelector('textarea');
                        const h5 = document.querySelector('h5');
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

    filesName.forEach(e => {
        if (e) createFileUI(e);
    });
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
        const textarea = document.querySelector('textarea');
        const h5 = document.querySelector('h5');
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

    const h5 = document.querySelector('h5');
    const textarea = document.querySelector('textarea');

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

    const h5 = document.querySelector('h5');
    const textarea = document.querySelector('textarea');
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

    const h5 = document.querySelector('h5');
    const textarea = document.querySelector('textarea');
    let currentFileName = h5 ? h5.innerText : "";
    if (currentFileName && currentFileName !== "*Untitled*" && textarea) {
        files[currentFileName] = textarea.value;
    }

    if (Object.keys(files).length === 0) {
        alert("⚠️ You have no files to share!");
        return;
    }

    const versionDropdown = document.querySelector('#version');
    const selectedVersion = versionDropdown ? versionDropdown.value.toLowerCase() : 'v4';
    const engineCode = selectedVersion.includes('v2') ? v2t
                     : selectedVersion.includes('v3') ? v3t
                     : v4t;

    const firstFile = filesName[0] || "Untitled";
    const title = firstFile.replace(/\.js$/i, '');
    const userCode = files[firstFile] || "";

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
            config: { title: title, author: user ? user.email : 'anonymous', slots: [], palette: [] },
            code: userCode,
            engine_version: selectedVersion,
            engine_code: engineCode
        }])
        .select('slug')
        .single();

    if (error) {
        console.error("Publish error:", error.message);
        alert("⚠️ Failed to publish: " + error.message);
        return;
    }

    const playUrl = `${window.location.origin}/arcade/game.html?slug=${data.slug}`;
    await navigator.clipboard.writeText(playUrl);
    window.history.pushState({}, '', `?id=${data.slug}`);

    alert("🎮 Published! Play link copied:\n" + playUrl);
};

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

const textareaEl = document.querySelector("textarea");
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
    const textarea = document.querySelector("textarea");
    const codeData = textarea ? textarea.value : "";

    const versionDropdown = document.querySelector('#version');
    const selectedVersion = versionDropdown ? versionDropdown.value.toLowerCase() : 'v4';
    const engineCode = selectedVersion.includes('v2') ? v2t
                     : selectedVersion.includes('v3') ? v3t
                     : v4t;

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename} - Limn Engine Game</title>
    <style>
        body { margin: 0; background: #0a0a0a; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script>${engineCode}<\/script>
    <script>
        ${codeData}
    <\/script>
</body>
</html>`;

    const blob = new Blob([htmlTemplate], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.[^/.]+$/, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
};
