# Boikonika mobile app (Android & iOS)

The Expo / React Native app for Boikonika. It uses **the same REST API as the website**
(`/api/v1`), the same Bangla/English messages, design tokens, validation schemas, Markdown parser and
API response types from `@boikonika/shared`.

- Expo SDK 58, React Native 0.88, Expo Router (file-based routes in `src/app/`)
- Tabs: **Home, Explore, Community, Library, Profile**; everything else opens on a native stack
- Light and dark themes from the shared tokens (System / Light / Dark in Profile)
- Bangla by default, English when the phone is set to English; switchable in Profile

## Layout

```
src/app/                 routes (every file is a screen; _layout.tsx files are navigators)
  (tabs)/                Home, Explore, Community, Library, Profile
  books/ categories/     catalogue: book page with buying options, category lists
  cart, checkout         cart (guest or signed in) and one-screen checkout
  account/orders, account/addresses
  posts/[id], posts/new  post with comments, composer
  clubs/ student-zone help/ pages/ notifications
  login register forgot-password
src/components/          UI kit (ui.tsx), book cards, community cards, Markdown, forms, toast
src/lib/                 API client, session, cart, locale, theme, offline cache, push, links
src/__tests__/           Jest tests (jest-expo + React Native Testing Library)
```

## How it talks to the API

- **Sign-in** sends `client: "android" | "ios"` plus a random per-install `deviceId`, so the API returns the
  refresh token in the body (the website uses an http-only cookie instead). The refresh token is kept in the
  Keychain / Keystore (`expo-secure-store`); the short-lived access token stays in memory. Requests refresh
  ahead of expiry and retry once on 401; only a rejected refresh token signs the reader out.
- Every request sends `Accept-Language` (messages come back in the reader's language) and
  `X-Client-Platform`, so the account's activity shows which app was used.
- **Guest cart:** the API's `guestToken` is kept on the phone and merged into the account after sign-in.
- **Offline:** home, library, feed, book pages, orders and help keep their last good copy on the phone
  and show it, with a notice, when there is no connection.
- **Links** from notifications, banners and Markdown open the matching app screen; pages only the
  website has (seller, author and admin tools, quizzes, author pages) open in the in-app browser.
- **Payments** for online methods finish on the payment provider's page in the in-app browser; the app
  never sees card details. The order page then shows the outcome.

## Run it locally

From `platform/` (the API must be running — see the root README):

```bash
pnpm install
pnpm --filter @boikonika/shared build
# A phone on the same Wi-Fi needs your computer's LAN address, not localhost:
EXPO_PUBLIC_API_URL=http://192.168.0.10:4000 EXPO_PUBLIC_SITE_URL=http://192.168.0.10:3000 pnpm --filter @boikonika/mobile start
```

The Android emulator reaches the host at `10.0.2.2` and the iOS simulator at `localhost`; those are the
defaults when `EXPO_PUBLIC_API_URL` is not set. Every native module the app uses is an Expo SDK package, so
Expo Go is enough for most development; if your Expo Go doesn't match SDK 58, make a development build with
`npx expo run:android` / `npx expo run:ios`. Push notifications need a preview or store build (below).

The web build (`pnpm --filter @boikonika/mobile export:web`) is only for previews and automated
screenshots; for it, add its origin to the API's `CORS_ORIGINS`.

## Checks

```bash
pnpm --filter @boikonika/mobile typecheck
pnpm --filter @boikonika/mobile test
```

## Store builds (EAS)

Builds are made in the cloud with EAS — no local Android Studio or Xcode needed.

1. `npx eas-cli@latest login`, then `npx eas-cli@latest init` in this folder. This links the app to your Expo
   account and writes `extra.eas.projectId` into `app.json` (push notifications need it).
2. Set the API addresses for each profile in `eas.json` (`preview` points at staging, `production` at
   `https://api.boikonika.com`).
3. Android test build (APK to share with testers): `npx eas-cli@latest build -p android --profile preview`
4. Store builds: `npx eas-cli@latest build -p android --profile production` (Play Store app bundle) and
   `npx eas-cli@latest build -p ios --profile production` (needs an Apple Developer account).
5. Submit: `npx eas-cli@latest submit -p android` / `-p ios`.

Bundle id / package: `com.arieskonex.boikonika`. Icons and the splash screen are generated from the website's
logo by `node scripts/generate-icons.mjs`.

### Push notifications

The API sends to Expo's push service for subscriptions of kind `expo`. To deliver them:

- Android: upload an FCM v1 service-account key with `npx eas-cli@latest credentials` (Android → Push).
- iOS: let EAS create an APNs key during the first iOS build, or upload your own.

The app never asks for notification permission at launch. Readers turn push on in **Profile → Push
notifications on this phone**; sign-out removes the phone's subscription so the next person on a shared
phone doesn't receive the previous reader's notices. Which kinds of notices arrive is set in the
account's notification settings, the same as on the website.

## Privacy

The app asks for no location, microphone, contacts or camera access (`app.json` blocks the location and
audio permissions that libraries might otherwise add). Notification permission is requested only when the
reader turns push on. Nothing is tracked beyond what the website records for the same account.
