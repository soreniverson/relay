// ============================================================================
// THEME SYSTEM
// CSS variables for light/dark mode support
// ============================================================================

export interface ThemeColors {
  "--relay-bg": string;
  "--relay-bg-secondary": string;
  "--relay-bg-tertiary": string;
  "--relay-text": string;
  "--relay-text-muted": string;
  "--relay-text-subtle": string;
  "--relay-border": string;
  "--relay-border-hover": string;
  "--relay-primary": string;
  "--relay-primary-hover": string;
  "--relay-primary-text": string;
  "--relay-success": string;
  "--relay-warning": string;
  "--relay-error": string;
  "--relay-shadow": string;
  "--relay-shadow-lg": string;
  "--relay-overlay": string;
}

export const lightTheme: ThemeColors = {
  "--relay-bg": "0 0% 100%",
  "--relay-bg-secondary": "240 5% 96%",
  "--relay-bg-tertiary": "240 5% 92%",
  "--relay-text": "240 10% 4%",
  "--relay-text-muted": "240 4% 46%",
  "--relay-text-subtle": "240 4% 65%",
  "--relay-border": "240 6% 90%",
  "--relay-border-hover": "240 5% 75%",
  "--relay-primary": "240 6% 10%",
  "--relay-primary-hover": "240 5% 20%",
  "--relay-primary-text": "0 0% 100%",
  "--relay-success": "142 71% 45%",
  "--relay-warning": "38 92% 50%",
  "--relay-error": "0 72% 51%",
  "--relay-shadow": "0 1px 2px rgba(0, 0, 0, 0.05)",
  "--relay-shadow-lg":
    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  "--relay-overlay": "rgba(0, 0, 0, 0.4)",
};

export const darkTheme: ThemeColors = {
  "--relay-bg": "240 10% 4%",
  "--relay-bg-secondary": "240 6% 10%",
  "--relay-bg-tertiary": "240 4% 16%",
  "--relay-text": "0 0% 98%",
  "--relay-text-muted": "240 5% 65%",
  "--relay-text-subtle": "240 4% 46%",
  "--relay-border": "240 4% 16%",
  "--relay-border-hover": "240 5% 26%",
  "--relay-primary": "0 0% 98%",
  "--relay-primary-hover": "0 0% 85%",
  "--relay-primary-text": "240 10% 4%",
  "--relay-success": "142 71% 45%",
  "--relay-warning": "38 92% 50%",
  "--relay-error": "0 72% 51%",
  "--relay-shadow": "0 1px 2px rgba(0, 0, 0, 0.3)",
  "--relay-shadow-lg":
    "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
  "--relay-overlay": "rgba(0, 0, 0, 0.6)",
};

export type ThemeMode = "light" | "dark" | "auto";

/**
 * Detects the page's color scheme
 * Checks: 1) Class on html/body, 2) data-theme attribute, 3) computed background color
 * Note: We prioritize page appearance over system preference since the widget
 * should match the host page, not the user's OS setting.
 */
export function detectTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const html = document.documentElement;
  const body = document.body;

  // Check class-based dark mode
  if (
    html.classList.contains("dark") ||
    body?.classList.contains("dark") ||
    html.classList.contains("dark-mode") ||
    body?.classList.contains("dark-mode") ||
    html.classList.contains("theme-dark") ||
    body?.classList.contains("theme-dark")
  ) {
    return "dark";
  }

  // Check data-theme attribute
  const htmlTheme =
    html.getAttribute("data-theme") || html.getAttribute("data-mode");
  const bodyTheme =
    body?.getAttribute("data-theme") || body?.getAttribute("data-mode");
  if (htmlTheme === "dark" || bodyTheme === "dark") {
    return "dark";
  }

  // Check color-scheme CSS property
  const htmlColorScheme = getComputedStyle(html).colorScheme;
  const bodyColorScheme = body ? getComputedStyle(body).colorScheme : "";
  if (htmlColorScheme === "dark" || bodyColorScheme === "dark") {
    return "dark";
  }

  // Try to detect dark mode from background color
  if (body) {
    const bgColor = getComputedStyle(body).backgroundColor;
    if (bgColor && isDarkColor(bgColor)) {
      return "dark";
    }
  }

  // Default to light - widget should match page, and most pages are light by default
  return "light";
}

/**
 * Determines if a color is "dark" based on luminance
 */
function isDarkColor(color: string): boolean {
  // Parse rgb/rgba
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Consider dark if luminance is below 0.5
  return luminance < 0.5;
}

/**
 * Returns the theme colors based on mode
 */
export function getTheme(mode: ThemeMode): ThemeColors {
  if (mode === "auto") {
    return detectTheme() === "dark" ? darkTheme : lightTheme;
  }
  return mode === "dark" ? darkTheme : lightTheme;
}

/**
 * Generates CSS variables string from theme
 */
export function generateThemeCSS(
  theme: ThemeColors,
  primaryColor?: string,
): string {
  let css = "";
  for (const [key, value] of Object.entries(theme)) {
    // Skip shadow and overlay (they're not HSL)
    if (key.includes("shadow") || key.includes("overlay")) {
      css += `${key}: ${value};\n`;
    } else {
      css += `${key}: ${value};\n`;
    }
  }

  // Override primary color if provided
  if (primaryColor) {
    const hsl = hexToHSL(primaryColor);
    if (hsl) {
      css += `--relay-primary: ${hsl};\n`;
      // Compute hover state (slightly lighter/darker)
      const [h, s, l] = hsl
        .split(" ")
        .map((v) => parseFloat(v.replace("%", "")));
      const hoverL = l > 50 ? l - 10 : l + 10;
      css += `--relay-primary-hover: ${h} ${s}% ${hoverL}%;\n`;
      // Compute contrasting text color based on luminance
      const contrastText = l > 50 ? "0 0% 0%" : "0 0% 100%";
      css += `--relay-primary-text: ${contrastText};\n`;
    }
  }

  return css;
}

/**
 * Converts hex color to HSL string (e.g., "240 100% 50%")
 */
function hexToHSL(hex: string): string | null {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse RGB
  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }

  // Convert to 0-1 range
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Creates a listener for theme changes
 * Watches: media query, class changes, data-theme attribute changes
 */
export function onThemeChange(
  callback: (theme: "light" | "dark") => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  let lastTheme = detectTheme();

  const checkTheme = () => {
    const newTheme = detectTheme();
    if (newTheme !== lastTheme) {
      lastTheme = newTheme;
      callback(newTheme);
    }
  };

  // Watch media query
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const mediaHandler = () => checkTheme();
  mediaQuery.addEventListener("change", mediaHandler);

  // Watch class/attribute changes on html and body
  const observer = new MutationObserver(checkTheme);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
  }

  return () => {
    mediaQuery.removeEventListener("change", mediaHandler);
    observer.disconnect();
  };
}
