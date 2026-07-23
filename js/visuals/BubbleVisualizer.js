export class BubbleVisualizer {
  constructor({ canvas, getTime }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getTime = getTime;

    this.enabled = false;
    this.queue = [];
    this.bubbles = [];

    this.frameId = null;
    this.lastFrameTime = performance.now();

    this.width = 0;
    this.height = 0;
    this.backgroundGradient = null;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);

    window.addEventListener("resize", this.resize);

    this.resize();
    this.drawStatic();
  }

  setEnabled(enabled) {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      this.lastFrameTime = performance.now();

      if (!this.frameId) {
        this.frameId = requestAnimationFrame(this.loop);
      }
    } else {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }

      this.queue.length = 0;
      this.bubbles.length = 0;
      this.drawStatic();
    }
  }

  scheduleBubble(time, size = 0.5) {
    if (!this.enabled) {
      return;
    }

    this.queue.push({ time, size });

    if (this.queue.length > 300) {
      this.queue.splice(0, this.queue.length - 300);
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);

    this.width = width;
    this.height = height;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.backgroundGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    this.backgroundGradient.addColorStop(0, "#071522");
    this.backgroundGradient.addColorStop(1, "#0d2c44");

    if (!this.enabled) {
      this.drawStatic();
    }
  }

  drawStatic() {
    if (!this.ctx) {
      return;
    }

    this.ctx.fillStyle = this.backgroundGradient || "#071522";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  loop(now) {
    if (!this.enabled) {
      return;
    }

    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.draw(dt);

    this.frameId = requestAnimationFrame(this.loop);
  }

  draw(dt) {
    const now = typeof this.getTime === "function" ? this.getTime() : 0;

    this.ctx.fillStyle = this.backgroundGradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    while (this.queue.length) {
      const event = this.queue[0];

      if (event.time < now - 0.5) {
        this.queue.shift();
        continue;
      }

      if (event.time <= now + 0.05) {
        this.spawn(event.size);
        this.queue.shift();
        continue;
      }

      break;
    }

    for (let i = this.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = this.bubbles[i];

      bubble.y -= bubble.speed * dt;
      bubble.phase += dt * 2;

      if (bubble.y + bubble.radius < -24) {
        this.bubbles.splice(i, 1);
        continue;
      }

      const x = bubble.x + Math.sin(bubble.phase) * bubble.wobbleAmount;
      const y = bubble.y;
      const r = bubble.radius;

      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);

      this.ctx.fillStyle = `hsla(${bubble.hue}, 85%, 82%, ${bubble.alpha * 0.16})`;
      this.ctx.fill();

      this.ctx.strokeStyle = `hsla(${bubble.hue}, 85%, 78%, ${bubble.alpha})`;
      this.ctx.lineWidth = 1.4;
      this.ctx.stroke();
    }
  }

  spawn(size) {
    const radius = 2 + Math.random() * (5 + size * 22);

    this.bubbles.push({
      x: Math.random() * this.width,
      y: this.height + radius,
      radius,
      speed: 18 + (1 - size) * 55 + Math.random() * 35,
      phase: Math.random() * Math.PI * 2,
      wobbleAmount: 4 + Math.random() * 14,
      alpha: 0.15 + Math.random() * 0.45,
      hue: 190 + Math.random() * 40
    });

    if (this.bubbles.length > 180) {
      this.bubbles.splice(0, this.bubbles.length - 180);
    }
  }

  destroy() {
    window.removeEventListener("resize", this.resize);

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}
