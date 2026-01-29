// ============================================================================
// DOM UTILITIES
// Helper functions for DOM manipulation
// ============================================================================

/**
 * Creates an element with optional attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Partial<HTMLElementTagNameMap[K]> & {
    class?: string;
    data?: Record<string, string>;
  },
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attrs) {
    const { class: className, data, ...rest } = attrs;

    if (className) {
      el.className = className;
    }

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        el.dataset[key] = value;
      }
    }

    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (value !== undefined && value !== null) {
        (el as any)[key] = value;
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }

  return el;
}

/**
 * Shorthand for createElement
 */
export const h = createElement;

/**
 * Creates a text node
 */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/**
 * Clears all children from an element
 */
export function clearChildren(el: Element): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Replaces all children of an element
 */
export function replaceChildren(
  el: Element,
  ...children: (Node | string)[]
): void {
  clearChildren(el);
  for (const child of children) {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
}

/**
 * Adds a CSS class with optional animation
 */
export function addClass(el: Element, className: string): void {
  el.classList.add(className);
}

/**
 * Removes a CSS class
 */
export function removeClass(el: Element, className: string): void {
  el.classList.remove(className);
}

/**
 * Toggles a CSS class
 */
export function toggleClass(
  el: Element,
  className: string,
  force?: boolean,
): void {
  el.classList.toggle(className, force);
}

/**
 * Waits for a CSS animation/transition to complete (with timeout fallback)
 */
export function waitForAnimation(el: Element, timeout = 300): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      el.removeEventListener("animationend", done);
      el.removeEventListener("transitionend", done);
      resolve();
    };

    el.addEventListener("animationend", done);
    el.addEventListener("transitionend", done);

    // Fallback timeout in case animation doesn't fire
    setTimeout(done, timeout);
  });
}

/**
 * Sets inline styles
 */
export function setStyles(
  el: HTMLElement,
  styles: Record<string, string | undefined>,
): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined) {
      (el.style as any)[key] = value;
    }
  }
}

/**
 * Creates a style element with CSS content
 */
export function createStyleSheet(css: string, id?: string): HTMLStyleElement {
  const style = document.createElement("style");
  if (id) style.id = id;
  style.textContent = css;
  return style;
}

/**
 * Generates a unique ID
 */
let idCounter = 0;
export function generateId(prefix = "relay"): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

/**
 * Escapes HTML to prevent XSS
 */
export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Formats a timestamp for display
 */
export function formatTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}
