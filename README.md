<div align="center">

<img src="assets/images/icon.png" alt="Kiddo Logo" width="120" height="120" style="border-radius: 24px;" />

# Kiddo — Baby Care & Kids Shopping App

**A full-featured React Native / Expo mobile app for discovering, browsing, and buying baby care products, kids fashion, toys, books & more.**

[![Expo](https://img.shields.io/badge/Expo-SDK_53-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.79-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/Platform-iOS_%7C_Android-lightgrey?logo=apple)](https://www.apple.com/app-store/)

</div>

---

## 📱 Overview

**Kiddo** is a consumer-facing mobile app for [allforkiddo.com](https://allforkiddo.com) — an e-commerce platform specialising in curated baby care essentials, kids' fashion, toys, books, and ticketed experiences. The app is built with **Expo (bare workflow)**, uses **Shopify Storefront API** as its commerce engine, and integrates a rich ecosystem of third-party services for analytics, push notifications, loyalty rewards, and delivery management.

### Key Features

| Feature | Description |
|---|---|
| 🛍️ **Product Catalog** | Infinite scroll, smart filters (size, brand, age, category), and tag-based discovery |
| 🔍 **Search** | Real-time search with auto-suggestions powered by a self-hosted search engine |
| 🛒 **Cart & Checkout** | Full cart management with coupon/discount codes, Kiddo Cash (wallet), and Razorpay payment gateway |
| 📦 **Order Tracking** | Live rider location on a map, order history, and detailed order timeline |
| 🔄 **Returns & Exchanges** | In-app instant/scheduled return & exchange flow with time-slot selection |
| 🎟️ **Ticketing** | Book event/experience tickets directly in-app (powered by Shopify) |
| 💎 **Rewards & Loyalty** | Kiddo Cash wallet, referral programme, and Nector-powered loyalty points |
| 🎁 **Try & Buy** | Trial purchase flow for eligible products |
| 📲 **Push Notifications** | OneSignal + CleverTap push, in-app messages, and inbox |
| 🗺️ **Address Management** | Google Places Autocomplete + Maps for precise delivery address capture |
| 👤 **Account & Profile** | Order history, wishlist, saved addresses, referrals, wallet balance |
| 📣 **Campaigns** | Kiddo Cash rewards for marketing campaigns with confetti celebration |

---

## 🏗️ Architecture

```
kiddo-app/
├── app/                    # Expo Router file-based navigation (screens)
│   ├── (auth)/             # Onboarding & OTP login
│   ├── (tabs)/             # Bottom tab navigator (Home, Search, Cart, Account)
│   ├── orders/             # Order detail & tracking
│   ├── products/           # PDP (Product Detail Page)
│   ├── cart/               # Cart screen
│   ├── address/            # Address add/edit/select
│   ├── returns/            # Returns & exchange flow
│   ├── try-and-buy/        # Try & Buy flow
│   ├── wishlist/           # Saved wishlist
│   ├── wallet/             # Kiddo Cash wallet
│   ├── rewards/            # Loyalty & rewards
│   └── referral/           # Referral programme
│
├── components/             # Reusable UI components
│   ├── ui/                 # Design system primitives
│   ├── home/               # Home feed widgets (banners, carousels)
│   ├── products/           # Product cards, grid, filters
│   ├── cart/               # Cart item, coupon input
│   ├── orders/             # Order card, return/exchange sheets
│   └── modals/             # Bottom sheets & overlays
│
├── services/               # API & business logic layer
│   ├── shopifyApi.ts        # Shopify Storefront GraphQL client
│   ├── shopifyAdminApi.ts   # Shopify Admin API (server-side calls)
│   ├── analyticsService.ts  # Mixpanel & CleverTap event wrappers
│   ├── checkoutService.ts   # Checkout creation & update
│   ├── paymentService.ts    # Razorpay integration
│   ├── orderService.ts      # Order fetching & management
│   ├── returnsService.ts    # Return & exchange API
│   ├── nectorApi.ts         # Nector loyalty platform
│   ├── selfSearchApi.ts     # Self-hosted search engine
│   └── ...
│
├── store/                  # Zustand global state (cart, user, filters)
├── context/                # React Context (Nector, theme)
├── config/                 # App-level configuration & constants
├── hooks/                  # Custom React hooks
├── utils/                  # Shared utility functions
├── types/                  # TypeScript type definitions
├── assets/                 # Fonts, images, icons
├── android/                # Native Android project
└── ios/                    # Native iOS project
```

### State Management

- **Zustand** — Cart state, user/auth state, filter state, and wishlist
- **React Query (TanStack)** — Server data fetching, caching, and background sync
- **AsyncStorage** — Persistent user session, preferences, and feature flags

### Navigation

Built on **Expo Router** (v4) with file-based routing:
- Stack navigator for deep-link-compatible screens
- Bottom-tab navigator for the main app shell
- Deep linking via `kiddo://` and `https://allforkiddo.com` universal links

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.79 + Expo SDK 53 (bare workflow) |
| **Language** | TypeScript 5 |
| **Navigation** | Expo Router v4 (file-based routing) |
| **State** | Zustand + TanStack React Query |
| **Commerce** | Shopify Storefront API (GraphQL) |
| **Payments** | Razorpay |
| **Analytics** | Mixpanel + CleverTap |
| **Push Notifications** | OneSignal + CleverTap Push |
| **Loyalty** | Nector Platform |
| **Maps** | Google Maps / Places API (react-native-maps) |
| **Attribution** | AppsFlyer |
| **Support** | Freshchat SDK |
| **Search** | Self-hosted search engine + Searchanise |
| **Animation** | React Native Reanimated + Skia |

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (see `.nvmrc`) |
| Expo CLI | Latest (`npm i -g expo-cli`) |
| Android Studio | For Android builds |
| Xcode | 15+ for iOS builds (macOS only) |
| CocoaPods | For iOS native dependencies |

### 1. Clone & Install

```bash
git clone git@github.com:mk0904/kiddo-babycare-v4.git
cd kiddo-babycare-v4
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in all the required values (see [Environment Variables](#-environment-variables) below).

### 3. iOS Setup (macOS only)

```bash
cd ios && pod install && cd ..
```

### 4. Run the App

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Start Metro bundler only
npm start
```

---

## 🔐 Environment Variables

All secrets are loaded via `.env` (never committed to git). Copy `.env.example` to `.env` and populate:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_BACKEND_API_BASE` | Kiddo backend service base URL |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps & Places API key |
| `EXPO_PUBLIC_MIXPANEL_TOKEN` | Mixpanel project token |
| `EXPO_PUBLIC_CLEVERTAP_ACCOUNT_ID` | CleverTap Account ID |
| `EXPO_PUBLIC_CLEVERTAP_ACCOUNT_TOKEN` | CleverTap Account Token |
| `EXPO_PUBLIC_CLEVERTAP_FCM_SENDER_ID` | Firebase Cloud Messaging Sender ID |
| `EXPO_PUBLIC_NECTOR_API_KEY` | Nector read-only API key |
| `EXPO_PUBLIC_NECTOR_WORKSPACE_ID` | Nector workspace ID |
| `EXPO_PUBLIC_NECTOR_LEAD_ID` | Nector lead ID |
| `EXPO_PUBLIC_NECTOR_RAZORPAY_SECRET_ID` | Nector × Razorpay secret |
| `EXPO_PUBLIC_SEARCHANISE_API_KEY` | Searchanise API key |
| `EXPO_PUBLIC_SELF_SEARCH_API_KEY` | Self-hosted search engine API key |
| `EXPO_PUBLIC_KIDDO_SECRET` | Internal service authentication secret |
| `EXPO_PUBLIC_APPSFLYER_DEV_KEY` | AppsFlyer dev key *(optional)* |
| `EXPO_PUBLIC_APPSFLYER_IOS_APP_ID` | App Store app ID for AppsFlyer *(optional)* |

> **Note:** `app.json` must also have `googleMapsApiKey` set for native map builds. For CI/CD, inject this via EAS Secrets or your pipeline's secret manager.

---

## 📦 Building for Production

### Android

```bash
# Debug APK (fast)
npm run android

# Release APK
npm run android:release

# Or use EAS Build
eas build --platform android --profile production
```

### iOS

```bash
# Local build via Xcode
npm run ios

# EAS Build (recommended for distribution)
eas build --platform ios --profile production
```

---

## 🗂️ Notable Scripts

| Script | Command | Description |
|---|---|---|
| Start Metro | `npm start` | Start the bundler |
| Run Android | `npm run android` | Build & launch on Android |
| Run iOS | `npm run ios` | Build & launch on iOS Simulator |
| Android Release | `npm run android:release` | Build signed release APK |
| Clean Android | `npm run android:clean` | Clean Gradle build cache |
| Lint | `npm run lint` | ESLint check |
| iOS Pods | `npm run ios:pods` | Re-install CocoaPods |

---

## 📋 Project Conventions

- **File-based routing** — All screens live in `app/`. Naming follows Expo Router conventions (`[id].tsx` for dynamic routes, `(group)/` for layout groups).
- **Services layer** — All API calls go through `services/`. Components never call APIs directly.
- **Zustand stores** — Persistent state (cart, user) lives in `store/`. Keep stores small and composable.
- **Environment variables** — All runtime secrets must come from `.env` / `EXPO_PUBLIC_*`. No hardcoded credentials.
- **TypeScript** — Strict mode enabled. All new code should be typed.

---

## 🔗 Related Services

| Service | Purpose |
|---|---|
| [Shopify](https://shopify.com) | E-commerce backend (products, orders, checkout) |
| [Razorpay](https://razorpay.com) | Payment gateway |
| [CleverTap](https://clevertap.com) | Marketing automation & push notifications |
| [OneSignal](https://onesignal.com) | Push notification delivery |
| [Mixpanel](https://mixpanel.com) | Product analytics |
| [AppsFlyer](https://appsflyer.com) | Mobile attribution & deep linking |
| [Nector](https://nector.io) | Loyalty & rewards platform |
| [Freshchat](https://freshchat.com) | In-app customer support chat |
| [Google Maps](https://developers.google.com/maps) | Address autocomplete & delivery maps |

---

## 📄 License

This project is proprietary software. All rights reserved © 2025–2026 Kiddo / AllForKiddo.

---

<div align="center">
  Built with ❤️ for little ones everywhere
</div>
