(function () {
  function init() {
    var buildPanel = document.getElementById('buildPanel');
    var codeSection = document.getElementById('codeSection');
    var fieldsEl = document.getElementById('templateFields');
    var textarea = document.getElementById('js');
    var resetBtn = document.getElementById('buildReset');

    if (!buildPanel || !fieldsEl || !textarea) return;

    var lastGenerated = '';

    var params = new URLSearchParams(location.search);
    var isForkOrEdit = params.get('fork') === '1'
                || params.get('edit')
                || params.get('id');
    var skipNextRegenerate = isForkOrEdit;

    function templateName() {
      return window.__templateSelectValue || 'dressup';
    }

    function currentTemplate() {
      return window.LimnTemplates[templateName()];
    }

    function readFields() {
      var cfg = {};
      var inputs = fieldsEl.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        cfg[inputs[i].dataset.key] = inputs[i].value;
      }
      return cfg;
    }

    function regenerate() {
      var tpl = currentTemplate();
      if (!tpl) return;
      var cfg = readFields();

      window.currentConfig = tpl.config ? tpl.config(cfg) : null;

      lastGenerated = tpl.generate(cfg);

      if (skipNextRegenerate) {
        skipNextRegenerate = false;
        return;
      }

      textarea.value = lastGenerated;

      if (window.__renderCode) window.__renderCode();
    }

    function renderFields() {
      var tpl = currentTemplate();
      if (!tpl) return;
      fieldsEl.innerHTML = '';
      for (var i = 0; i < tpl.fields.length; i++) {
        var f = tpl.fields[i];

        var wrap = document.createElement('div');
        wrap.className = 'build-field';

        var label = document.createElement('label');
        label.textContent = f.label;

        var input = document.createElement('input');
        input.type = f.type === 'color' ? 'color' : 'text';
        input.value = f.default;
        input.dataset.key = f.key;
        input.addEventListener('input', regenerate);

        wrap.appendChild(label);
        wrap.appendChild(input);
        fieldsEl.appendChild(wrap);
      }
      regenerate();
    }

    window.__regenerateBuild = function () {
      renderFields();
    };

    window.addEventListener('templatechange', function () {
      renderFields();
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', regenerate);
    }

    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var allTabs = document.querySelectorAll('.tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.remove('active');
        }
        this.classList.add('active');

        var which = this.dataset.tab;
        buildPanel.style.display = which === 'build' ? 'grid' : 'none';
        codeSection.style.display = which === 'code' ? 'block' : 'none';

        if (which === 'code' && window.__renderCode) window.__renderCode();
      });
    }

    renderFields();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
