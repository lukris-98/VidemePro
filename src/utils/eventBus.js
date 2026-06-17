const listeners = new Map();

export function onEvent(type, handler) {
  const handlers = listeners.get(type) ?? new Set();
  handlers.add(handler);
  listeners.set(type, handlers);
  return () => offEvent(type, handler);
}

export function offEvent(type, handler) {
  listeners.get(type)?.delete(handler);
}

export function emitEvent(type, payload = {}) {
  const event = { type, payload, timestamp: Date.now() };
  listeners.get(type)?.forEach((handler) => handler(event));
  listeners.get("*")?.forEach((handler) => handler(event));
  return event;
}

export function clearEventListeners(type) {
  if (type) listeners.delete(type);
  else listeners.clear();
}
