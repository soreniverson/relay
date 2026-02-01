// ============================================================================
// BASE STYLES
// Reset and typography for the widget
// ============================================================================

import { generateThemeCSS, getTheme, type ThemeMode } from "./theme";

/**
 * Generates the base CSS for the widget
 */
export function generateBaseCSS(
  themeMode: ThemeMode = "auto",
  primaryColor?: string,
): string {
  const theme = getTheme(themeMode);
  const themeVars = generateThemeCSS(theme, primaryColor);

  return `
    /* Theme Variables */
    #relay-widget,
    .relay-screenshot-editor {
      ${themeVars}
    }

    /* Reset */
    #relay-widget *,
    #relay-widget *::before,
    #relay-widget *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    #relay-widget,
    .relay-screenshot-editor {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: -0.01em;
      color: hsl(var(--relay-text));
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .relay-screenshot-editor *,
    .relay-screenshot-editor *::before,
    .relay-screenshot-editor *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Typography - matches dashboard design system */
    #relay-widget h1,
    #relay-widget h2,
    #relay-widget h3,
    #relay-widget h4 {
      font-weight: 500;
      line-height: 1.3;
      letter-spacing: -0.02em;
      color: hsl(var(--relay-text));
    }

    #relay-widget h1 { font-size: 20px; }
    #relay-widget h2 { font-size: 16px; }
    #relay-widget h3 { font-size: 15px; }
    #relay-widget h4 { font-size: 14px; }

    #relay-widget p {
      font-size: 14px;
      color: hsl(var(--relay-text-secondary));
    }

    #relay-widget small {
      font-size: 12px;
      color: hsl(var(--relay-text-muted));
    }

    #relay-widget .relay-label {
      font-size: 13px;
      font-weight: 500;
      color: hsl(var(--relay-text));
    }

    #relay-widget .relay-meta {
      font-size: 12px;
      color: hsl(var(--relay-text-muted));
    }

    /* Links */
    #relay-widget a {
      color: hsl(var(--relay-primary));
      text-decoration: none;
    }

    #relay-widget a:hover {
      text-decoration: underline;
    }

    /* Focus styles */
    #relay-widget *:focus-visible {
      outline: 2px solid hsl(var(--relay-border-focus));
      outline-offset: 1px;
    }

    #relay-widget button:focus-visible,
    #relay-widget input:focus-visible,
    #relay-widget textarea:focus-visible,
    #relay-widget select:focus-visible {
      outline: none;
      border-color: hsl(var(--relay-border-focus));
      box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.1);
    }

    /* Animations */
    @keyframes relay-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes relay-slide-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes relay-slide-down {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes relay-scale-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes relay-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Utility classes */
    #relay-widget .relay-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    #relay-widget .relay-truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Scrollbar styling */
    #relay-widget ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    #relay-widget ::-webkit-scrollbar-track {
      background: transparent;
    }

    #relay-widget ::-webkit-scrollbar-thumb {
      background: hsl(var(--relay-border));
      border-radius: 3px;
    }

    #relay-widget ::-webkit-scrollbar-thumb:hover {
      background: hsl(var(--relay-border-hover));
    }
  `;
}

/**
 * Generates responsive styles for mobile/desktop
 */
export function generateResponsiveCSS(): string {
  return `
    /* Mobile-first responsive styles */
    @media (max-width: 480px) {
      #relay-widget .relay-modal {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        top: auto;
        width: 100%;
        max-height: 85vh;
        border-radius: 16px 16px 0 0;
        animation: relay-slide-up 0.3s ease-out;
      }

      #relay-widget .relay-modal.closing {
        animation: relay-slide-down 0.2s ease-in forwards;
      }

      #relay-widget .relay-trigger {
        bottom: 16px;
        right: 16px;
        width: 52px;
        height: 52px;
      }
    }

    /* Desktop styles */
    @media (min-width: 481px) {
      #relay-widget .relay-modal {
        width: 380px;
        max-height: 600px;
        border-radius: 16px;
        animation: relay-scale-in 0.2s ease-out;
      }

      #relay-widget .relay-modal.closing {
        animation: relay-fade-out 0.15s ease-in forwards;
      }

      @keyframes relay-fade-out {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.95); }
      }
    }
  `;
}
