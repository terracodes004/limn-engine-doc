import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const { LimnEditorComponent } = await import("./limn-bridge.js");

const SUPABASE_URL = "https://pjtpesdhjfvcidfkxord.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let component = null;

function toast(msg, kind) {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const t = document.createElement("div");
  t.className = "toast " + (kind || "");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity 0.3s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 320);
  }, 2400);
}

function getCode() {
  return component ? component.getValue() : "";
}

function setCode(text) {
  if (!component) return;
  component.setValue(String(text == null ? "" : text));
}

async function bootLimn() {
  const mount = document.getElementById("limn-editor-mount");

  const dummy = document.createElement("canvas");
  dummy.id = "gameCanvas";
  dummy.style.display = "none";
  document.body.appendChild(dummy);

  component = new LimnEditorComponent({
    x: 0, y: 0,
    width: mount.clientWidth || window.innerWidth,
    height: mount.clientHeight || (window.innerHeight - 54),
    value: "// Limn Studio\n// Switch to Build to pick a template.\n",
    name: "main.js",
    fontSize: 14,
    tabSize: 2,
    supabase: supabase,
  });

  await component.attach({ canvas: dummy });

  function fit() {
    const w = mount.clientWidth || 0;
    const h = mount.clientHeight || 0;
    if (w > 0 && h > 0) component.resize(w, h);
  }
  fit();
  window.addEventListener("resize", fit);
  setTimeout(fit, 150);
  setTimeout(fit, 500);

  component.focus();

  (function loop() {
    if (!component) return;
    component.update();
    requestAnimationFrame(loop);
  })();

  window.__limnEditor = component;
  window.__editor = component;
}

function initBuildPanel() {
  const fieldsEl = document.getElementById("templateFields");
  const selectEl = document.getElementById("templateSelect");
  const applyBtn = document.getElementById("buildApply");

  if (!fieldsEl || !selectEl) return;

  const templates = window.LimnTemplates || {};
  const keys = Object.keys(templates);
  let currentKey = keys[0] || null;

  selectEl.innerHTML = "";
  if (keys.length === 0) {
    const o = document.createElement("option");
    o.textContent = "No templates loaded";
    selectEl.appendChild(o);
    return;
  }
  keys.forEach(k => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = templates[k].name || k;
    selectEl.appendChild(o);
  });
  selectEl.value = currentKey;

  const fieldRefs = {};

  function makeSwatch(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = f.label;
    const swatch = document.createElement("div");
    swatch.className = "swatch-field";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "swatch-input";
    colorInput.value = f.default;

    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "swatch-hex";
    hex.value = String(f.default).toUpperCase();
    hex.maxLength = 9;
    hex.spellcheck = false;

    colorInput.addEventListener("input", () => {
      hex.value = colorInput.value.toUpperCase();
    });
    hex.addEventListener("input", () => {
      const v = hex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        colorInput.value = v;
      }
    });
    hex.addEventListener("blur", () => {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())) {
        hex.value = colorInput.value.toUpperCase();
      }
    });

    swatch.appendChild(colorInput);
    swatch.appendChild(hex);
    wrap.appendChild(label);
    wrap.appendChild(swatch);
    return { el: wrap, input: colorInput, hex };
  }

  function makeTextField(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = f.label;
    const input = document.createElement("input");
    input.type = "text";
    input.value = f.default;
    input.spellcheck = false;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { el: wrap, input };
  }

  function renderFields() {
    const tpl = templates[currentKey];
    if (!tpl) return;
    fieldsEl.innerHTML = "";
    Object.keys(fieldRefs).forEach(k => delete fieldRefs[k]);

    tpl.fields.forEach(f => {
      const made = f.type === "color" ? makeSwatch(f) : makeTextField(f);
      fieldsEl.appendChild(made.el);
      fieldRefs[f.key] = made;
    });
  }

  function readValues() {
    const tpl = templates[currentKey];
    const cfg = {};
    if (!tpl) return cfg;
    tpl.fields.forEach(f => {
      const ref = fieldRefs[f.key];
      if (ref) cfg[f.key] = ref.input.value;
      else cfg[f.key] = f.default;
    });
    return cfg;
  }

  function apply() {
    const tpl = templates[currentKey];
    if (!tpl || !tpl.generate) {
      toast("No template selected", "warning");
      return;
    }
    const cfg = readValues();
    if (tpl.config) {
      try { window.currentConfig = tpl.config(cfg); } catch (e) {}
    }
    const code = tpl.generate(cfg);
    setCode(code);
    document.getElementById("tabCode").click();
    toast("Template applied", "success");
  }

  selectEl.addEventListener("change", () => {
    currentKey = selectEl.value;
    renderFields();
  });

  applyBtn.addEventListener("click", apply);

  renderFields();
}

function initAssetsPanel() {
  const head = document.getElementById("assetHead");
  const css = document.getElementById("assetCss");
  const scripts = document.getElementById("assetScripts");
  if (!head || !css || !scripts) return;

  function ensure() {
    if (!window.currentConfig) window.currentConfig = {};
    if (!window.currentConfig.assets) {
      window.currentConfig.assets = { head: "", css: "", scripts: "" };
    }
    return window.currentConfig.assets;
  }

  function load() {
    const a = ensure();
    head.value = a.head || "";
    css.value = a.css || "";
    scripts.value = a.scripts || "";
  }

  function save() {
    const a = ensure();
    a.head = head.value;
    a.css = css.value;
    a.scripts = scripts.value;
  }

  head.addEventListener("input", save);
  css.addEventListener("input", save);
  scripts.addEventListener("input", save);

  window.getCurrentAssets = function () {
    const a = ensure();
    return { head: a.head, css: a.css, scripts: a.scripts };
  };

  load();
}

function initTabs() {
  const tabCode = document.getElementById("tabCode");
  const tabBuild = document.getElementById("tabBuild");
  const tabAssets = document.getElementById("tabAssets");
  const codeSection = document.getElementById("codeSection");
  const buildSection = document.getElementById("buildSection");
  const assetsSection = document.getElementById("assetsSection");

  function show(which) {
    [tabCode, tabBuild, tabAssets].forEach(t => t.classList.remove("active"));
    [codeSection, buildSection, assetsSection].forEach(s => s.classList.remove("active"));

    if (which === "code") {
      tabCode.classList.add("active");
      codeSection.classList.add("active");
      setTimeout(() => window.dispatchEvent(new Event("resize")), 30);
    } else if (which === "build") {
      tabBuild.classList.add("active");
      buildSection.classList.add("active");
    } else if (which === "assets") {
      tabAssets.classList.add("active");
      assetsSection.classList.add("active");
    }
  }

  tabCode.addEventListener("click", () => show("code"));
  tabBuild.addEventListener("click", () => show("build"));
  tabAssets.addEventListener("click", () => show("assets"));

  window.__switchTo = show;
}

function initBarToggle() {
  const topbar = document.getElementById("topbar");
  const hideBtn = document.getElementById("hideBtn");
  const showBtn = document.getElementById("showBtn");
  if (!topbar || !hideBtn || !showBtn) return;

  hideBtn.addEventListener("click", () => {
    topbar.classList.add("hidden");
    document.body.classList.add("bar-hidden");
    showBtn.classList.add("visible");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
  });

  showBtn.addEventListener("click", () => {
    topbar.classList.remove("hidden");
    document.body.classList.remove("bar-hidden");
    showBtn.classList.remove("visible");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
  });
}

function initRun() {
  const runBtn = document.getElementById("runBtn");
  const dialog = document.getElementById("runDialog");
  const dialogClose = document.getElementById("dialogClose");
  const frame = document.getElementById("gameFrame");
  const wrap = document.getElementById("dialogFrameWrap");
  const zoomDisplay = document.getElementById("zoomDisplay");
  if (!runBtn || !dialog) return;

  let zoom = 1;
  function applyZoom() {
    wrap.style.transform = zoom === 1 ? "" : "scale(" + zoom + ")";
    zoomDisplay.textContent = Math.round(zoom * 100) + "%";
  }
  document.getElementById("zoomInBtn").addEventListener("click", () => { zoom = Math.min(3, zoom + 0.1); applyZoom(); });
  document.getElementById("zoomOutBtn").addEventListener("click", () => { zoom = Math.max(0.3, zoom - 0.1); applyZoom(); });
  zoomDisplay.addEventListener("click", () => { zoom = 1; applyZoom(); });
  document.getElementById("fsBtn").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  });
  dialogClose.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    dialog.close();
  });

  function run() {
    if (typeof window.buildGameHTML !== "function") {
      toast("Preview builder not loaded", "error");
      return;
    }
    const code = getCode();
    if (!code.trim()) {
      toast("Nothing to run", "warning");
      return;
    }
    const engine = window.__v4t || "";
    if (!engine) {
      toast("Engine still loading…", "warning");
      return;
    }
    const assets = (window.getCurrentAssets && window.getCurrentAssets()) || { head: "", css: "", scripts: "" };
    const html = window.buildGameHTML(engine, code, assets);
    if (!dialog.hasAttribute("open")) dialog.showModal();
    frame.srcdoc = html;
  }

  runBtn.addEventListener("click", run);
}

function initMenu() {
  const menuBtn = document.getElementById("menuBtn");
  if (!menuBtn) return;
  menuBtn.addEventListener("click", () => {
    if (component && component._menu && typeof component._menu.toggle === "function") {
      component._menu.toggle();
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initAssetsPanel();
  initRun();
  initBarToggle();
  try {
    await bootLimn();
    initBuildPanel();
    initMenu();
    console.log("[limn-studio] ready");
  } catch (err) {
    console.error("[limn-studio] boot failed:", err);
    toast("Editor boot failed: " + err.message, "error");
  }
});
