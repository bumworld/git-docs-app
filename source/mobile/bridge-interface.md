---
title: Mobile Bridge Interface Guide
sidebar:
  label: Bridge Interface
---

# Mobile Bridge Interface Guide

## Overview

The Mobile Bridge provides two-way communication between the web app and native mobile features. Web developers can access native functionality like push notifications, biometric authentication, and device sensors through a unified JavaScript interface.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Web App                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  MobileSDK                           │    │
│  │   (Abstraction layer - auto-detects web/app)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              window.MobileBridge                     │    │
│  │   (Native injected JavaScript interface)            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │  WebView JS   │
                    │   Channel     │
                    └───────┬───────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                      Native App (Flutter)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 BridgeChannel                        │    │
│  │   (Message routing and response handling)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 BridgeHandlers                       │    │
│  │   ┌──────────┬──────────┬──────────┬──────────┐     │    │
│  │   │   App    │   Auth   │  Device  │  Sensor  │     │    │
│  │   │ Handlers │ Handlers │ Handlers │ Handlers │     │    │
│  │   └──────────┴──────────┴──────────┴──────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Message Protocol

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `request` | Web → App | Request native functionality |
| `response` | App → Web | Response to request |
| `event` | App → Web | Push event from native |

### Request Structure

```typescript
interface BridgeRequest {
  type: 'request';
  id: string;           // Unique request ID
  action: string;       // Action name (e.g., 'auth.login')
  payload: Record<string, any>;  // Request parameters
  meta: {
    ts: string;         // ISO timestamp
    origin: 'web';
    version: string;    // Bridge version
  };
}
```

### Response Structure

```typescript
interface BridgeResponse {
  type: 'response';
  id: string;           // Matches request ID
  action: string;
  ok: boolean;          // Success flag
  data?: Record<string, any>;  // Success data
  error?: {
    code: string;
    message: string;
  };
  meta: {
    ts: string;
    origin: 'app';
    version: string;
  };
}
```

---

## Available Actions

### App Detection

Check if running in native app context.

```typescript
// Request
await MobileSDK.app.isApp();

// Response
{
  isApp: true,
  platform: 'ios', // 'ios' | 'android'
  version: '1.2.3'
}
```

### Authentication

Sync authentication state between web and app.

```typescript
// Login sync
await MobileSDK.auth.syncToken({
  accessToken: 'eyJ...',
  refreshToken: 'eyJ...',
  expiresIn: 3600
});

// Logout
await MobileSDK.auth.logout();

// Get current token
const { accessToken } = await MobileSDK.auth.getToken();
```

### Device Info

Access device capabilities and information.

```typescript
// Get device info
const info = await MobileSDK.device.getInfo();
// {
//   model: 'iPhone 15 Pro',
//   os: 'iOS 17.0',
//   battery: 85,
//   network: 'wifi'
// }

// Get safe area insets
const { top, bottom } = await MobileSDK.device.getSafeArea();

// Haptic feedback
await MobileSDK.device.haptic({ type: 'light' });
```

### Push Notifications

Register for and handle push notifications.

```typescript
// Request permission
const { granted } = await MobileSDK.push.requestPermission();

// Get push token
const { token } = await MobileSDK.push.getToken();

// Listen for notifications
MobileSDK.push.onNotification((notification) => {
  console.log('Received:', notification);
});
```

### Biometric Authentication

Use device biometric authentication.

```typescript
// Check availability
const { available, type } = await MobileSDK.biometric.check();
// type: 'faceId' | 'touchId' | 'fingerprint'

// Authenticate
const { success } = await MobileSDK.biometric.authenticate({
  reason: 'Confirm your identity'
});
```

### Camera & Gallery

Access device camera and photo library.

```typescript
// Take photo
const { base64, uri } = await MobileSDK.camera.takePhoto({
  quality: 0.8,
  maxWidth: 1920
});

// Pick from gallery
const { images } = await MobileSDK.gallery.pickImages({
  multiple: true,
  maxCount: 5
});
```

---

## Error Handling

All bridge calls return promises that can reject with structured errors.

```typescript
try {
  await MobileSDK.auth.syncToken({ accessToken });
} catch (error) {
  switch (error.code) {
    case 'BRIDGE_NOT_AVAILABLE':
      console.log('Not in app context');
      break;
    case 'PERMISSION_DENIED':
      console.log('User denied permission');
      break;
    case 'TIMEOUT':
      console.log('Request timed out');
      break;
    default:
      console.error('Unknown error:', error);
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `BRIDGE_NOT_AVAILABLE` | Not in native app context |
| `PERMISSION_DENIED` | User denied permission |
| `TIMEOUT` | Request timeout (default 30s) |
| `INVALID_PARAMS` | Invalid request parameters |
| `NOT_SUPPORTED` | Feature not supported on this platform |
| `NATIVE_ERROR` | Error from native layer |

---

## Event Listeners

Subscribe to app events.

```typescript
// App lifecycle
MobileSDK.on('appStateChange', (state) => {
  console.log('App state:', state); // 'active' | 'background' | 'inactive'
});

// Network changes
MobileSDK.on('networkChange', (status) => {
  console.log('Network:', status); // 'wifi' | 'cellular' | 'none'
});

// Battery changes
MobileSDK.on('batteryChange', (level) => {
  console.log('Battery:', level); // 0-100
});

// Remove listener
const unsubscribe = MobileSDK.on('appStateChange', handler);
unsubscribe();
```

---

## Best Practices

### 1. Feature Detection

Always check if running in app before using bridge.

```typescript
if (await MobileSDK.app.isApp()) {
  // Use native features
  await MobileSDK.push.requestPermission();
} else {
  // Use web fallback
  requestWebPushPermission();
}
```

### 2. Graceful Degradation

Provide web alternatives when native features aren't available.

```typescript
async function shareContent(content) {
  if (await MobileSDK.app.isApp()) {
    return MobileSDK.device.share({ text: content });
  } else if (navigator.share) {
    return navigator.share({ text: content });
  } else {
    copyToClipboard(content);
    showToast('Copied to clipboard');
  }
}
```

### 3. Timeout Handling

Set appropriate timeouts for bridge calls.

```typescript
const result = await Promise.race([
  MobileSDK.camera.takePhoto(),
  timeout(30000) // 30 second timeout
]);
```

### 4. Error Boundaries

Wrap bridge calls in try-catch blocks.

```typescript
async function loginWithBiometric() {
  try {
    const { available } = await MobileSDK.biometric.check();
    if (!available) {
      return fallbackLogin();
    }

    const { success } = await MobileSDK.biometric.authenticate({
      reason: 'Login to your account'
    });

    if (success) {
      await completeLogin();
    }
  } catch (error) {
    console.error('Biometric error:', error);
    return fallbackLogin();
  }
}
```

---

## Testing

### Mocking the Bridge

```typescript
// Mock for testing
window.MobileBridge = {
  call: async (action, payload) => {
    if (action === 'app.isApp') {
      return { ok: true, data: { isApp: true, platform: 'ios' } };
    }
    return { ok: true, data: {} };
  }
};
```

### E2E Testing

Use Appium or similar tools to test bridge integration in actual app context.
