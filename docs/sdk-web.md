# Relay Web SDK

The Relay Web SDK provides in-app feedback collection, bug reporting, session replay, and customer support capabilities for web applications.

## Installation

```bash
npm install @relay/sdk-web
# or
yarn add @relay/sdk-web
# or
pnpm add @relay/sdk-web
```

Or via CDN:

```html
<script src="https://cdn.relay.dev/sdk/v1/relay.min.js"></script>
```

## Quick Start

```javascript
import Relay from "@relay/sdk-web";

// Initialize
await Relay.init({
  apiKey: "rly_your_api_key",
  environment: "production",
  appVersion: "1.0.0",
});

// Identify user (optional but recommended)
await Relay.identify({
  id: "user_123",
  email: "user@example.com",
  name: "Jane Doe",
  traits: {
    plan: "pro",
    company: "Acme Inc",
  },
});

// Open the feedback widget
Relay.open();
```

## Configuration

```typescript
interface RelayConfig {
  // Required
  apiKey: string;

  // Optional
  endpoint?: string; // Custom API endpoint
  regionHint?: "us-west" | "eu-west";

  // User identification
  user?: {
    id: string;
    email?: string;
    name?: string;
    traits?: Record<string, unknown>;
  };

  // Session
  session?: {
    id?: string; // Provide to resume session
    attributes?: Record<string, unknown>;
  };

  // Environment
  environment?: "production" | "staging" | "development";
  appVersion?: string;

  // Privacy
  privacy?: {
    maskSelectors?: string[]; // CSS selectors to mask
    blockSelectors?: string[]; // CSS selectors to block completely
    maskAllInputs?: boolean; // Mask all input fields
    maskAllText?: boolean; // Mask all text content
  };

  // Capture settings
  capture?: {
    console?: boolean; // Capture console logs (default: true)
    network?: boolean; // Capture network requests (default: true)
    dom?: boolean; // Capture DOM errors (default: true)
    replay?: boolean; // Auto-start replay (default: false)
  };

  // Widget settings
  widget?: {
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    primaryColor?: string;
    showBugReport?: boolean;
    showFeedback?: boolean;
    showChat?: boolean;
    buttonText?: string;
    autoShow?: boolean; // Show widget button on init (default: true)
  };

  // Debug mode
  debug?: boolean;
}
```

## API Reference

### Initialization

```javascript
// Basic
await Relay.init({ apiKey: "rly_..." });

// With user
await Relay.init({
  apiKey: "rly_...",
  user: {
    id: "user_123",
    email: "user@example.com",
  },
});
```

### User Identification

```javascript
// Identify after init
await Relay.identify({
  id: "user_123",
  email: "user@example.com",
  name: "Jane Doe",
  traits: {
    plan: "pro",
    company: "Acme Inc",
  },
});

// Update session attributes
Relay.setSessionAttributes({
  currentPage: "checkout",
  cartValue: 99.99,
});
```

### Widget Control

```javascript
// Open widget
Relay.open();

// Open specific tab
Relay.open("bug"); // 'bug' | 'feedback' | 'chat'

// Close widget
Relay.close();
```

### Bug Reports

```javascript
// Programmatic bug report
const interactionId = await Relay.captureBug({
  title: "Payment form crash",
  description: "The form crashes when I click submit",
  severity: "high", // 'low' | 'med' | 'high' | 'critical'
  tags: ["payment", "urgent"],
  includeScreenshot: true, // default: true
  includeLogs: true, // default: true
  includeReplay: false, // default: false
  attachments: [file1, file2], // File objects
});
```

### Feedback

```javascript
// Programmatic feedback
const interactionId = await Relay.captureFeedback({
  text: "It would be great to have dark mode",
  category: "feature-request",
  rating: 5,
  tags: ["ui"],
});
```

### Session Replay

```javascript
// Start recording
Relay.startRecording();

// Stop recording
await Relay.stopRecording();

// Check if recording
const isRecording = Relay.isRecording();
```

### Privacy Controls

```javascript
// Update privacy settings at runtime
Relay.setPrivacy({
  maskSelectors: [".credit-card", ".ssn"],
  blockSelectors: [".sensitive-data"],
  maskAllInputs: true,
});
```

### Event Tracking

```javascript
// Track custom events (for survey targeting)
Relay.track("checkout_started", {
  cartValue: 99.99,
  itemCount: 3,
});

Relay.track("feature_used", {
  feature: "export",
  format: "pdf",
});
```

### Event Listeners

```javascript
// Listen to SDK events
Relay.on("ready", () => {
  console.log("Relay is ready");
});

Relay.on("bug:submitted", (data) => {
  console.log("Bug submitted:", data.interactionId);
});

Relay.on("feedback:submitted", (data) => {
  console.log("Feedback submitted:", data.interactionId);
});

Relay.on("replay:started", (data) => {
  console.log("Replay started:", data.replayId);
});

Relay.on("error", (error) => {
  console.error("Relay error:", error);
});

// Remove listener
Relay.off("ready", handler);
```

### Cleanup

```javascript
// Destroy SDK instance
Relay.destroy();
```

## Privacy & Masking

### Default Masking

By default, Relay masks:

- Password fields
- Credit card numbers (pattern matching)
- Email addresses (in replay)
- Elements with `.relay-mask` class

### Custom Masking

```html
<!-- Mask specific elements -->
<div class="relay-mask">Sensitive content</div>

<!-- Block elements completely -->
<div class="relay-block">This won't be captured at all</div>
```

```javascript
Relay.init({
  privacy: {
    maskSelectors: ["[data-sensitive]", ".pii", ".credit-card"],
    blockSelectors: [".secret-data"],
  },
});
```

## React Integration

```jsx
import { useEffect } from "react";
import Relay from "@relay/sdk-web";

function App() {
  useEffect(() => {
    Relay.init({
      apiKey: process.env.NEXT_PUBLIC_RELAY_API_KEY,
      environment: process.env.NODE_ENV,
    });

    return () => {
      Relay.destroy();
    };
  }, []);

  return <YourApp />;
}
```

### With Context

```jsx
import { createContext, useContext, useEffect, useState } from "react";
import Relay from "@relay/sdk-web";

const RelayContext = createContext(null);

export function RelayProvider({ children, config }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Relay.init(config).then(() => setReady(true));
    return () => Relay.destroy();
  }, []);

  return (
    <RelayContext.Provider value={{ ready, Relay }}>
      {children}
    </RelayContext.Provider>
  );
}

export function useRelay() {
  return useContext(RelayContext);
}
```

## Vue Integration

```javascript
// main.js
import { createApp } from "vue";
import Relay from "@relay/sdk-web";

const app = createApp(App);

app.config.globalProperties.$relay = Relay;

Relay.init({
  apiKey: import.meta.env.VITE_RELAY_API_KEY,
}).then(() => {
  app.mount("#app");
});
```

## Angular Integration

```typescript
// relay.service.ts
import { Injectable, OnDestroy } from "@angular/core";
import Relay from "@relay/sdk-web";

@Injectable({ providedIn: "root" })
export class RelayService implements OnDestroy {
  async init() {
    await Relay.init({
      apiKey: environment.relayApiKey,
    });
  }

  identify(user: any) {
    return Relay.identify(user);
  }

  open() {
    Relay.open();
  }

  ngOnDestroy() {
    Relay.destroy();
  }
}
```

## Troubleshooting

### Widget Not Showing

```javascript
// Ensure autoShow is not false
Relay.init({
  widget: { autoShow: true },
});

// Or manually open
Relay.open();
```

### Console Capture Not Working

```javascript
// Enable console capture
Relay.init({
  capture: { console: true },
});
```

### Network Requests Not Captured

```javascript
// Enable network capture
Relay.init({
  capture: { network: true },
});
```

Note: Relay's own API calls are automatically excluded.

### CORS Errors

Ensure your API endpoint allows requests from your domain. Check `CORS_ORIGIN` configuration.

### CSP Issues

Add Relay domains to your Content Security Policy:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
  script-src 'self' https://cdn.relay.dev;
  connect-src 'self' https://*.api.relay.dev;
"
/>
```
