(function () {
  if (typeof Display === 'undefined') {
    console.warn('[limn-click-patch] Display not found. Load patch after epic.js.');
    return;
  }

  Display.prototype.addEventListeners = function () {
    var self = this;

    window.addEventListener('keydown', function (e) {
      console.log("Key pressed:", e.keyCode);
      self.keys[e.keyCode] = true;
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.keyCode] = false;
    });

    var toCanvasCoords = function (clientX, clientY) {
      var rect = self.canvas.getBoundingClientRect();
      var scaleX = self.canvas.width / rect.width;
      var scaleY = self.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    window.addEventListener('mousedown', function (e) {
      var p = toCanvasCoords(e.clientX, e.clientY);
      self.x = p.x + self.camera.x;
      self.y = p.y + self.camera.y;
    });
    window.addEventListener('mouseup', function () {
      self.x = false;
      self.y = false;
    });
    window.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      var p = toCanvasCoords(t.clientX, t.clientY);
      self.x = p.x + self.camera.x;
      self.y = p.y + self.camera.y;
    });
    window.addEventListener('touchend', function () {
      self.x = false;
      self.y = false;
    });
    window.addEventListener('mousemove', function (e) {
      var p = toCanvasCoords(e.clientX, e.clientY);
      if (typeof mouse !== 'undefined') {
        mouse.x = p.x;
        mouse.y = p.y;
      }
    });
    window.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      var p = toCanvasCoords(t.clientX, t.clientY);
      if (typeof mouse !== 'undefined') {
        mouse.x = p.x;
        mouse.y = p.y;
      }
    });
  };

  console.log('[limn-click-patch] Installed.');
})();
