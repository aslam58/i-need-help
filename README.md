# I NEED HELP

A community assistance app connecting people who need everyday help with nearby people willing to help.

## Implemented

Email/password accounts, private profiles, request creation, approximate-area discovery, helper offers, acceptance and withdrawal, request completion/history, and private chat after helper acceptance.

## Stack and setup

React Native, Expo, TypeScript, and Supabase. Install Node.js LTS, run `npm ci`, copy `.env.example` to `.env`, and configure your own Supabase project. Run `npm start` to start Metro. Use a compatible Expo Go version or your own development build. Run `npx tsc --noEmit` for type checking. Offline behavior checks are available in `scripts/`.

Database migrations and Edge Functions are included; configure and review them for your own backend. Use your own EAS project ID in `app.json` and Firebase `google-services.json` for Android notification builds. Owner EAS identity, credentials, screenshots, and device artifacts are excluded.

## Status

Android development pilot. Push notification delivery, release acceptance, account-deletion processing, and remaining milestone checks are incomplete. Location and notifications require real-device testing. This is not an emergency-response service.
