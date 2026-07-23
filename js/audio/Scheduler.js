export class Scheduler {
  constructor({ intervalMs = 25, onTick }) {
    this.intervalMs = intervalMs;
    this.onTick = onTick;
    this.worker = null;
    this.fallbackTimer = null;
  }

  start() {
    this.stop();

    try {
      this.worker = new Worker(new URL("./timer.worker.js", import.meta.url));

      this.worker.onmessage = () => {
        if (this.onTick) {
          this.onTick();
        }
      };

      this.worker.onerror = () => {
        this.cleanupWorker();
        this.startFallback();
      };

      this.worker.postMessage({
        type: "start",
        intervalMs: this.intervalMs
      });
    } catch {
      this.worker = null;
      this.startFallback();
    }
  }

  stop() {
    this.cleanupWorker();

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  startFallback() {
    if (!this.fallbackTimer) {
      this.fallbackTimer = setInterval(() => {
        if (this.onTick) {
          this.onTick();
        }
      }, this.intervalMs);
    }
  }

  cleanupWorker() {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "stop" });
        this.worker.terminate();
      } catch {
        // Ignore worker cleanup errors.
      }

      this.worker = null;
    }
  }
}
