  let com;
let refresh = false
let TCJSgameGameArea;
let commp = []
class Display {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.context = this.canvas.getContext("2d");
        this.frameNo = 0;
        this.clearMargin = []
        this.keys = [];
        this.x = false;
        this.fps = 0
        this.deltaTime = 0
        this.frame = 0
        this.cache = false
        
        this.y = false;
        this.interval = null;
        this.tile = null;
        this.map = null;
        this.tileFace = null
        this.mapWidth = this.canvas.width;
        this.mapHeight = this.canvas.height;
        this.scene = 0
        
        this.camera = new Camera(); // Initialize camera
    }

    start(width = 480, height = 270, no = document.body) {
        this.canvas.width = width;
        this.canvas.height = height;
        no.insertBefore(this.canvas, no.childNodes[0]);
        TCJSgameGameArea = new Component(width+100, height+100, "black", display.camera.x, display.camera.y)
        this.clearMargin = [width*width, height*height]
        this.mapWidth = this.canvas.width;
        this.mapHeight = this.canvas.height;
        this.addEventListeners();
        setInterval(() => {
            this.deltaTime = 1 / this.fps
            refresh = true
        }, 1000)
        // this.interval =
        this.interval = setInterval(() => this.updat(), 20);
        
    }

    addEventListeners() {
        window.addEventListener('keydown', (e) => {
            console.log("Key pressed:", e.keyCode);
            this.keys[e.keyCode] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });
        window.addEventListener('mousedown', (e) => {
            this.x = e.pageX + this.camera.x;
            this.y = e.pageY + this.camera.y;
        });
        window.addEventListener('mouseup', () => {
            this.x = false;
            this.y = false;
        });
        window.addEventListener('touchstart', (e) => {
            this.x = e.touches[0].pageX + this.camera.x;
            this.y = e.touches[0].pageY + this.camera.y;
        });
        window.addEventListener('touchend', () => {
            this.x = false;
            this.y = false;
        });
    }

    clear() {
        this.context.clearRect(0, 0, this.clearMargin[0], this.clearMargin[1]);
    }
    fullScreen(){
        this.canvas.requestFullscreen()
    }
    exitScreen(){
        document.exitFullscreen()
    }

    lgradient(to, c1, c2){
        this.canvas.style.background= ` linear-gradient(to ${to}, ${c1}, ${c2})`
    }
    rgradient(c1, c2){
        this.canvas.style.background= `radial-gradient(${c1}, ${c2})`
    }

    borderStyle(borderStyle) {
        this.canvas.style.borderStyle = borderStyle;
    }

    stop() {
        clearInterval(this.interval);
    }

    borderSize(borderSize) {
        this.canvas.style.borderSize = borderSize;
    }

    backgroundColor(color) {
        this.canvas.style.backgroundColor = color;
    }

    borderColor(color) {
        this.canvas.style.borderColor = color;
    }
    tileMap(){
        this.tileFace = new TileMap(this,this.map, this.tile,this.mapWidth, this.mapHeight)
        

    }
    fontColor(color) {
        this.canvas.style.color = color;
    }

    scale(width, height) {
        this.canvas.width = width;
        this.clearMargin = [width*width, height*height]
        this.canvas.height = height;
        TCJSgameGameArea.width = width+100
        TCJSgameGameArea.height = height+100
    }

    add(x, scene = 0) {
        com = {
            x : x,
            scene : scene
        }
        comm.push(com);
    }

    updat() {
        Mouse.x = mouse.x
        Mouse.y = mouse.y
        this.clear();
        this.frameNo += 1;
        this.context.save();
        if (this.camera.rotationShake !== 0) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            this.context.translate(centerX, centerY);
            this.context.rotate(this.camera.rotationShake);
            this.context.translate(-centerX, -centerY);
        }
        
        this.context.translate(-this.camera.x, -this.camera.y);
        try {
            update();
        } catch (e) {
            //console.error("Update error:", e);
        }
        comm.forEach(component => {
            if(component.scene == this.scene){
                if(component.x.angularMovement){
                  component.x.moveAngle()
                }else{
                  component.x.move();

                }
                try {
                    component.x.update(this.context);
                    
                } catch {
                    
                }
            }
        });
        this.context.restore();
    }
}

class Component {
    constructor(width = 0, height = 0, color = null, x = 0, y = 0, type) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.angularMovement = false
        this.type = type;
        this.angle = 0;
        this.x = x;
      this.aX = x
      this.aY = y
        this.y = y;
        this.speedX = 0;
        this.speedY = 0;
        this.gravity = 0;
        this.image = null;
        this.imageLoaded = false;
        this.gravitySpeed = 0;
        this.bounce = 0.6;
        this.physics = false;
        this.changeAngle = true;
        this.cam = true;

        if (type === "image") {
            this.image = new Image();
            this.image.src = this.color;
        }
    }
    setImage(src) {
        this.type = "image";
        this.image = new Image();
        this.imageLoaded = false;
        this.image.onload = () => {
            this.imageLoaded = true;
        };
        this.image.onerror = () => {
            console.error("Failed to load image:", src);
            this.type = "rect";
            this.color = "red";
        };
        this.image.src = src;
    }
    destroy(){
      let index = comm.findIndex(c => c.x ===this);
      if(index>-1)comm.splice(index,1)
      this.update = null
      
      index = commp.findIndex(c => c.x ===this);
      if(index>-1)commp.splice(index,1)
      this.update = null
    }
    setColor(newColor) {
        this.type = "rect";
        this.color = newColor;
        this.image = null;
        this.imageLoaded = false;
    }
  fixed(ctx=display){
    this.x = this.aX+ctx.camera.x
    this.y = this.aY+ctx.camera.y
  }
    setText(text, font = "20px Arial", color = "white") {
        this.type = "text";
        this.text = text;
        this.width = font;
        this.height = font;
        this.color = color;
        this.image = null;
    }
    enableCircleCollision(radius = null) {
        this.isCircle = true;
        this.radius = radius || Math.max(this.width, this.height) / 2;
    }
    
    crashWithCircle(other) {
        if (!other.isCircle) {
            return this.crashWith(other);
        }
        
        const dx = (this.x + this.width/2) - (other.x + other.width/2);
        const dy = (this.y + this.height/2) - (other.y + other.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.radius + other.radius);
    }
        
    update(ctx = display.context) {
        if (this.type === "text") {
            ctx.font = `${this.width} ${this.height}`;
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, this.x, this.y);
        } else if (this.changeAngle) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(this.angle);
            if (this.type === "image") {
                ctx.drawImage(this.image, this.width / -2, this.height / -2, this.width, this.height);
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.width / -2, this.height / -2, this.width, this.height);
            }
            ctx.restore();
        } else {
            if (this.type === "image") {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
    }
    bUpdate(ctx = display.context) {
        if (this.type === "text") {
            ctx.font = `${this.width} ${this.height}`;
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, this.x, this.y);
        } else if (this.changeAngle) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(this.angle);
            if (this.type === "image") {
                ctx.drawImage(this.image, this.width / -2, this.height / -2, this.width, this.height);
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.width / -2, this.height / -2, this.width, this.height);
            }
            ctx.restore();
        } else {
            if (this.type === "image") {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
    }

    moveAngle() {
        this.gravitySpeed += this.gravity;
        this.x += this.speedX * Math.cos(this.angle);
        this.y += this.speedY * Math.sin(this.angle) + this.gravitySpeed;
    }
    hide(){
        this.update = null;
    }
    show(){
        this.update = this.bUpdate
    }

    move() {
        if (this.physics) {
            this.gravitySpeed += this.gravity;
            this.x += this.speedX;
            this.y += this.speedY + this.gravitySpeed;
        } else {
            this.x += this.speedX;
            this.y += this.speedY;
        }
    }

    hitBottom(height = display.canvas.height) {
        const rockbottom = height - this.height;
        if (this.y > rockbottom) {
            this.y = rockbottom;
            this.gravitySpeed = -(this.gravitySpeed * this.bounce);
        }
    }

    stopMove() {
        this.speedX = 0;
        this.speedY = 0;
    }

    clicked() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const rotatedX = (display.x - centerX) * Math.cos(-this.angle) - (display.y - centerY) * Math.sin(-this.angle) + centerX;
        const rotatedY = (display.x - centerX) * Math.sin(-this.angle) + (display.y - centerY) * Math.cos(-this.angle) + centerY;

        const myleft = this.x;
        const myright = this.x + this.width;
        const mytop = this.y;
        const mybottom = this.y + this.height;
        let clicked = true;
        if ((mybottom < rotatedY) || (mytop > rotatedY) || (myright < rotatedX) || (myleft > rotatedX)) {
            clicked = false;
        }
        return clicked;
    }

    crashWith(otherobj) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const otherCenterX = otherobj.x + otherobj.width / 2;
        const otherCenterY = otherobj.y + otherobj.height / 2;

        const rotatedX = (otherCenterX - centerX) * Math.cos(-this.angle) - (otherCenterY - centerY) * Math.sin(-this.angle) + centerX;
        const rotatedY = (otherCenterX - centerX) * Math.sin(-this.angle) + (otherCenterY - centerY) * Math.cos(-this.angle) + centerY;

        const myleft = this.x;
        const myright = this.x + this.width;
        const mytop = this.y;
        const mybottom = this.y + this.height;
        const otherleft = rotatedX - otherobj.width / 2;
        const otherright = rotatedX + otherobj.width / 2;
        const othertop = rotatedY - otherobj.height / 2;
        const otherbottom = rotatedY + otherobj.height / 2;
        let crash = true;
        if ((mybottom < othertop) || (mytop > otherbottom) || (myright < otherleft) || (myleft > otherright)) {
            crash = false;
        }
        return crash;
    }
}

// ============================================
// LIMN ENGINE / TCJSGAME - AUDIO SYSTEM
// ============================================

class Sound {
    constructor(src, options = {}) {
        this.src = src;
        this.volume = options.volume !== undefined ? options.volume : 1;
        this.loop = options.loop || false;
        this.autoplay = options.autoplay || false;
        
        // Create audio element
        this.audio = new Audio();
        this.audio.src = src;
        this.audio.volume = this.volume;
        this.audio.loop = this.loop;
        
        // Loading state
        this.loaded = false;
        this.loading = false;
        this.error = null;
        
        // Preload by default
        this.audio.preload = "auto";
        this.audio.load();
        
        this.audio.addEventListener('canplaythrough', () => {
            this.loaded = true;
            if (this.autoplay) this.play();
        });
        
        this.audio.addEventListener('error', (e) => {
            this.error = e;
            console.error(`Sound failed to load: ${src}`);
        });
    }
    
    play(volume = this.volume) {
        if (!this.loaded) {
            console.warn(`Sound not loaded yet: ${this.src}`);
            return this;
        }
        
        // Clone for overlapping sounds (effects)
        if (this.loop === false && this.audio.currentTime > 0) {
            const clone = new Sound(this.src, { volume: volume });
            clone.play();
            return clone;
        }
        
        this.audio.volume = volume;
        this.audio.currentTime = 0;
        this.audio.play().catch(e => console.warn("Audio play prevented:", e));
        return this;
    }
    
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        return this;
    }
    
    pause() {
        this.audio.pause();
        return this;
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.volume;
        return this;
    }
    
    setLoop(loop) {
        this.loop = loop;
        this.audio.loop = loop;
        return this;
    }
    
    isPlaying() {
        return !this.audio.paused && this.audio.currentTime > 0;
    }
}

// ============================================
// SOUND MANAGER - FOR MULTIPLE SOUNDS
// ============================================

class SoundManager {
    constructor() {
        this.sounds = {};
        this.masterVolume = 1;
        this.musicVolume = 0.7;
        this.sfxVolume = 0.8;
        this.currentMusic = null;
        this.enabled = true;
    }
    
    // Load a sound (preloads it)
    load(name, src, options = {}) {
        this.sounds[name] = new Sound(src, options);
        return this.sounds[name];
    }
    
    // Play a sound by name
    play(name, volume = null) {
        if (!this.enabled) return null;
        
        const sound = this.sounds[name];
        if (!sound) {
            console.warn(`Sound not found: ${name}`);
            return null;
        }
        
        // Use appropriate volume based on type
        let finalVolume = volume;
        if (finalVolume === null) {
            finalVolume = name.startsWith('music_') ? this.musicVolume : this.sfxVolume;
        }
        finalVolume *= this.masterVolume;
        
        return sound.play(finalVolume);
    }
    
    // Stop a specific sound
    stop(name) {
        const sound = this.sounds[name];
        if (sound) sound.stop();
    }
    
    // Play background music (stops current)
    playMusic(name, loop = true) {
        if (!this.enabled) return;
        
        // Stop current music
        if (this.currentMusic) {
            this.currentMusic.stop();
        }
        
        const music = this.sounds[name];
        if (music) {
            music.setLoop(loop);
            music.setVolume(this.musicVolume * this.masterVolume);
            music.play();
            this.currentMusic = music;
        }
    }
    
    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
        }
    }
    
    // Global controls
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        // Update currently playing sounds
        for (let name in this.sounds) {
            this.sounds[name].setVolume(this.sounds[name].volume);
        }
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.currentMusic) {
            this.currentMusic.setVolume(this.musicVolume * this.masterVolume);
        }
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }
    
    mute() {
        this.enabled = false;
        for (let name in this.sounds) {
            this.sounds[name].pause();
        }
    }
    
    unmute() {
        this.enabled = true;
    }
    
    // Preload multiple sounds at once
    preload(soundList, callback) {
        let loaded = 0;
        const total = soundList.length;
        
        soundList.forEach(({name, src, options}) => {
            this.load(name, src, options);
            const checkInterval = setInterval(() => {
                if (this.sounds[name] && this.sounds[name].loaded) {
                    loaded++;
                    clearInterval(checkInterval);
                    if (loaded === total && callback) callback();
                }
            }, 50);
        });
    }
}

// ============================================
// INTEGRATION WITH YOUR MOVE UTILITY
// ============================================

// Add to your existing 'move' object


// ============================================
// EXAMPLE USAGE
// ============================================

/*
// Create sound manager
const soundManager = new SoundManager();
window.soundManager = soundManager; // Make global

// Load sounds
soundManager.load("coin", "sounds/coin.wav");
soundManager.load("hit", "sounds/hit.wav", { volume: 0.5 });
soundManager.load("explosion", "sounds/explosion.wav", { volume: 0.7 });
soundManager.load("music_theme", "sounds/theme.mp3", { loop: true });

// Preload everything before game starts
soundManager.preload([
    { name: "coin", src: "sounds/coin.wav" },
    { name: "hit", src: "sounds/hit.wav" },
    { name: "explosion", src: "sounds/explosion.wav" },
    { name: "music_theme", src: "sounds/theme.mp3", options: { loop: true } }
], () => {
    console.log("All sounds loaded!");
    soundManager.playMusic("music_theme");
});

// In your game code:
function update(dt) {
    // When collecting coin
    if (player.crashWith(coin)) {
        move.sound.play("coin");  // Easy!
    }
    
    // When enemy hits player
    if (player.crashWith(enemy)) {
        move.sound.play("hit");
    }
}

// Volume controls (for settings menu)
move.sound.setMasterVolume(0.8);
move.sound.setMusicVolume(0.5);
move.sound.setSFXVolume(0.7);
*/
let mouse = {
    x:0,
    y:0,
    down:false
}


window.addEventListener("mousedown",(e)=>{
    mouse.down = true
})
window.addEventListener("mouseup",(e)=>{
    mouse.down = false
})
let Mouse = new Component(10, 10, "white", mouse.x, mouse.y)
class Camera {
    constructor(x = 0, y = 0, worldWidth = 1000, worldHeight = 1000) {
        this.x = x;
        this.y = y;
        this.target = null;
        this.speed = 5;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.rotationShake = 0;
    }
    setZoom(amount){
        display.context.scale(amount,amount)
    }
    shakeRotation(angle = 0) {
        this.rotationShake = angle
        setTimeout(() => {
            this.rotationShake = 0
        }, 1000 / 24)
    }
    shake(x=0, y=0){
        this.x += x
        this.y += y
        setTimeout(()=>{
            this.x -= x
            this.y -=y
        }, 1000/24)
    
    
    }
    follow(target, smooth = false) {
        if (smooth) {
            this.x += (target.x - (this.x + display.canvas.width / 2)) * 0.1;
            this.y += (target.y  - (this.y + display.canvas.height / 2)) * 0.1;
        } else {
            this.x = target.x - display.canvas.width / 2;
            this.y = target.y - display.canvas.height / 2;
        }
        // Clamp camera to world bounds
        this.x = Math.max(0, Math.min(this.x, this.worldWidth - display.canvas.width));
        this.y = Math.max(0, Math.min(this.y, this.worldHeight - display.canvas.height));
    }
}

const comm = [];
let move ={
    backward : function(id, steps){
        id.speedX = -steps * Math.cos(id.angle);
        id.speedY = -steps * Math.sin(id.angle);
    },
    forward:function(id,steps){
        id.speedX = steps * Math.cos(id.angle);
        id.speedY = steps * Math.sin(id.angle);
    },
    teleport : function(id, x, y){
        id.x = x
        id.y = y
    },
    setX : function(id, x){
        id.x = x;
    },
    setY : function(id, y){
        id.y = y;
    },
    stamp : function(id){
        const stamped = new Component(id.width, id.height, id.color, id.x, id.y, id.type)
        
        return stamped;
    },
    circle : function(id, speed){
        id.physics = true;
        id.changeAngle = true
        id.angle += speed * Math.PI / 180;
    },
    dot : function(id){
        let ctx = display.context
        ctx.beginPath();
        ctx.arc(id.x,id.y,0,0,2*Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.stroke();
    },
    clearStamp : function(id){
        id.update = false;
    },
    turnLeft : function(id, steps){
        id.changeAngle = true
        id.angle += steps
    },
    turnRight : function(id, steps){
        id.changeAngle = true
        id.angle += -steps;
    },
    bound : function(id){
        if (id.x <= 0) id.x = 0;
        if (id.x+id.width >= display.canvas.width) id.x = display.canvas.width-id.width;
        if (id.y <= 0) id.y = 0;
        if (id.y+id.height >= display.canvas.height) id.y = display.canvas.height-id.height;
    },
    boundTo : function(id, left=false, right=false, top=false, bottom=false){
        if(left){
            if(id.x <= left){
                id.x = left;
            }
        }if(right){
            if(id.x >= right){
                id.x = right;
            }
        }if(top){
        
            if(id.y <= top){
                id.y = top;
        
            }
            
        }if(bottom){
            if(id.y >= bottom){
                id.y = bottom;
            }
        }
    
    },
    hitObject : function(id, otherid){
        id.physics = true;
      rockbottom = otherid.y
        if (id.y+id.height > rockbottom && id.crashWith(otherid)) {
          // console.log("Entered")
            id.y = rockbottom-id.height;
            id.gravitySpeed = -(id.gravitySpeed * id.bounce);
          // console.log(id.gravitySpeed)
        }    
    },
    glideX : function(id,duruation, x){
        let startX=id.x
        let startTime = performance.now();
        let progress
        let elsaed
        let easeOut
        let loop
        function upgl(currentTime) {
            elased=(currentTime - startTime)
            progress = Math.min(1,elased/duruation)
            easeOut = 1 - Math.pow(1-progress, 3)
            id.x= startX+ (x-startX)*easeOut
            if(progress<1){
                loop = requestAnimationFrame(upgl)
            }else{
                id.x = x
                id.speedX=0
                clearInterval(loop)
            }
            
            
        }
           loop = requestAnimationFrame(upgl)
           
        
        
    },
    glideY : function(id,duruation, y){
        let startY=id.y
        let startTime = performance.now();
        let progress
        let elsaed
        let easeOut
        let loop
        function upgl(currentTime) {
            elased=(currentTime - startTime)
            progress = Math.min(1,elased/duruation)
            easeOut = 1 - Math.pow(1-progress, 3)
            id.y= startY+ (y-startY)*easeOut
            if(progress<1){
                loop = requestAnimationFrame(upgl)
            }else{
                id.y = y
                id.speedY=0
                clearInterval(loop)
            }
            
            
        }
          loop = requestAnimationFrame(upgl)
           
        
        
    },
    glideTo: function (id,t, x,y){
        this.glideX(id,t, x )
        this.glideY(id, t, y)
    },
    project : function(id, initialVelocity, angle, gravity, ground=display.canvas.height) {
        // Convert angle to radians
        let radianAngle = angle * Math.PI / 180;
        let raf
        // Calculate the initial velocity components
        let velocityX = initialVelocity * Math.cos(radianAngle);
        let velocityY = initialVelocity * Math.sin(radianAngle);
        
        // Set the object's initial speed
        id.speedX = velocityX;
        id.speedY = -velocityY; // Negative because upward direction is negative in canvas
    
        // Update the object's position over time
        let updatePosition = () => {
            id.speedY += gravity; // Apply gravity to the vertical speed
            id.x += id.speedX;
            id.y += id.speedY;
    
            // Check for collision with the ground
            if (id.y >= ground - id.height) {
                id.y = ground - id.height;
                id.speedY = -(id.speedY * id.bounce); // Apply bounce effect
                if(Math.abs(Math.round(id.speedY)) == 0){
                    id.speedX = 0
                    gravity = 0
                    clearInterval(raf)
                }
                
            }
    
            // Continue updating the position
            if (id.y < display.canvas.height - id.height || id.speedY !== 0) {
                raf = requestAnimationFrame(updatePosition);
            }
        };
    
        // Start updating the position
        updatePosition();
    },
    pointTo : function(id, targetX, targetY) {
        // Calculate the difference in coordinates
        let deltaX = targetX - id.x;
        let deltaY = targetY - id.y;
    
        // Calculate the angle in radians
        let angleRadians = Math.atan2(deltaY, deltaX);
    
        // Set the component's angle
        id.angle = angleRadians;
    },
    // New accelerate function
    accelerate: function(id, accelX, accelY, maxSpeedX = Infinity, maxSpeedY = Infinity) {
        // Add acceleration to current speed
        id.speedX += accelX;
        id.speedY += accelY;

        // Clamp speeds to maxSpeed (or Infinity for unlimited)
        if (Math.abs(id.speedX) > maxSpeedX) {
            id.speedX = id.speedX > 0 ? maxSpeedX : -maxSpeedX;
        }
        if (Math.abs(id.speedY) > maxSpeedY) {
            id.speedY = id.speedY > 0 ? maxSpeedY : -maxSpeedY;
        }
    },
    // New decelerate function
    decelerate: function(id, decelX, decelY) {
        // Reduce speedX towards 0
        if (id.speedX > 0) {
            id.speedX -= decelX;
            if (id.speedX < 0) id.speedX = 0; // Prevent overshooting
        } else if (id.speedX < 0) {
            id.speedX += decelX;
            if (id.speedX > 0) id.speedX = 0; // Prevent overshooting
        }

        // Reduce speedY towards 0
        if (id.speedY > 0) {
            id.speedY -= decelY;
            if (id.speedY < 0) id.speedY = 0; // Prevent overshooting
        } else if (id.speedY < 0) {
            id.speedY += decelY;
            if (id.speedY > 0) id.speedY = 0; // Prevent overshooting
        }
    },
    position: function(id, direction, offset = 0) {
        switch (direction.toLowerCase()) {
            case "top":
                id.x = (display.canvas.width - id.width) / 2; // Center horizontally
                id.y = offset; // Offset from top
                break;
            case "bottom":
                id.x = (display.canvas.width - id.width) / 2; // Center horizontally
                id.y = display.canvas.height - id.height - offset; // Offset from bottom
                break;
            case "left":
                id.x = offset; // Offset from left
                id.y = (display.canvas.height - id.height) / 2; // Center vertically
                break;
            case "right":
                id.x = display.canvas.width - id.width - offset; // Offset from right
                id.y = (display.canvas.height - id.height) / 2; // Center vertically
                break;
            case "center":
                id.x = (display.canvas.width - id.width) / 2;
                id.y = (display.canvas.height - id.height) / 2;
                break;
            default:
                console.error("Invalid direction. Use 'top', 'bottom', 'left', or 'right'.");
        }
        // Reset speed to stop any movement after positioning
        id.speedX = 0;
        id.speedY = 0;
    }
    
    

}
let state = {
    distance : function(id, otherid){
        dis = Math.sqrt((Math.pow(id.x-otherid.x,2))+(Math.pow(id.y-otherid.y,2)))
        return dis;
    },
    rect : function(id){
        return [id.x, id.y, id.width, id.height]
    },
    physics :  function(id){
        return id.physics
    },
    changeAngle :  function(id){
        return id.changeAngle
    },
    Angle :  function(id){
        return id.angle
    },
    pos :  function(id){
        return id.x+','+id.y
    }
}
class Sprite extends Component {
    constructor(image, frameWidth, frameHeight, frameCount, frameSpeed, x = 0, y = 0) {
        // Call parent Component constructor
        // width = frameWidth, height = frameHeight
        // color = null (image handles color)
        // type = "image"
        
        super(frameWidth, frameHeight, image, x, y, "image");
        
        // Sprite-specific properties
        this.spriteImage = new Image();
        this.spriteImage.src = image
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.frameCount = frameCount;
        this.frameSpeed = frameSpeed;
        this.currentFrame = 0;
        this.frameTimer = 0;
        
        // Animation state
        this.loop = true;           // Whether animation loops
        this.paused = false;        // Pause animation
        this.onComplete = null;     // Callback when animation finishes
        this.flipX = false;         // Flip horizontally
        this.flipY = false;         // Flip vertically
        
        // Set the image for the Component
        this.image = image;
        this.imageLoaded = true;
    }
    
    // Update animation frame
    updateAnimation() {
        if (this.paused) return;
        
        this.frameTimer++;
        if (this.frameTimer >= this.frameSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;
            
            // Check for animation completion
            if (this.currentFrame >= this.frameCount) {
                if (this.loop) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = this.frameCount - 1;
                    this.paused = true;
                    if (this.onComplete) this.onComplete();
                }
            }
        }
    }
    
    // Override Component's update method
    update(ctx = display.context) {
        // Update animation every frame
        this.updateAnimation();
        
        // Apply transformations
        ctx.save();
        
        // Handle flipping
        let drawX = this.x;
        let drawY = this.y;
        let drawW = this.width;
        let drawH = this.height;
        
        if (this.flipX || this.flipY) {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        }
        
        // Draw the current frame from sprite sheet
        ctx.drawImage(
            this.spriteImage,
            this.currentFrame * this.frameWidth,
            0,
            this.frameWidth,
            this.frameHeight,
            drawX,
            drawY,
            drawW,
            drawH
        );
        
        ctx.restore();
    }
    
    // Alternative: Draw without auto-update (for manual control)
    drawFrame(ctx, frameIndex, x, y) {
        ctx.drawImage(
            this.spriteImage,
            frameIndex * this.frameWidth,
            0,
            this.frameWidth,
            this.frameHeight,
            x,
            y,
            this.width,
            this.height
        );
    }
    
    // Animation control methods
    play() {
        this.paused = false;
    }
    
    stop() {
        this.paused = true;
    }
    
    reset() {
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.paused = false;
    }
    
    gotoFrame(frame) {
        this.currentFrame = Math.min(frame, this.frameCount - 1);
        this.frameTimer = 0;
    }
    
    // Set animation to play once then stop
    playOnce(callback = null) {
        this.loop = false;
        this.paused = false;
        this.onComplete = callback;
        this.reset();
    }
    
    // Flip direction helpers
    faceLeft() {
        this.flipX = true;
    }
    
    faceRight() {
        this.flipX = false;
    }
    
    // Get current frame index
    getCurrentFrame() {
        return this.currentFrame;
    }
    
    // Check if animation is playing
    isPlaying() {
        return !this.paused;
    }
}
                

class Tile extends Component{
    constructor(tx, ty,tid,com) {
        super(com.width, com.height, com.color, com.x, com.y,com.type)
        this.x = com.x
        this.color = com.color
        this.tx = tx
        this.ty = ty
        this.tid = tid
        this.y = com.y
        this.width = com.width
        this.height = com.height

        this.type = com.type;
    }
}
let tileComm = [];
class TileMap {
    constructor(render, map, tile, width, height, scene = 0) {
        this.map = [map];
        this.width = width;
        this.height = height;
        fake.canvas.width = width
        fake.canvas.height = height
        this.tile = tile;
        this.tile.unshift(0);
        this.tileHeight = this.height / this.map[0].length;
        this.scene = scene;
        this.tileWidth = this.width / this.map[0][0].length;
        this.tileList = [];
        this.render = render;
    }
    
    show(layer=0) {
      tileComm = []
      fake.scene = layer
        let yy = 0;
        let tyy = 0;
        let xx = 0;
        this.tileList = [];
        
        for (let row = 0; row < this.map[layer].length; row++) {
            for (let col = 0; col < this.map[layer][row].length; col++) {
                const tileId = this.map[layer][row][col];
                if (tileId && this.tile[tileId]) {
                    const tileTemplate = this.tile[tileId];
                    const tile = new Tile(col, row, tileId, tileTemplate);
                    tile.width = this.tileWidth + 0.5; 
                    tile.height = this.tileHeight + 0.5;

                    tile.x = col * this.tileWidth;
                    tile.y = row * this.tileHeight;
                    this.tileList.push(tile);
                    // Add to fake canvas cache only
                    tileComm.push({x : tile, layer : layer})
                    
                    
                    
                }
            }
        }
    }
    addMap(map){
      this.map.push(map)
    }
    tiles(id = 0) {
        if (id === 0) return this.tileList;
        return this.tileList.filter(tile => tile.tid === id);
    }
    
    crashWith(obj, id = 0) {
        const tilesToCheck = id === 0 ? this.tileList : this.tileList.filter(tile => tile.tid === id);
        return tilesToCheck.some(tile => tile.crashWith(obj));
    }
    
    add(id, tx, ty,layer=0) {
        if (this.map[layer][ty] && this.map[layer][ty][tx] !== undefined) {
            this.map[layer][ty][tx] = id;
            this.show(); // Refresh tilemap
            fake.refresh()
        }
    }
    
    remove(tx, ty,layer=0) {
        if (this.map[layer][ty] && this.map[layer][ty][tx] !== undefined) {
            this.map[layer][ty][tx] = 0;
            this.show(); // Refresh tilemap
            fake.refresh()
        }
    }
    
    rTile(tx, ty) {
        return this.tileList.find(t => t.tx === tx && t.ty === ty);
    }
}
//tcFont
class Tctxt extends Component{
    constructor(size = "16px", font = "Arial", color = "black", x = 0, y = 0, 
                align = "left", storke = false, baseline = "hanging", 
                background = null, paddingX = 0, paddingY = 0) {
        super(size, font, color, x, y, "text")
        this.size = size
        this.font = font
        this.color = color
        this.x = x
        this.y = y
        this.align = align
        this.storke = storke
        this.text = ""
        this.baseline = baseline
        this.background = background
        this.paddingX = paddingX
        this.paddingY = paddingY
    }
    update(ctx=display.context){
        this.rect()
        if(this.storke){
            ctx.font =  `${this.size} ${this.font}`;

            ctx.strokeStyle = this.color
            ctx.textBaseline = this.baseline
            ctx.textAlign = this.align
            this.textWidth = ctx.measureText(this.text).width
            ctx.strokeText(this.text, this.x, this.y)
            
        }else{
            ctx.font = `${this.size} ${this.font}`;
            ctx.fillStyle = this.color
            ctx.textBaseline = this.baseline
            ctx.textAlign = this.align
            this.textWidth = ctx.measureText(this.text).width
            ctx.fillText(this.text, this.x, this.y)
        }
    }
    bUpdate(ctx = display.context){
        this.rect()
        if(this.storke){
            ctx.font = this.size+ " "+ this.font
            ctx.strokeStyle = this.color
            ctx.textAlign = this.align
            this.textWidth = ctx.measureText(this.text).width
            ctx.textBaseline = this.baseline
            
            ctx.strokeText(this.text, this.x, this.y)
        }else{
            ctx.font = this.size+ " "+ this.font
            ctx.fillStyle = this.color
            ctx.textAlign = this.align
            this.textWidth = ctx.measureText(this.text).width
            ctx.textBaseline = this.baseline
            
            ctx.fillText(this.text, this.x, this.y)
        }
    }
    setText(txt){
        this.text = txt
        return this.text
    }
    rect(ctx = display.context){
        let xx = this.x
        let yy = this.y
        if(this.align == "right"){
            xx = this.x - this.textWidth
        }
        if(this.align == "center"){
            xx = this.x - this.textWidth/2
        }
        ctx.fillStyle = this.background
        ctx.fillRect(xx-this.paddingX/2, this.y-this.paddingY/2, this.textWidth+ this.paddingX, Number(this.size.replace("px", ""))+this.paddingY)
    }
}
//sonic.js

    
    
    let fake = new Display()
    fake.scene = 0
    
    fake.start = function(width = 480, height = 270, no = document.body) {
        fake.canvas.width = width
        fake.canvas.height = height
        // Hide the fake canvas - it's just an offscreen buffer
        fake.canvas.style.display = "none"
        no.appendChild(this.canvas)
        no.insertBefore(this.canvas, no.childNodes[1])// Add to DOM but hidden
        fake.mapWidth = fake.canvas.width
        fake.mapHeight = fake.canvas.height
        // Add event listeners for fake canvas if needed
        fake.addEventListeners()
    }
    fake.bgComm = false;
    fake.add = function(x, scene = 0) {
        com = {
            x: x,
            scene: scene
        }
        commp.push(com);
    }
    
    // Remove or update fake.updat since it's handled by ani() now
    fake.updat = function() {
        // This function is no longer needed since ani() handles fake canvas rendering
        console.log("fake.updat is deprecated - use ani() instead")
    }
    
    fake.refresh = function() {
        fake.clear()
        display.once = true;
        // Don't call fake.updat() here - the ani() loop handles rendering
        // If you need to force a refresh, you might need to modify the approach
    }
    
    
    fake.borderColor("green")
    fake.borderSize("12px")
    fake.borderStyle("groove")
      Display.prototype.perform = function () {
    Display.prototype.start = function(width = 480, height = 270, no = document.body) {
        this.canvas.width = width;
        this.canvas.height = height;
        no.insertBefore(this.canvas, no.childNodes[0]);
        this.clearMargin = [width*width, height*height]
        console.log(display.clearMargin)
        TCJSgameGameArea = new Component(display.clearMargin[0], display.clearMargin[1], "black", display.camera.x, display.camera.y)
        this.interval = ani()
        display.timing = 0
        this.mapWidth = this.canvas.width;
        this.mapHeight = this.canvas.height;
        this.cachePic;
        this.time;
        this.deltaTime = 0
        this.timeFromPreviousFrames = 0
        display.contTime = 1;//develop's business
        this.addEventListeners();
        this.once = true
        fake.start()
    }
}
      function ani(time) {
        display.frame++
        display.timeFromAllFrames = time
        
        display.deltaTime = display.timeFromAllFrames - display.timeFromPreviousFrames
        
        display.time =time
        
        display.timing = display.time - display.contTime
        if(time< 1000){
          display.deltaTime = 0
        }else{
          //display.deltaTime = 1 / display.fps
        }
        
        // Update delta time logic
        
       if(display.timing>=1000){
        display.contTime = display.time

         display.fps = display.frame
          display.frame = 0
          refresh = false
          
          //display.deltaTime = 1 / display.fps
       }
        
        //if (refresh) {
            
        //}
        // STEP 1: Render to fake canvas (offscreen buffer)
        
        if(display.once){
        fake.context.clearRect(0,0,fake.canvas.width, fake.canvas.height)
        fake.context.save()
        fake.context.translate(-fake.camera.x, -fake.camera.y)
        if(fake.bgComm){
          //garii
           if(fake.bgComm.angularMovement){
                  fake.bgComm.moveAngle()
                }else{
                  fake.bgComm.move();

                }
                        try {
                            fake.bgComm.update(fake.context);
                        } catch {
                            //pass
                        }
        }
        // Render all components to fake canvas
        tileComm.forEach(component => {
                    if(component.layer == fake.scene){

                        if(component.x.angularMovement){
                  component.x.moveAngle()
                }else{
                  component.x.move();

                }
                        try {
                            component.x.update(fake.context);
                        } catch {
                            //pass
                        }
                    }
                });
        commp.forEach(component => {
            if (component.scene == fake.scene) {
                if(component.x.angularMovement){
                  component.x.moveAngle()
                }else{
                  component.x.move();

                }
                try {
                    // Use the bUpdate method which doesn't have angle transformations
                    component.x.bUpdate(fake.context)
                } catch (e) {
                    console.error("Fake canvas render error:", e)
                }
            }
        })
        fake.context.restore()
          if (display.frame > 2) {
            display.once = false
            //display.cachePic = new Component(fake.canvas.width, fake.canvas.height,
            //fake.canvas.toDataURL(),
            //0, 0, "image")
          }
        }
        // STEP 2: Now render fake canvas content to main display
        display.clear()
        display.context.save()
        if (display.camera.rotationShake !== 0) {
            const centerX = display.canvas.width / 2;
            const centerY = display.canvas.height / 2;
            display.context.translate(centerX, centerY);
            display.context.rotate(display.camera.rotationShake);
            display.context.translate(-centerX, -centerY);
        }
        
        display.context.translate(-display.camera.x, -display.camera.y)
        
        // Draw the cached fake canvas as an image to main display
        
        
        
          display.context.drawImage(fake.canvas,0,0)
        
          
        
        
        // Update game logic
        try {
            update(dt = display.deltaTime/1000) // Pass deltaTime to your update function
        } catch (e) {
            console.error("Update error:", e)
        }
        
        // Render the cached image to main display
        
        
        // Also render any dynamic components that need real-time updates
        comm.forEach(component => {
            if (component.scene == display.scene) {
                if(component.x.angularMovement){
                  component.x.moveAngle()
                }else{
                  component.x.move();

                }
                if(TCJSgameGameArea.crashWith(component.x)){
                    try {
                        component.x.update(display.context)
                    } catch (e) {
                        // console.error("Main display render error:", e)
                    }
                }
            }
        })
        display.timeFromPreviousFrames = time
              
        display.context.restore()
        return requestAnimationFrame(ani)
    }
    class Particle extends Component {
    constructor(x, y, options = {}) {
        // Default values
        const width = options.width || 4;
        const height = options.height || 4;
        const color = options.color || "white";
        
        super(width, height, color, x, y, options.type || "rect");
        
        // Particle properties
        this.life = options.life || 60; // frames until death
        this.maxLife = this.life;
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 0.98;
        this.alpha = options.alpha !== undefined ? options.alpha : 1;
        this.alphaFade = options.alphaFade !== undefined ? options.alphaFade : 0.02;
        this.scale = options.scale || 1;
        this.scaleFade = options.scaleFade || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        
        // Velocity
        this.speedX = options.speedX || 0;
        this.speedY = options.speedY || 0;
        
        // Optional: store original color for fading
        this.originalColor = color;
        
        // Mark as particle
        this.isParticle = true;
    }
    
    update(ctx = display.context) {
        if (this.life <= 0) return false; // Mark for removal
        
        // Apply physics
        this.speedY += this.gravity;
        this.speedX *= this.friction;
        this.speedY *= this.friction;
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Apply rotation
        this.angle += this.rotationSpeed;
        
        // Fade out alpha
        this.alpha -= this.alphaFade;
        
        // Scale down
        this.scale -= this.scaleFade;
        
        // Decrease life
        this.life--;
        
        // Save current context state
        ctx.save();
        
        // Apply transformations
        if (this.scale !== 1 || this.alpha !== 1) {
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(this.scale, this.scale);
            ctx.translate(-(this.x + this.width/2), -(this.y + this.height/2));
        }
        
        // Apply alpha
        if (this.alpha < 1) {
            if (this.type === "image") {
                ctx.globalAlpha = this.alpha;
            } else {
                // Parse color and add alpha
                let colorWithAlpha = this.color;
                if (this.color.startsWith("rgb")) {
                    colorWithAlpha = this.color.replace("rgb", "rgba").replace(")", `, ${this.alpha})`);
                } else if (this.color.startsWith("#")) {
                    // For hex colors, we'll just use globalAlpha
                    ctx.globalAlpha = this.alpha;
                } else {
                    // Named colors
                    ctx.globalAlpha = this.alpha;
                }
                if (colorWithAlpha !== this.color) {
                    ctx.fillStyle = colorWithAlpha;
                }
            }
        }
        
        // Draw the particle
        if (this.type === "image" && this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width * this.scale, this.height * this.scale);
        } else if (this.type === "circle") {
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            super.update(ctx);
        }
        
        // Restore context
        ctx.restore();
        
        return this.life > 0 && this.alpha > 0;
    }
}

class ParticleSystem {
    constructor(display) {
        this.display = display;
        this.particles = [];
        this.emitters = [];
    }
    
    // Create a single particle
    emit(x, y, options = {}) {
        const particle = new Particle(x, y, options);
        this.particles.push(particle);
        this.display.add(particle);
        return particle;
    }
    
    // Create multiple particles at once
    burst(x, y, count, options = {}) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const opts = { ...options };
            
            // Add random letiation if not specified
            if (options.randomSpeed !== false) {
                opts.speedX = (options.speedX || 0) + (Math.random() - 0.5) * (options.randomSpeed || 2);
                opts.speedY = (options.speedY || 0) + (Math.random() - 0.5) * (options.randomSpeed || 2);
            }
            
            if (options.randomLife) {
                opts.life = (options.life || 60) + Math.random() * options.randomLife;
            }
            
            if (options.randomColor && options.colors) {
                opts.color = options.colors[Math.floor(Math.random() * options.colors.length)];
            }
            
            particles.push(this.emit(x, y, opts));
        }
        return particles;
    }
    
    // Create an continuous emitter
    createEmitter(x, y, options = {}) {
        const emitter = {
            x: x,
            y: y,
            active: true,
            rate: options.rate || 10, // particles per second
            frameCounter: 0,
            options: options,
            
            update: () => {
                if (!emitter.active) return;
                
                // Calculate particles to emit this frame (based on 60fps)
                const particlesPerFrame = emitter.rate / 60;
                emitter.frameCounter += particlesPerFrame;
                
                while (emitter.frameCounter >= 1) {
                    let opts = { ...emitter.options };
                    
                    // Apply randomness
                    if (emitter.options.randomSpread) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = emitter.options.speed || 2;
                        opts.speedX = Math.cos(angle) * speed * (Math.random() * 0.5 + 0.75);
                        opts.speedY = Math.sin(angle) * speed * (Math.random() * 0.5 + 0.75);
                    }
                    
                    if (emitter.options.randomOffset) {
                        const offsetX = (Math.random() - 0.5) * emitter.options.randomOffset;
                        const offsetY = (Math.random() - 0.5) * emitter.options.randomOffset;
                        this.emit(emitter.x + offsetX, emitter.y + offsetY, opts);
                    } else {
                        this.emit(emitter.x, emitter.y, opts);
                    }
                    
                    emitter.frameCounter--;
                }
            },
            
            stop: () => { emitter.active = false; },
            start: () => { emitter.active = true; },
            setPosition: (newX, newY) => { emitter.x = newX; emitter.y = newY; }
        };
        
        this.emitters.push(emitter);
        return emitter;
    }
    
    // Update all particles and remove dead ones
    update() {
        // Update emitters
        this.emitters.forEach(emitter => emitter.update());
        
        // Remove dead particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            if (particle.life <= 0 || particle.alpha <= 0) {
                // Remove from display
                const index = comm.findIndex(c => c.x === particle);
                if (index > -1) comm.splice(index, 1);
                // Remove from particle array
                this.particles.splice(i, 1);
            }
        }
    }
    
    // Clear all particles
    clear() {
        this.particles.forEach(particle => {
            const index = comm.findIndex(c => c.x === particle);
            if (index > -1) comm.splice(index, 1);
        });
        this.particles = [];
        this.emitters = [];
    }
}

// Add particle helper functions to your 'move' utility
move.particles = {
    // Explosion effect
    explosion: function(particleSystem, x, y, intensity = 30) {
        particleSystem.burst(x, y, intensity, {
            speedX: 0,
            speedY: 0,
            randomSpeed: 5,
            life: 30,
            randomLife: 20,
            gravity: 0.2,
            friction: 0.95,
            alphaFade: 0.03,
            scale: 1,
            scaleFade: 0.02,
            colors: ["#ff6600", "#ff4400", "#ff2200", "#ffaa00"],
            randomColor: true,
            width: 6,
            height: 6,
            type: "circle"
        });
    },
    
    // Smoke trail
    smoke: function(particleSystem, x, y) {
        return particleSystem.emit(x, y, {
            width: 8,
            height: 8,
            color: "rgba(100,100,100,0.8)",
            life: 40,
            speedX: (Math.random() - 0.5) * 1,
            speedY: (Math.random() - 0.5) * 1 - 1,
            gravity: -0.05,
            friction: 0.98,
            alphaFade: 0.02,
            scale: 1,
            scaleFade: 0.01,
            type: "circle"
        });
    },
    
    // Sparkle / Star effect
    sparkle: function(particleSystem, x, y) {
        particleSystem.burst(x, y, 5, {
            width: 3,
            height: 3,
            color: "#ffff00",
            life: 20,
            randomSpeed: 3,
            gravity: 0,
            friction: 0.95,
            alphaFade: 0.05,
            type: "circle"
        });
    },
    
    // Rain effect
    rain: function(particleSystem, x, y, intensity = 1) {
        for (let i = 0; i < intensity; i++) {
            particleSystem.emit(x + Math.random() * 800, y + Math.random() * 100, {
                width: 2,
                height: 8,
                color: "rgba(100,150,255,0.6)",
                life: 60,
                speedX: 0,
                speedY: 5 + Math.random() * 3,
                gravity: 0,
                friction: 1,
                alphaFade: 0.01,
                type: "rect"
            });
        }
    },
    
    // Blood effect (for combat games)
    blood: function(particleSystem, x, y, amount = 15) {
        particleSystem.burst(x, y, amount, {
            width: 4,
            height: 4,
            colors: ["#cc0000", "#990000", "#ff0000", "#8b0000"],
            randomColor: true,
            life: 45,
            randomLife: 30,
            randomSpeed: 4,
            gravity: 0.3,
            friction: 0.97,
            alphaFade: 0.02,
            type: "circle"
        });
    },
    
    // Magic / energy effect
    magic: function(particleSystem, x, y) {
        const colors = ["#ff00ff", "#00ffff", "#ffffff", "#ff66ff"];
        return particleSystem.burst(x, y, 20, {
            width: 5,
            height: 5,
            colors: colors,
            randomColor: true,
            life: 25,
            randomSpeed: 3,
            gravity: -0.1,
            friction: 0.96,
            alphaFade: 0.04,
            rotationSpeed: 0.1,
            type: "rect"
        });
    }
};
class AnimatedSprite extends Sprite {
    constructor(image, frameWidth, frameHeight, x, y) {
        super(image, frameWidth, frameHeight, 1, 1, x, y);
        this.animations = {};
        this.currentAnim = null;
    }
    
    // Define animation by frame range
    addAnimation(name, startFrame, endFrame, speed, loop = true) {
        this.animations[name] = {
            start: startFrame,
            end: endFrame,
            speed: speed,
            loop: loop,
            currentFrame: startFrame,
            timer: 0
        };
    }
    
    playAnimation(name) {
        if (this.currentAnim === name) return;
        this.currentAnim = name;
        const anim = this.animations[name];
        this.currentFrame = anim.start;
        this.frameSpeed = anim.speed;
        this.loop = anim.loop;
    }
    
    // Override updateAnimation to use frame ranges
    updateAnimation() {
        if (this.paused || !this.currentAnim) return;
        
        const anim = this.animations[this.currentAnim];
        this.frameTimer++;
        
        if (this.frameTimer >= this.frameSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;
            
            if (this.currentFrame > anim.end) {
                if (this.loop) {
                    this.currentFrame = anim.start;
                } else {
                    this.currentFrame = anim.end;
                    this.paused = true;
                }
            }
        }
    }
}
move.sound = {
    play: (name) => {
        if (window.soundManager) window.soundManager.play(name);
    },
    playMusic: (name) => {
        if (window.soundManager) window.soundManager.playMusic(name);
    },
    stopMusic: () => {
        if (window.soundManager) window.soundManager.stopMusic();
    },
    setMasterVolume: (vol) => {
        if (window.soundManager) window.soundManager.setMasterVolume(vol);
    },
    mute: () => {
        if (window.soundManager) window.soundManager.mute();
    },
    unmute: () => {
        if (window.soundManager) window.soundManager.unmute();
    }
};
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
              
