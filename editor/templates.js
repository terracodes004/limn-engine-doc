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
        palette: [cfg.hatColor, cfg.headColor, cfg.shirtColor,
                  cfg.pantsColor, cfg.shoesColor, "#ffffff", "#111111"]
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
      var palette = [cfg.hatColor, cfg.headColor, cfg.shirtColor,
                     cfg.pantsColor, cfg.shoesColor, "#ffffff", "#111111"];
      var lines = [
        "const display = new Display();",
        "display.perform();",
        "display.start(800, 600);",
        "display.backgroundColor('" + cfg.bg + "');",
        "",
        "const slots = " + JSON.stringify(slots) + ";",
        "const palette = " + JSON.stringify(palette) + ";",
        "",
        "const parts = slots.map((s, i) => {",
        "  const c = new Component(s.w, s.h, s.color, s.x, s.y, 'rect');",
        "  display.add(c);",
        "  c.slotIndex = i;",
        "  return c;",
        "});",
        "",
        "let mouseWasDown = false;",
        "",
        "function update(dt) {",
        "  if (display.x !== false && !mouseWasDown) {",
        "    const mx = display.x, my = display.y;",
        "    for (const p of parts) {",
        "      if (mx >= p.x && mx <= p.x + p.width && my >= p.y && my <= p.y + p.height) {",
        "        const cur = palette.indexOf(p.color);",
        "        p.color = palette[(cur + 1) % palette.length];",
        "        break;",
        "      }",
        "    }",
        "    mouseWasDown = true;",
        "  }",
        "  if (display.x === false) mouseWasDown = false;",
        "}"
      ];
      return lines.join("\n");
    }
  },

  platformer: {
    name: "Platformer",
    fields: [
      { key: "title",     label: "Title",           type: "text",  default: "Jump Quest" },
      { key: "bg",        label: "Sky",             type: "color", default: "#0d0d2a" },
      { key: "ground",    label: "Ground",          type: "color", default: "#4f8" },
      { key: "player",    label: "Player",          type: "color", default: "#4af" },
      { key: "coin",      label: "Coin",            type: "color", default: "#fd3" },
      { key: "speed",     label: "Speed (100-500)", type: "text",  default: "280" },
      { key: "jumpForce", label: "Jump (8-20)",     type: "text",  default: "13" },
      { key: "coins",     label: "Number of coins", type: "text",  default: "5" }
    ],
    config: function(cfg) {
      return {
        title: cfg.title,
        world: { w: 800, h: 600, bg: cfg.bg },
        slots: [
          { x: 100, y: 500, w: 40, h: 40, color: cfg.player },
          { x: 240, y: 380, w: 24, h: 24, color: cfg.coin }
        ],
        palette: [cfg.player, cfg.coin, cfg.ground]
      };
    },
    generate: function(cfg) {
      var speed = parseInt(cfg.speed) || 280;
      var jump = parseInt(cfg.jumpForce) || 13;
      var count = parseInt(cfg.coins) || 5;

      var coinPositions = [];
      var seed = 42;
      for (var i = 0; i < count; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var rnd = seed / 233280;
        var x = 120 + Math.floor(rnd * 580);
        var y = 380 - (i % 3) * 80;
        coinPositions.push({ x: x, y: y });
      }

      var lines = [
        "const display = new Display();",
        "display.perform();",
        "display.start(800, 600);",
        "display.backgroundColor('" + cfg.bg + "');",
        "",
        "const player = new Component(40, 40, '" + cfg.player + "', 100, 400, 'rect');",
        "display.add(player);",
        "",
        "const ground = new Component(800, 60, '" + cfg.ground + "', 0, 540, 'rect');",
        "display.add(ground);",
        "",
        "const platforms = [",
        "  new Component(150, 20, '" + cfg.ground + "', 200, 460, 'rect'),",
        "  new Component(150, 20, '" + cfg.ground + "', 450, 380, 'rect'),",
        "  new Component(150, 20, '" + cfg.ground + "', 650, 300, 'rect')",
        "];",
        "platforms.forEach(function(p) { display.add(p); });",
        "",
        "const coinPositions = " + JSON.stringify(coinPositions) + ";",
        "const coins = coinPositions.map(function(c) {",
        "  var coin = new Component(24, 24, '" + cfg.coin + "', c.x, c.y, 'rect');",
        "  display.add(coin);",
        "  return coin;",
        "});",
        "",
        "const score = new Tctxt('20px','Arial','white',20,40,'left',false,'top','rgba(0,0,0,0.5)',10,4);",
        "score.setText('Score: 0');",
        "display.add(score);",
        "",
        "const btnSize = 70;",
        "const btnY = 500;",
        "const btnL = new Component(btnSize, btnSize, 'rgba(255,255,255,0.18)', 30, btnY, 'rect');",
        "const btnR = new Component(btnSize, btnSize, 'rgba(255,255,255,0.18)', 120, btnY, 'rect');",
        "const btnJ = new Component(btnSize, btnSize, 'rgba(68,170,255,0.5)', 680, btnY, 'rect');",
        "display.add(btnL); display.add(btnR); display.add(btnJ);",
        "",
        "function inBtn(b, x, y) {",
        "  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;",
        "}",
        "",
        "let vy = 0;",
        "let onGround = false;",
        "let points = 0;",
        "let won = false;",
        "",
        "function rectHit(a, b) {",
        "  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;",
        "}",
        "",
        "function update(dt) {",
        "  if (won) return;",
        "  const sp = " + speed + ";",
        "  const jf = " + jump + ";",
        "",
        "  const mx = display.x, my = display.y;",
        "  const touchingL = mx !== false && inBtn(btnL, mx, my);",
        "  const touchingR = mx !== false && inBtn(btnR, mx, my);",
        "  const touchingJ = mx !== false && inBtn(btnJ, mx, my);",
        "",
        "  if (display.keys[37] || display.keys[65] || touchingL) player.x -= sp * dt;",
        "  if (display.keys[39] || display.keys[68] || touchingR) player.x += sp * dt;",
        "",
        "  const keyJump = display.keys[38] || display.keys[32] || display.keys[87];",
        "  if ((keyJump || touchingJ) && onGround) {",
        "    vy = -jf;",
        "    onGround = false;",
        "  }",
        "",
        "  vy += 40 * dt;",
        "  player.y += vy;",
        "  onGround = false;",
        "",
        "  if (rectHit(player, ground)) {",
        "    player.y = ground.y - player.height;",
        "    vy = 0;",
        "    onGround = true;",
        "  }",
        "",
        "  for (const p of platforms) {",
        "    if (rectHit(player, p) && player.y + player.height - vy <= p.y + 4) {",
        "      player.y = p.y - player.height;",
        "      vy = 0;",
        "      onGround = true;",
        "    }",
        "  }",
        "",
        "  if (player.x < 0) player.x = 0;",
        "  if (player.x + player.width > 800) player.x = 800 - player.width;",
        "",
        "  for (let i = coins.length - 1; i >= 0; i--) {",
        "    if (rectHit(player, coins[i])) {",
        "      coins[i].destroy();",
        "      coins.splice(i, 1);",
        "      points += 10;",
        "      score.setText('Score: ' + points);",
        "    }",
        "  }",
        "",
        "  if (coins.length === 0 && !won) {",
        "    won = true;",
        "    score.setText('You win! Score: ' + points);",
        "  }",
        "}"
      ];
      return lines.join("\n");
    }
  },

  runner: {
    name: "Runner",
    fields: [
      { key: "title",    label: "Title",               type: "text",  default: "Speed Run" },
      { key: "bg",       label: "Sky",                 type: "color", default: "#1a1a3a" },
      { key: "ground",   label: "Ground",              type: "color", default: "#333333" },
      { key: "player",   label: "Player",              type: "color", default: "#4af" },
      { key: "obstacle", label: "Obstacle",            type: "color", default: "#f44" },
      { key: "speed",    label: "Scroll speed (1-20)", type: "text",  default: "6" },
      { key: "spawn",    label: "Spawn rate",          type: "text",  default: "100" }
    ],
    config: function(cfg) {
      return {
        title: cfg.title,
        world: { w: 800, h: 600, bg: cfg.bg },
        slots: [
          { x: 100, y: 500, w: 40, h: 40, color: cfg.player },
          { x: 700, y: 480, w: 40, h: 60, color: cfg.obstacle }
        ],
        palette: [cfg.player, cfg.obstacle, cfg.ground]
      };
    },
    generate: function(cfg) {
      var speed = parseInt(cfg.speed) || 6;
      var spawnRate = parseInt(cfg.spawn) || 100;
      var lines = [
        "const display = new Display();",
        "display.perform();",
        "display.start(800, 600);",
        "display.backgroundColor('" + cfg.bg + "');",
        "",
        "const ground = new Component(800, 60, '" + cfg.ground + "', 0, 540, 'rect');",
        "display.add(ground);",
        "",
        "const player = new Component(40, 40, '" + cfg.player + "', 100, 500, 'rect');",
        "display.add(player);",
        "",
        "const score = new Tctxt('20px','Arial','white',20,40,'left',false,'top','rgba(0,0,0,0.5)',10,4);",
        "score.setText('Tap anywhere to jump. Score: 0');",
        "display.add(score);",
        "",
        "const obstacles = [];",
        "let frame = 0;",
        "let vy = 0;",
        "let onGround = true;",
        "let points = 0;",
        "let gameOver = false;",
        "",
        "function rectHit(a, b) {",
        "  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;",
        "}",
        "",
        "function spawn() {",
        "  const h = 40 + Math.floor(Math.random() * 40);",
        "  const o = new Component(40, h, '" + cfg.obstacle + "', 820, 540 - h, 'rect');",
        "  display.add(o);",
        "  obstacles.push(o);",
        "}",
        "",
        "function update(dt) {",
        "  if (gameOver) return;",
        "  frame++;",
        "  if (frame % " + spawnRate + " === 0) spawn();",
        "",
        "  const keyJump = display.keys[38] || display.keys[32] || display.keys[87];",
        "  const tapJump = display.x !== false;",
        "  if ((keyJump || tapJump) && onGround) {",
        "    vy = -13;",
        "    onGround = false;",
        "  }",
        "",
        "  vy += 40 * dt;",
        "  player.y += vy;",
        "",
        "  if (player.y >= 500) {",
        "    player.y = 500;",
        "    vy = 0;",
        "    onGround = true;",
        "  }",
        "",
        "  for (let i = obstacles.length - 1; i >= 0; i--) {",
        "    const o = obstacles[i];",
        "    o.x -= " + speed + ";",
        "    if (o.x < -60) {",
        "      o.destroy();",
        "      obstacles.splice(i, 1);",
        "      points += 5;",
        "      score.setText('Score: ' + points);",
        "    } else if (rectHit(player, o)) {",
        "      gameOver = true;",
        "      score.setText('Game Over! Score: ' + points);",
        "    }",
        "  }",
        "}"
      ];
      return lines.join("\n");
    }
  },

  shooter: {
    name: "Shooter",
    fields: [
      { key: "title",    label: "Title",             type: "text",  default: "Star Fight" },
      { key: "bg",       label: "Space",             type: "color", default: "#050510" },
      { key: "player",   label: "Ship",              type: "color", default: "#4af" },
      { key: "bullet",   label: "Bullet",            type: "color", default: "#fd3" },
      { key: "enemy",    label: "Enemy",             type: "color", default: "#f44" },
      { key: "speed",    label: "Move speed",        type: "text",  default: "320" },
      { key: "fireRate", label: "Fire rate (frames)",type: "text",  default: "12" },
      { key: "spawn",    label: "Enemy spawn",       type: "text",  default: "90" }
    ],
    config: function(cfg) {
      return {
        title: cfg.title,
        world: { w: 800, h: 600, bg: cfg.bg },
        slots: [
          { x: 380, y: 520, w: 40, h: 40, color: cfg.player },
          { x: 380, y: 300, w: 30, h: 30, color: cfg.enemy }
        ],
        palette: [cfg.player, cfg.bullet, cfg.enemy]
      };
    },
    generate: function(cfg) {
      var speed = parseInt(cfg.speed) || 320;
      var fireRate = parseInt(cfg.fireRate) || 12;
      var spawnRate = parseInt(cfg.spawn) || 90;
      var lines = [
        "const display = new Display();",
        "display.perform();",
        "display.start(800, 600);",
        "display.backgroundColor('" + cfg.bg + "');",
        "",
        "const player = new Component(40, 40, '" + cfg.player + "', 380, 520, 'rect');",
        "display.add(player);",
        "",
        "const score = new Tctxt('20px','Arial','white',20,40,'left',false,'top','rgba(0,0,0,0.5)',10,4);",
        "score.setText('Score: 0');",
        "display.add(score);",
        "",
        "const btnSize = 70;",
        "const btnY = 500;",
        "const btnL = new Component(btnSize, btnSize, 'rgba(255,255,255,0.18)', 30, btnY, 'rect');",
        "const btnR = new Component(btnSize, btnSize, 'rgba(255,255,255,0.18)', 120, btnY, 'rect');",
        "const btnF = new Component(btnSize, btnSize, 'rgba(68,170,255,0.5)', 680, btnY, 'rect');",
        "display.add(btnL); display.add(btnR); display.add(btnF);",
        "",
        "function inBtn(b, x, y) {",
        "  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;",
        "}",
        "",
        "const bullets = [];",
        "const enemies = [];",
        "let frame = 0;",
        "let points = 0;",
        "let gameOver = false;",
        "",
        "function rectHit(a, b) {",
        "  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;",
        "}",
        "",
        "function update(dt) {",
        "  if (gameOver) return;",
        "  frame++;",
        "  const sp = " + speed + ";",
        "",
        "  const mx = display.x, my = display.y;",
        "  const touchingL = mx !== false && inBtn(btnL, mx, my);",
        "  const touchingR = mx !== false && inBtn(btnR, mx, my);",
        "  const touchingF = mx !== false && inBtn(btnF, mx, my);",
        "",
        "  if (display.keys[37] || display.keys[65] || touchingL) player.x -= sp * dt;",
        "  if (display.keys[39] || display.keys[68] || touchingR) player.x += sp * dt;",
        "",
        "  if (player.x < 0) player.x = 0;",
        "  if (player.x + player.width > 800) player.x = 800 - player.width;",
        "",
        "  const keyFire = display.keys[32] || display.keys[38];",
        "  if ((keyFire || touchingF) && frame % " + fireRate + " === 0) {",
        "    const b = new Component(6, 14, '" + cfg.bullet + "', player.x + 17, player.y - 10, 'rect');",
        "    display.add(b);",
        "    bullets.push(b);",
        "  }",
        "",
        "  for (let i = bullets.length - 1; i >= 0; i--) {",
        "    const b = bullets[i];",
        "    b.y -= 12;",
        "    if (b.y < -20) {",
        "      b.destroy();",
        "      bullets.splice(i, 1);",
        "    }",
        "  }",
        "",
        "  if (frame % " + spawnRate + " === 0) {",
        "    const e = new Component(36, 36, '" + cfg.enemy + "', 20 + Math.random() * 740, -40, 'rect');",
        "    display.add(e);",
        "    enemies.push(e);",
        "  }",
        "",
        "  for (let i = enemies.length - 1; i >= 0; i--) {",
        "    const e = enemies[i];",
        "    e.y += 2;",
        "",
        "    if (e.y > 620) {",
        "      e.destroy();",
        "      enemies.splice(i, 1);",
        "      continue;",
        "    }",
        "",
        "    if (rectHit(player, e)) {",
        "      gameOver = true;",
        "      score.setText('Game Over! Score: ' + points);",
        "    }",
        "",
        "    for (let j = bullets.length - 1; j >= 0; j--) {",
        "      if (rectHit(bullets[j], e)) {",
        "        bullets[j].destroy();",
        "        bullets.splice(j, 1);",
        "        e.destroy();",
        "        enemies.splice(i, 1);",
        "        points += 10;",
        "        score.setText('Score: ' + points);",
        "        break;",
        "      }",
        "    }",
        "  }",
        "}"
      ];
      return lines.join("\n");
    }
  },

  clicker: {
    name: "Clicker",
    fields: [
      { key: "title",    label: "Title",              type: "text",  default: "Click Rush" },
      { key: "bg",       label: "Background",         type: "color", default: "#0d0d2a" },
      { key: "target",   label: "Target",             type: "color", default: "#4af" },
      { key: "size",     label: "Target size (px)",   type: "text",  default: "60" },
      { key: "lifetime", label: "Lifetime (frames)",  type: "text",  default: "90" },
      { key: "time",     label: "Game time (secs)",   type: "text",  default: "30" }
    ],
    config: function(cfg) {
      return {
        title: cfg.title,
        world: { w: 800, h: 600, bg: cfg.bg },
        slots: [
          { x: 370, y: 270, w: 60, h: 60, color: cfg.target }
        ],
        palette: [cfg.target]
      };
    },
    generate: function(cfg) {
      var size = parseInt(cfg.size) || 60;
      var life = parseInt(cfg.lifetime) || 90;
      var totalTime = parseInt(cfg.time) || 30;
      var lines = [
        "const display = new Display();",
        "display.perform();",
        "display.start(800, 600);",
        "display.backgroundColor('" + cfg.bg + "');",
        "",
        "const score = new Tctxt('20px','Arial','white',20,40,'left',false,'top','rgba(0,0,0,0.5)',10,4);",
        "score.setText('Tap the square. Score: 0  Time: " + totalTime + "');",
        "display.add(score);",
        "",
        "let target = null;",
        "let points = 0;",
        "let timeLeft = " + totalTime + ";",
        "let timer = 0;",
        "let spawnTimer = 0;",
        "let gameOver = false;",
        "let mouseWasDown = false;",
        "",
        "function spawnTarget() {",
        "  if (target) target.destroy();",
        "  const s = " + size + ";",
        "  const x = Math.random() * (800 - s);",
        "  const y = 80 + Math.random() * (520 - s);",
        "  target = new Component(s, s, '" + cfg.target + "', x, y, 'rect');",
        "  display.add(target);",
        "}",
        "",
        "spawnTarget();",
        "",
        "function update(dt) {",
        "  if (gameOver) return;",
        "",
        "  timer += dt;",
        "  if (timer >= 1) {",
        "    timer -= 1;",
        "    timeLeft--;",
        "    score.setText('Score: ' + points + '  Time: ' + timeLeft);",
        "    if (timeLeft <= 0) {",
        "      gameOver = true;",
        "      if (target) target.destroy();",
        "      score.setText('Game Over! Final Score: ' + points);",
        "      return;",
        "    }",
        "  }",
        "",
        "  spawnTimer++;",
        "  if (!target || spawnTimer > " + life + ") {",
        "    spawnTarget();",
        "    spawnTimer = 0;",
        "  }",
        "",
        "  if (display.x !== false && !mouseWasDown && target) {",
        "    const mx = display.x, my = display.y;",
        "    if (mx >= target.x && mx <= target.x + target.width && my >= target.y && my <= target.y + target.height) {",
        "      points += 10;",
        "      score.setText('Score: ' + points + '  Time: ' + timeLeft);",
        "      target.destroy();",
        "      target = null;",
        "      spawnTarget();",
        "      spawnTimer = 0;",
        "    }",
        "    mouseWasDown = true;",
        "  }",
        "  if (display.x === false) mouseWasDown = false;",
        "}"
      ];
      return lines.join("\n");
    }
  }

};
