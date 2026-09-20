(function () {
  var SUPABASE_FUNCTION_URL = "https://pjtpesdhjfvcidfkxord.supabase.co/functions/v1/ai-generate";

  var lastCodeBeforeGenerate = null;

  function setStatus(msg, isError) {
    var el = document.getElementById('aiStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    el.classList.toggle('error', !!isError);
  }

  async function generateFromPrompt(promptText) {
    var res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });

    var data = await res.json().catch(function () { return {}; });

    if (!res.ok) {
      if (data.error === 'RATE_LIMIT') {
        throw new Error(data.message || 'The AI is busy. Try again in a minute.');
      }
      if (data.error === 'AI generated invalid code') {
        throw new Error('The AI wrote code the engine rejected: ' + (data.reason || 'unknown'));
      }
      throw new Error(data.error || data.message || 'Generation failed');
    }

    if (!data.code || typeof data.code !== 'string') {
      throw new Error('AI returned an unexpected shape');
    }

    return data.code;
  }

  function switchToCodeTab() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) { t.classList.remove('active'); });
    var codeTab = document.querySelector('.tab[data-tab="code"]');
    if (codeTab) codeTab.classList.add('active');

    var buildPanel = document.getElementById('buildPanel');
    var promptPanel = document.getElementById('promptPanel');
    var codeSection = document.getElementById('codeSection');

    if (buildPanel) buildPanel.style.display = 'none';
    if (promptPanel) promptPanel.style.display = 'none';
    if (codeSection) codeSection.style.display = 'block';
  }

  function applyCode(code) {
    var textarea = document.getElementById('js');
    if (!textarea) throw new Error('Code textarea missing');

    lastCodeBeforeGenerate = textarea.value;
    showUndoButton();

    textarea.value = code;

    if (window.__renderCode) window.__renderCode();

    switchToCodeTab();
  }

  function showUndoButton() {
    var existing = document.getElementById('aiUndoBtn');
    if (existing) return;

    var btn = document.createElement('button');
    btn.id = 'aiUndoBtn';
    btn.textContent = '↶ Undo AI';
    btn.style.cssText = [
      'position: fixed',
      'bottom: 18px',
      'left: 18px',
      'z-index: 2147483647',
      'padding: 8px 14px',
      'background: #7c3aed',
      'color: #fff',
      'border: 2px solid rgba(255,255,255,0.25)',
      'border-radius: 8px',
      'font-size: 13px',
      'font-weight: 600',
      'cursor: pointer',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.4)'
    ].join(';');

    btn.addEventListener('click', function () {
      if (lastCodeBeforeGenerate === null) return;
      var textarea = document.getElementById('js');
      if (!textarea) return;
      textarea.value = lastCodeBeforeGenerate;
      if (window.__renderCode) window.__renderCode();
      lastCodeBeforeGenerate = null;
      btn.remove();
    });

    document.body.appendChild(btn);
  }

  function init() {
    var btn = document.getElementById('aiGenerate');
    var textarea = document.getElementById('aiPrompt');
    if (!btn || !textarea) return;

    btn.addEventListener('click', async function () {
      var prompt = textarea.value.trim();
      if (!prompt) {
        setStatus('Type something first.', true);
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ Generating...';
      setStatus('Asking Gemini...', false);

      try {
        var code = await generateFromPrompt(prompt);
        setStatus('Got code. Loading into the editor...', false);
        applyCode(code);
        setStatus('', false);
      } catch (e) {
        setStatus(e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '✨ Generate';
      }
    });

    textarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        btn.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
