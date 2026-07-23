export function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomStepped(min, max, step) {
  const raw = randomInRange(min, max);
  const stepped = Math.round(raw / step) * step;
  return Number(stepped.toFixed(3));
}

export function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function poissonInterval(rate) {
  const safeRate = Math.max(0.1, rate);
  return -Math.log(1 - Math.random()) / safeRate;
}
