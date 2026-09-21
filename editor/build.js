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
    var isForkOrEdit = params.get('fork') === '1' || params.get('edit') || params.get('id');
    var skipNextRegenerate = isForkOrEdit;

    function templateName() { return window.__templateSelectValue || 'dressup'; }
    function currentTemplate() { return window.LimnTemplates[templateName()]; }

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
      if (skipNextRegenerate) { skipNextRegenerate = false; return; }
      textarea.value = lastGenerated;
      if (window.__renderCode) window.__renderCode();
    }

    function makeSwatch(key, labelText, defaultValue) {
      var wrap = document.createElement('div');
      wrap.className = 'field';

      var label = document.createElement('label');
      label.textContent = labelText;

      var swatch = document.createElement('div');
      swatch.className = 'swatch-field';

      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'swatch-input';
      colorInput.value = defaultValue;
      colorInput.dataset.key = key;

      var hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'swatch-hex';
      hex.value = defaultValue.toUpperCase();
      hex.maxLength = 9;
      hex.spellcheck = false;

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'swatch-copy';
      copyBtn.textContent = '⧉';
      copyBtn.title = 'Copy hex';

      colorInput.addEventListener('input', function () {
        hex.value = colorInput.value.toUpperCase();
        regenerate();
      });
      hex.addEventListener('input', function () {
        var v = hex.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
          colorInput.value = v;
          regenerate();
        }
      });
      hex.addEventListener('blur', function () {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())) {
          hex.value = colorInput.value.toUpperCase();
        }
      });
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(colorInput.value.toUpperCase()).then(function () {
            copyBtn.textContent = '✓';
            setTimeout(function () { copyBtn.textContent = '⧉'; }, 900);
          }).catch(function () {});
        }
      });

      swatch.appendChild(colorInput);
      swatch.appendChild(hex);
      swatch.appendChild(copyBtn);

      wrap.appendChild(label);
      wrap.appendChild(swatch);
      return { el: wrap, input: colorInput, hex: hex };
    }

    function makeTextField(key, labelText, defaultValue) {
      var wrap = document.createElement('div');
      wrap.className = 'field';

      var label = document.createElement('label');
      label.textContent = labelText;

      var input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue;
      input.dataset.key = key;
      input.spellcheck = false;

      input.addEventListener('input', regenerate);

      wrap.appendChild(label);
      wrap.appendChild(input);
      return { el: wrap, input: input };
    }

    var fieldRefs = {};

    function renderFields() {
      var tpl = currentTemplate();
      if (!tpl) return;
      fieldsEl.innerHTML = '';
      fieldRefs = {};

      for (var i = 0; i < tpl.fields.length; i++) {
        var f = tpl.fields[i];
        var made;
        if (f.type === 'color') {
          made = makeSwatch(f.key, f.label, f.default);
        } else {
          made = makeTextField(f.key, f.label, f.default);
        }
        fieldsEl.appendChild(made.el);
        fieldRefs[f.key] = made;
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
      resetBtn.addEventListener('click', function () {
        var tpl = currentTemplate();
        if (!tpl) return;
        for (var i = 0; i < tpl.fields.length; i++) {
          var f = tpl.fields[i];
          var ref = fieldRefs[f.key];
          if (!ref) continue;
          ref.input.value = f.default;
          if (ref.hex) ref.hex.value = f.default.toUpperCase();
        }
        regenerate();
        if (window.toast) window.toast('Reset to defaults', 'success');
      });
    }

    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var allTabs = document.querySelectorAll('.tab');
        for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
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
