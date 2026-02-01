# @relay/sdk-web

[![npm version](https://badge.fury.io/js/@relay%2Fsdk-web.svg)](https://www.npmjs.com/package/@relay/sdk-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

In-app feedback, bug reporting, and session replay for web applications.

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

await Relay.init({
  apiKey: "rly_your_api_key",
  user: { id: "user_123", email: "user@example.com" },
});
```

That's it! The feedback widget is now available in your app.

## Getting Your API Key

1. Sign up or log in at [dashboard.relay.dev](https://dashboard.relay.dev)
2. Go to **Settings** → **API Keys**
3. Click **Create Key** and give it a name (e.g., "Production")
4. Copy the key (starts with `rly_`) - you won't see it again

**Security note**: API keys with `ingest` scope are safe to use in client-side code. They can only submit data, not read it. Keep keys with `read` or `admin` scopes server-side only.

## Features

- **Bug Reporting** - Screenshot capture, annotations, console/network logs
- **Session Replay** - Full DOM replay using rrweb
- **Feedback Collection** - User feedback with ratings and categories
- **Live Chat** - Real-time customer support
- **Privacy Controls** - PII masking, custom selectors

## Configuration

```typescript
Relay.init({
  apiKey: "rly_...",              // Required
  environment: "production",       // Optional: production, staging, development
  appVersion: "1.0.0",            // Optional: your app version

  user: {                         // Optional: identify user
    id: "user_123",
    email: "user@example.com",
    name: "Jane Doe",
    traits: { plan: "pro" },
  },

  widget: {                       // Optional: customize widget
    position: "bottom-right",
    primaryColor: "#6366f1",
    autoShow: true,
  },

  privacy: {                      // Optional: privacy controls
    maskSelectors: [".credit-card", ".ssn"],
    maskAllInputs: true,
  },

  capture: {                      // Optional: capture settings
    console: true,
    network: true,
    replay: false,
  },
});
```

## API Reference

### Widget Control

```javascript
Relay.open();           // Open widget
Relay.open("bug");      // Open specific tab: 'bug' | 'feedback' | 'chat'
Relay.close();          // Close widget
```

### User Identification

```javascript
await Relay.identify({
  id: "user_123",
  email: "user@example.com",
  name: "Jane Doe",
  traits: { plan: "pro", company: "Acme Inc" },
});
```

### Bug Reports

```javascript
await Relay.captureBug({
  title: "Payment form crash",
  description: "The form crashes when I click submit",
  severity: "high",      // 'low' | 'med' | 'high' | 'critical'
  includeScreenshot: true,
  includeLogs: true,
});
```

### Feedback

```javascript
await Relay.captureFeedback({
  text: "Love the new dark mode!",
  category: "feature-request",
  rating: 5,
});
```

### Session Replay

```javascript
Relay.startRecording();     // Start recording
await Relay.stopRecording(); // Stop recording
Relay.isRecording();        // Check if recording
```

### Event Tracking

```javascript
Relay.track("checkout_started", { cartValue: 99.99 });
```

### Event Listeners

```javascript
Relay.on("ready", () => console.log("Relay ready"));
Relay.on("bug:submitted", (data) => console.log(data.interactionId));
Relay.on("error", (error) => console.error(error));
```

### Cleanup

```javascript
Relay.destroy();  // Clean up SDK instance
```

## Framework Integration

### React

```jsx
import { useEffect } from "react";
import Relay from "@relay/sdk-web";

function App() {
  useEffect(() => {
    Relay.init({ apiKey: process.env.NEXT_PUBLIC_RELAY_API_KEY });
    return () => Relay.destroy();
  }, []);

  return <YourApp />;
}
```

### Vue

```javascript
import Relay from "@relay/sdk-web";

Relay.init({ apiKey: import.meta.env.VITE_RELAY_API_KEY })
  .then(() => app.mount("#app"));
```

### Angular

```typescript
// relay.service.ts
import { Injectable, OnDestroy } from "@angular/core";
import Relay from "@relay/sdk-web";

@Injectable({ providedIn: "root" })
export class RelayService implements OnDestroy {
  async init() {
    await Relay.init({ apiKey: environment.relayApiKey });
  }

  identify(user: any) {
    return Relay.identify(user);
  }

  ngOnDestroy() {
    Relay.destroy();
  }
}
```

## Privacy

By default, Relay masks password fields, credit card numbers, and email addresses. Add custom masking:

```html
<div class="relay-mask">Sensitive content</div>
<div class="relay-block">Not captured at all</div>
```

```javascript
Relay.setPrivacy({
  maskSelectors: ["[data-sensitive]", ".pii"],
  blockSelectors: [".secret-data"],
  maskAllInputs: true,
});
```

## Documentation

For full documentation, visit [docs.relay.dev](https://docs.relay.dev) or see [docs/sdk-web.md](../../docs/sdk-web.md).

## License

MIT
