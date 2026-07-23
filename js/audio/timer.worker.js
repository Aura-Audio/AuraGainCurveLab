let intervalId = null;

self.onmessage = (event) => {
  const data = event.data || {};

  if (data.type === "start") {
    const intervalMs = Number(data.intervalMs) || 25;

    if (intervalId !== null) {
      clearInterval(intervalId);
    }

    intervalId = setInterval(() => {
      self.postMessage({ type: "tick" });
    }, intervalMs);
  }

  if (data.type === "stop") {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }

    intervalId = null;
  }
};
