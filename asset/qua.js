/* ═══════════════════════════════════════════════════════════════════
   LIMN QUALITY PATCH — DPR-aware rendering + pixel-art mode + SSAA
   Replaces Display.prototype.start. Legacy calls still work.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    if (typeof Display === 'undefined') {
        console.warn('[limn-quality] Display not found. Load after epic.js.');
        return;
    }

    var _originalStart = Display.prototype.start;

    Display.prototype.start = function (width, height, no, opts) {
        width  = width  || 480;
        height = height || 270;
        no     = no     || document.body;
        opts   = opts   || {};

        // ─── Resolve options with legacy defaults ───
        var pixelRatio = opts.pixelRatio === undefined
            ? 1
            : (opts.pixelRatio === 'auto'
                ? (window.devicePixelRatio || 1)
                : Math.max(1, Number(opts.pixelRatio) || 1));

        var pixelArt     = !!opts.pixelArt;
        var alpha        = opts.alpha !== undefined ? !!opts.alpha : true;
        var supersample  = Math.max(1, Number(opts.supersample) || 1);

        // ─── Store on the instance so users can read/tweak them ───
        this._logicalWidth   = width;
        this._logicalHeight  = height;
        this._pixelRatio     = pixelRatio;
        this._pixelArt       = pixelArt;
        this._supersample    = supersample;

        // ─── Configure the canvas backing store ───
        var backingW = Math.floor(width  * pixelRatio);
        var backingH = Math.floor(height * pixelRatio);

        this.canvas.width  = backingW;
        this.canvas.height = backingH;

        // CSS size = logical size (the browser scales down for display)
        this.canvas.style.width  = width  + 'px';
        this.canvas.style.height = height + 'px';

        // Crisp edges for pixel-art games
        this.canvas.style.imageRendering = pixelArt ? 'pixelated' : 'auto';

        // ─── Re-acquire the context with quality flags ───
        // (getContext returns the same instance, so we can pass options only once;
        //  if this is a re-start, we just reuse what we have.)
        if (!this.context) {
            this.context = this.canvas.getContext('2d', {
                alpha: alpha,
                willReadFrequently: false,
                desynchronized: false
            });
        }

        // Smoothing: off for pixel art, on by default
        this.context.imageSmoothingEnabled = !pixelArt;
        if (!pixelArt) {
            this.context.imageSmoothingQuality = 'high';
        }

        // ─── Apply DPR scale so game code thinks in logical pixels ───
        // Every subsequent draw call uses logical coordinates.
        this._applyBaseScale();

        // ─── Insert into DOM ───
        if (!this.canvas.parentNode) {
            no.insertBefore(this.canvas, no.childNodes[0]);
        }

        // ─── Legacy engine setup ───
        this.clearMargin = [width * width, height * height];
        this.mapWidth    = this.canvas.width;
        this.mapHeight   = this.canvas.height;

        TCJSgameGameArea = new Component(
            width + 100, height + 100, "black",
            display.camera.x, display.camera.y
        );

        // ─── Start the animation loop ───
        this.interval   = ani();
        display.timing  = 0;
        this.cachePic   = null;
        this.time       = 0;
        this.deltaTime  = 0;
        this.timeFromPreviousFrames = 0;
        display.contTime = 1;
        this.addEventListeners();
        this.once = true;

        // ─── Configure the fake (offscreen) canvas for supersampling ───
        if (supersample > 1) {
            this._setupSupersample(supersample);
        }

        fake.start();
    };

    /* ─────────────────────────────────────────────────────────────
       _applyBaseScale — applies (or re-applies) the DPR transform.
       Must be called after every context.save()/restore() cycle
       that resets the transform.
       ───────────────────────────────────────────────────────────── */
    Display.prototype._applyBaseScale = function () {
        if (this._pixelRatio === 1) return;
        // Reset transform, then scale once. Game code uses logical coords.
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.scale(this._pixelRatio, this._pixelRatio);
    };

    /* ─────────────────────────────────────────────────────────────
       _setupSupersample — renders the fake canvas at `factor`× the
       main canvas resolution, then blits it downscaled for free AA.
       ───────────────────────────────────────────────────────────── */
    Display.prototype._setupSupersample = function (factor) {
        this._ssaaFactor = factor;

        // Cache the original dimensions the tilemap system set
        var fw = fake.canvas.width  || this._logicalWidth;
        var fh = fake.canvas.height || this._logicalHeight;

        fake.canvas.width  = Math.floor(fw * factor);
        fake.canvas.height = Math.floor(fh * factor);

        // Preserve game-visible logical size for tile math
        fake._logicalWidth  = fw;
        fake._logicalHeight = fh;

        // Scale the fake context so tile drawing still uses logical coords
        fake.context.setTransform(factor, 0, 0, factor, 0, 0);

        console.log('[limn-quality] Supersampling enabled at ' + factor + 'x');
    };

    /* ─────────────────────────────────────────────────────────────
       Runtime toggle helpers
       ───────────────────────────────────────────────────────────── */
    Display.prototype.setPixelArt = function (on) {
        this._pixelArt = !!on;
        this.context.imageSmoothingEnabled = !this._pixelArt;
        this.canvas.style.imageRendering = this._pixelArt ? 'pixelated' : 'auto';
    };

    Display.prototype.setPixelRatio = function (ratio) {
        var newRatio = (ratio === 'auto')
            ? (window.devicePixelRatio || 1)
            : Math.max(1, Number(ratio) || 1);

        if (newRatio === this._pixelRatio) return;

        this._pixelRatio = newRatio;
        this.canvas.width  = Math.floor(this._logicalWidth  * newRatio);
        this.canvas.height = Math.floor(this._logicalHeight * newRatio);

        // Re-acquire context after resize (resizing clears it)
        this.context = this.canvas.getContext('2d');
        this.context.imageSmoothingEnabled = !this._pixelArt;
        this._applyBaseScale();
    };

    console.log('[limn-quality] Installed. Options: ' +
                '{ pixelRatio, pixelArt, alpha, supersample }');
})();
