# Relay Session Replay

## Overview

Relay's session replay feature provides full DOM replay using [rrweb](https://github.com/rrweb-io/rrweb), allowing you to see exactly what users experienced when they reported bugs or provided feedback.

## How It Works

### Recording

1. **DOM Mutations**: rrweb captures all DOM changes via MutationObserver
2. **User Interactions**: Mouse movements, clicks, scrolls, inputs
3. **Network Events**: API calls and their responses (optional)
4. **Console Logs**: JavaScript console output

### Storage

Replay events are chunked and uploaded incrementally:

```
User Session → rrweb Events → Chunks (5s each) → S3 Storage
```

Each chunk is:
- Compressed with gzip
- Privacy-sanitized
- Uploaded via presigned URL

### Playback

The dashboard player reconstructs the DOM state:

```
S3 → Fetch Chunks → Decompress → rrweb Player → Rendered Replay
```

## SDK Configuration

### Basic Setup

```javascript
import Relay from '@relay/sdk-web';

Relay.init({
  apiKey: 'rly_...',
  capture: {
    replay: true, // Enable automatic replay recording
  },
});
```

### Manual Control

```javascript
// Start recording
Relay.startRecording();

// Stop recording
await Relay.stopRecording();

// Check recording status
const isRecording = Relay.isRecording();
```

### On-Demand Recording

Record only when submitting a bug:

```javascript
Relay.init({
  capture: {
    replay: false, // Don't auto-record
  },
});

// Start recording when user opens bug reporter
Relay.on('widget:open', () => {
  Relay.startRecording();
});

// Recording is automatically attached to bug report
await Relay.captureBug({
  title: 'Something broke',
  includeReplay: true,
});
```

## Privacy & Masking

### Default Masking

By default, rrweb masks:
- All text input values
- Password fields completely
- Elements with `.relay-mask` class

### Custom Masking

```javascript
Relay.init({
  privacy: {
    // Mask specific elements
    maskSelectors: [
      '.credit-card',
      '[data-sensitive]',
      '.pii',
    ],

    // Block elements entirely (not captured)
    blockSelectors: [
      '.secret-data',
      '#private-modal',
    ],

    // Mask all text (not just inputs)
    maskAllText: false,
  },
});
```

### HTML Attributes

```html
<!-- Mask this element's content -->
<div class="relay-mask">Sensitive: SSN ***-**-1234</div>

<!-- Block this element completely -->
<div class="relay-block">
  This content will not be captured
</div>
```

### Server-Side Sanitization

Replay data is also sanitized server-side before storage:

- Email addresses → `***@***.***`
- Phone numbers → `***-***-****`
- Credit card patterns → `**** **** **** ****`
- SSN patterns → `***-**-****`

## Performance

### Impact

Recording adds minimal overhead:

| Metric | Impact |
|--------|--------|
| CPU | ~1-3% additional |
| Memory | ~5-20MB depending on page complexity |
| Network | ~50-200KB/minute compressed |

### Optimization

```javascript
Relay.init({
  replay: {
    // Reduce mutation sampling
    sampling: {
      mousemove: 50,     // Sample every 50ms
      mouseInteraction: true,
      scroll: 150,       // Sample every 150ms
      input: 'last',     // Only capture final value
    },

    // Exclude non-essential elements
    blockClass: 'no-replay',

    // Limit recording duration
    maxDuration: 5 * 60 * 1000, // 5 minutes
  },
});
```

### Chunked Upload

Events are batched and uploaded in chunks:

```javascript
// Default chunk settings
{
  chunkSize: 5000,        // 5 seconds of events
  uploadInterval: 5000,   // Upload every 5 seconds
  maxChunks: 60,          // Max 5 minutes (60 chunks)
}
```

## Dashboard Player

### Features

- **Playback Controls**: Play, pause, speed (0.5x-4x)
- **Timeline**: Scrub to any point, jump to events
- **Event Markers**: Click, error, network events marked on timeline
- **DevTools Panel**: Console logs, network requests alongside replay
- **Privacy Toggle**: Preview masked vs unmasked view

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← | Skip back 5s |
| → | Skip forward 5s |
| 1-4 | Set speed |
| F | Fullscreen |

### Embedded Player

Embed replays in other tools:

```html
<iframe
  src="https://app.relay.dev/replay/rpl_123?embed=true"
  width="800"
  height="600"
></iframe>
```

## Storage & Retention

### Storage Format

Replay data is stored as JSON chunks in S3:

```
s3://relay-{region}-media/
  └── replays/
      └── {project_id}/
          └── {replay_id}/
              ├── meta.json
              ├── chunk_0.json.gz
              ├── chunk_1.json.gz
              └── ...
```

### Retention

Default retention: 30 days (configurable 7-90 days)

After retention period:
1. Chunks deleted from S3
2. Replay record marked as expired
3. Interaction still available but replay link shows "Expired"

### Export

Export replay for offline viewing:

```javascript
// API endpoint
GET /api/replays/{replay_id}/export

// Returns self-contained HTML file
```

## Troubleshooting

### Replay Not Recording

```javascript
// Check if replay is enabled
console.log(Relay.isRecording()); // Should be true

// Verify rrweb is loaded
console.log(window.rrweb); // Should be defined

// Check for errors
Relay.on('error', (e) => console.log('Relay error:', e));
```

### Replay Playback Issues

1. **Black screen**: Check if `blockSelectors` is too aggressive
2. **Missing content**: Some dynamic content may not replay (canvas, video)
3. **Style differences**: External fonts may not load in replay

### Large Replay Files

If replays are too large:

1. Reduce `maxDuration`
2. Enable more aggressive `sampling`
3. Add `blockSelectors` for heavy DOM areas
4. Use `maskAllText: true` to reduce mutation count

## Technical Details

### rrweb Event Types

| Type | Description |
|------|-------------|
| 0 | DomContentLoaded |
| 1 | Load |
| 2 | FullSnapshot |
| 3 | IncrementalSnapshot |
| 4 | Meta |
| 5 | Custom |
| 6 | Plugin |

### Incremental Snapshot Sources

| Source | Description |
|--------|-------------|
| 0 | Mutation |
| 1 | MouseMove |
| 2 | MouseInteraction |
| 3 | Scroll |
| 4 | ViewportResize |
| 5 | Input |
| 6 | TouchMove |
| 7 | MediaInteraction |
| 8 | StyleSheetRule |
| 9 | CanvasMutation |
| 10 | Font |
| 11 | Log |

### Worker Processing

When a replay ends, a worker job:

1. Fetches all chunks from S3
2. Validates event integrity
3. Applies server-side privacy rules
4. Merges into optimized playback format
5. Updates replay status to "ready"
