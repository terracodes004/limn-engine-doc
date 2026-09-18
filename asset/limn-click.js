
//limn mouse
(function () {
  if (typeof Display === 'undefined') {
    console.warn('[limn-click] Display not found. Load patch after epic.js.');
    return;
  }

  // ═══════════════════════════════════════════════════════
  // MOUSE CLASS
  // ═══════════════════════════════════════════════════════
  class LimnMouse {
    constructor() {
      this.x = 0;              // canvas-space x
      this.y = 0;              // canvas-space y
      this.worldX = 0;         // world-space x (canvas + camera)
      this.worldY = 0;         // world-space y
      this.down = false;       // left button currently held
      this.up = true;          // left button currently released
      this.justPressed = false;   // true for one frame after press
      this.justReleased = false;  // true for one frame after release
      this.button = -1;        // 0=left, 1=middle, 2=right
      this.downX = 0;          // x position at last press
      this.downY = 0;          // y position at last press
      this.dragX = 0;          // total drag delta since press
      this.dragY = 0;
      this.moved = false;      // true for one frame after move
      this.wheel = 0;          // scroll delta (positive = down)
      this.insideCanvas = false;
      this.lastDownTime = 0;
      this.lastClickTime = 0;
      this.doubleClick = false;
      this.clickCount = 0;
      this.lockedTo = null;    // component currently being dragged
      this.lockedOffsetX = 0;
      this.lockedOffsetY = 0;
    }

    endFrame() {
      this.justPressed = false;
      this.justReleased = false;
      this.moved = false;
      this.wheel = 0;
    }

    inArea(x1, y1, x2, y2) {
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      return this.x >= minX && this.x <= maxX && this.y >= minY && this.y <= maxY;
    }

    inCircle(cx, cy, r) {
      const dx = this.x - cx, dy = this.y - cy;
      return dx * dx + dy * dy <= r * r;
    }

    inComponent(comp) {
      if (!comp) return false;
      return this.x >= comp.x && this.x <= comp.x + comp.width &&
             this.y >= comp.y && this.y <= comp.y + comp.height;
    }

    lockTo(comp) {
      this.lockedTo = comp;
      this.lockedOffsetX = this.x - comp.x;
      this.lockedOffsetY = this.y - comp.y;
    }

    unlock() {
      this.lockedTo = null;
    }

    reset() {
      this.down = false;
      this.up = true;
      this.justPressed = false;
      this.justReleased = false;
      this.dragX = 0;
      this.dragY = 0;
      this.button = -1;
      this.unlock();
    }
  }

  // Global mouse instance
  window.mouse = new LimnMouse();

  // ═══════════════════════════════════════════════════════
  // DISPLAY PATCH — richer event listeners
  // ═══════════════════════════════════════════════════════
  Display.prototype.addEventListeners = function () {
    const self = this;

    window.addEventListener('keydown', e => { self.keys[e.keyCode] = true; });
    window.addEventListener('keyup',   e => { self.keys[e.keyCode] = false; });

    const toCanvasCoords = (clientX, clientY) => {
      const rect = self.canvas.getBoundingClientRect();
      const scaleX = self.canvas.width  / rect.width;
      const scaleY = self.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY
      };
    };

    const updateFromEvent = (clientX, clientY) => {
      const p = toCanvasCoords(clientX, clientY);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.worldX = p.x + self.camera.x;
      mouse.worldY = p.y + self.camera.y;
    };

    // ── Mouse down ──
    window.addEventListener('mousedown', e => {
      updateFromEvent(e.clientX, e.clientY);
      mouse.down = true;
      mouse.up = false;
      mouse.justPressed = true;
      mouse.button = e.button;
      mouse.downX = mouse.x;
      mouse.downY = mouse.y;
      mouse.dragX = 0;
      mouse.dragY = 0;
      mouse.lastDownTime = Date.now();
      self.x = mouse.worldX;
      self.y = mouse.worldY;
    });

    // ── Mouse up ──
    window.addEventListener('mouseup', e => {
      mouse.down = false;
      mouse.up = true;
      mouse.justReleased = true;
      mouse.dragX = 0;
      mouse.dragY = 0;

      const now = Date.now();
      if (now - mouse.lastClickTime < 300) {
        mouse.doubleClick = true;
        mouse.clickCount++;
      } else {
        mouse.doubleClick = false;
        mouse.clickCount = 1;
      }
      mouse.lastClickTime = now;

      self.x = false;
      self.y = false;
    });

    // ── Mouse move ──
    window.addEventListener('mousemove', e => {
      const oldX = mouse.x, oldY = mouse.y;
      updateFromEvent(e.clientX, e.clientY);
      if (mouse.down) {
        mouse.dragX += mouse.x - oldX;
        mouse.dragY += mouse.y - oldY;
      }
      if (mouse.x !== oldX || mouse.y !== oldY) mouse.moved = true;
    });

    // ── Mouse wheel ──
    window.addEventListener('wheel', e => {
      mouse.wheel = e.deltaY;
    }, { passive: true });

    // ── Right-click on canvas — suppress browser menu ──
    window.addEventListener('contextmenu', e => {
      if (e.target === self.canvas) e.preventDefault();
    });

    // ── Touch start ──
    window.addEventListener('touchstart', e => {
      const t = e.touches[0];
      updateFromEvent(t.clientX, t.clientY);
      mouse.down = true;
      mouse.up = false;
      mouse.justPressed = true;
      mouse.button = 0;
      mouse.downX = mouse.x;
      mouse.downY = mouse.y;
      mouse.dragX = 0;
      mouse.dragY = 0;
      self.x = mouse.worldX;
      self.y = mouse.worldY;
    }, { passive: true });

    // ── Touch end ──
    window.addEventListener('touchend', () => {
      mouse.down = false;
      mouse.up = true;
      mouse.justReleased = true;
      mouse.dragX = 0;
      mouse.dragY = 0;
      self.x = false;
      self.y = false;
    });

    // ── Touch move ──
    window.addEventListener('touchmove', e => {
      const t = e.touches[0];
      const oldX = mouse.x, oldY = mouse.y;
      updateFromEvent(t.clientX, t.clientY);
      if (mouse.down) {
        mouse.dragX += mouse.x - oldX;
        mouse.dragY += mouse.y - oldY;
      }
      if (mouse.x !== oldX || mouse.y !== oldY) mouse.moved = true;
    }, { passive: true });
  };

  // ═══════════════════════════════════════════════════════
  // HIT TEST UTILITIES
  // ═══════════════════════════════════════════════════════

  window.inArea = (x1, y1, x2, y2) => mouse.inArea(x1, y1, x2, y2);
  window.inCircle = (cx, cy, r) => mouse.inCircle(cx, cy, r);
  window.inComponent = comp => mouse.inComponent(comp);

  window.hitTest = function (components) {
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i].x || components[i];
      if (c && mouse.inComponent(c)) return c;
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════
  // COMPONENT LOCK
  // ═══════════════════════════════════════════════════════

  window.comLock = function (comp) {
    if (!comp) return;
    mouse.lockTo(comp);
    comp._lockedDrag = true;
    return comp;
  };

  window.comUnlock = function () {
    if (mouse.lockedTo) {
      mouse.lockedTo._lockedDrag = false;
      mouse.lockedTo = null;
    }
  };

  window.comLocked = () => mouse.lockedTo;

  // ═══════════════════════════════════════════════════════
  // DISTANCE / ANGLE HELPERS
  // ═══════════════════════════════════════════════════════

  window.mouseDistTo = (x, y) => {
    const dx = mouse.x - x, dy = mouse.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  window.mouseAngleTo = (x, y) => Math.atan2(y - mouse.y, x - mouse.x);

  window.mousePressed  = () => mouse.justPressed;
  window.mouseReleased = () => mouse.justReleased;

  window.clickInArea = (x1, y1, x2, y2) =>
    mouse.justPressed && mouse.inArea(x1, y1, x2, y2);

  // ═══════════════════════════════════════════════════════
  // AUTO-TICK VIA requestAnimationFrame
  // ═══════════════════════════════════════════════════════
  //
  // Wraps rAF so that:
  //   • The drag-locked component is moved before the frame runs
  //   • justPressed / justReleased / moved / wheel are cleared after
  //
  // The wrapper is installed only once, so loading the extension
  // twice does not double-wrap rAF.
  // ═══════════════════════════════════════════════════════
  if (!window._limnClickRafWrapped) {
    const _raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
      return _raf.call(window, function (t) {
        if (mouse.lockedTo) {
          mouse.lockedTo.x = mouse.x - mouse.lockedOffsetX;
          mouse.lockedTo.y = mouse.y - mouse.lockedOffsetY;
        }
        const r = cb(t);
        mouse.endFrame();
        return r;
      });
    };
    window._limnClickRafWrapped = true;
  }

  console.log('[limn-click] Installed. Mouse class + utilities ready.');
})();
