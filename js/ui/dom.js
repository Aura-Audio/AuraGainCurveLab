export function qs(selector, root = document) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
