# 0009 — Expo React Native for Android and iOS

## Context
The mobile apps must share the API, validation, translations and design tokens with the web app,
and ship to Google Play and the App Store from one codebase.

## Decision
Expo (React Native) with TypeScript and expo-router. The app imports `@boikonika/shared` for
tokens, i18n messages, roles and validation. Tokens are stored in SecureStore; push notifications
use Expo push (FCM/APNs). Builds and store submissions use EAS.

## Consequences
- One language (TypeScript) across the stack; Flutter was rejected because nothing could be shared.
- Store publishing requires the owner's Google Play and Apple developer accounts (external step).
