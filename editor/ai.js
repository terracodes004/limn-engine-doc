(function () {
  var SUPABASE_FUNCTION_URL = "https://pjtpesdhjfvcidfkxord.supabase.co/functions/v1/ai-generate";

  function setStatus(msg, isError) {
    var el = document.getElementById('aiStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    el.classList.toggle('error', !!isError);
  }

  async function generateFromPrompt(promptText) {
    var res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Generation failed');
    }
    return res.json();
  }

  function applyConfigToBuildTab(config) {
    if (!config || !config.template || !config.fields) {
      throw new Error('AI returned an unexpected shape');
    }

    var select = document.getElementById('templateSelect');
    if (!select) throw new Error('Template dropdown missing');

    select.value = config.template;
    select.dispatchEvent(new Event('change'));

    setTimeout(function () {
      var fields = document.getElementById('templateFields');
      if (!fields) return;

      var inputs = fields.querySelectorAll('input');
      inputs.forEach(function (input) {
        var key = input.dataset.key;
        if (key && config.fields[key] !== undefined) {
          input.value = config.fields[key];
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      var tabs = document.querySelectorAll('.tab');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      var buildTab = document.querySelector('.tab[data-tab="build"]');
      if (buildTab) buildTab.classList.add('active');

      document.getElementById('promptPanel').style.display = 'none';
      document.getElementById('buildPanel').style.display = 'grid';
      document.getElementById('codeSection').style.display = 'none';
    }, 50);
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
        var config = await generateFromPrompt(prompt);
        setStatus('Got it. Filling the Build tab...', false);
        applyConfigToBuildTab(config);
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
