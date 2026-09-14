window.LimnTemplates = {

  dressup: {
    name: "Dress-Up",
    fields: [
      { key: "title",      label: "Title",      type: "text",  default: "My Outfit" },
      { key: "bg",         label: "Background", type: "color", default: "#0d0d2a" },
      { key: "hatColor",   label: "Hat",        type: "color", default: "#4af" },
      { key: "headColor",  label: "Head",       type: "color", default: "#fd3" },
      { key: "shirtColor", label: "Shirt",      type: "color", default: "#f44" },
      { key: "pantsColor", label: "Pants",      type: "color", default: "#c4f" },
      { key: "shoesColor", label: "Shoes",      type: "color", default: "#111" }
    ],
    config: function(cfg) {
      return {
        title: cfg.title,
        world: { w: 800, h: 600, bg: cfg.bg },
        slots: [
          { x: 355, y: 140, w: 90,  h: 30,  color: cfg.hatColor },
          { x: 360, y: 170, w: 80,  h: 80,  color: cfg.headColor },
          { x: 350, y: 250, w: 100, h: 120, color: cfg.shirtColor },
          { x: 355, y: 370, w: 90,  h: 90,  color: cfg.pantsColor },
          { x: 350, y: 460, w: 100, h: 30,  color: cfg.shoesColor }
        ],
        palette: [
          cfg.hatColor, cfg.headColor, cfg.shirtColor,
          cfg.pantsColor, cfg.shoesColor, "#ffffff", "#111111"
        ]
      };
    },
    generate: function(cfg) {
      var slots = [
        { x: 355, y: 140, w: 90,  h: 30,  color: cfg.hatColor },
        { x: 360, y: 170, w: 80,  h: 80,  color: cfg.headColor },
        { x: 350, y: 250, w: 100, h: 120, color: cfg.shirtColor },
        { x: 355, y: 370, w: 90,  h: 90,  color: cfg.pantsColor },
        { x: 350, y: 460, w: 100, h: 30,  color: cfg.shoesColor }
      ];
      var palette = [
        cfg.hatColor, cfg.headColor, cfg.shirtColor,
        cfg.pantsColor, cfg.shoesColor, "#ffffff", "#111111"
      ];

      var lines = [
        'const display = new Display();',
        'display.perform();',
        'display.start(800, 600);',
        'display.backgroundColor("' + cfg.bg + '");',
        '',
        'const slots = ' + JSON.stringify(slots) + ';',
        'const palette = ' + JSON.stringify(palette) + ';',
        '',
        'const parts = slots.map((s, i) => {',
        '  const c = new Component(s.w, s.h, s.color, s.x, s.y, "rect");',
        '  display.add(c);',
        '  c.slotIndex = i;',
        '  return c;',
        '});',
        '',
        'let mouseWasDown = false;',
        '',
        'function update(dt) {',
        '  if (display.x !== false && !mouseWasDown) {',
        '    const mx = display.x, my = display.y;',
        '    for (const p of parts) {',
        '      if (mx >= p.x && mx <= p.x + p.width &&',
        '          my >= p.y && my <= p.y + p.height) {',
        '        const cur = palette.indexOf(p.color);',
        '        p.color = palette[(cur + 1) % palette.length];',
        '        break;',
        '      }',
        '    }',
        '    mouseWasDown = true;',
        '  }',
        '  if (display.x === false) mouseWasDown = false;',
        '}'
      ];

      return lines.join('\n');
    }
  }

};
