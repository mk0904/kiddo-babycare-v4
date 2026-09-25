/**
 * Deep link parsing, shared by every entry point that can hand us a URL:
 * CleverTap push taps (`wzrk_dl`), OneSignal `launch_url`, App Links / Universal Links,
 * and the custom `app://` and `kiddo://` schemes.
 *
 * Kept free of React Native imports so it can be unit tested in plain node.
 *
 * Note on parsing: this deliberately does NOT use `new URL()`. Hermes' URL implementation is
 * incomplete and mis-parses custom schemes (`kiddo://orders/1` yields an empty pathname on some
 * engine versions), which is precisely the input we care most about.
 */

/** Hosts whose web URLs belong to us — see `android:host` in AndroidManifest and `applinks:` in Kiddo.entitlements. */
export const KIDDO_WEB_HOSTS = ['allforkiddo.com', 'www.allforkiddo.com'];

/** AppsFlyer OneLink. Its URLs are resolved by the AppsFlyer SDK, not by us. */
export const APPSFLYER_HOSTS = ['kiddo-app.onelink.me'];

/** Custom schemes registered for the app. Must stay in sync with `scheme` in app.json,
 *  `<data android:scheme=…>` in AndroidManifest.xml and CFBundleURLSchemes in Info.plist. */
export const KIDDO_APP_SCHEMES = ['app', 'kiddo'];

/**
 * First path segment of every route group in `app/`. A URL whose first segment is one of these
 * is already an app route and is passed through untouched, whatever host it arrived on — which is
 * what lets `https://allforkiddo.com/orders/123` and `kiddo://orders/123` behave identically.
 */
export const APP_ROUTE_ROOTS = [
  'about-us',
  'address',
  'cart',
  'category',
  'curated',
  'demo',
  'infinity',
  'modal',
  'order-success',
  'orders',
  'privacy-policy',
  'products',
  'profile',
  'referral',
  'return-refund',
  'returns',
  'rewards',
  'search',
  'support',
  'terms-conditions',
  'ticketing',
  'try-and-buy',
  'wallet',
  'webview',
  'wishlist',
  'account',
];

/**
 * Paths that are spelled one way by whoever writes the link and another way in `app/`.
 *
 * Applies to every scheme, not just the website: campaigns are written by hand and use the
 * storefront's vocabulary ("collection") rather than the route names ("infinity"), and singular
 * forms creep in. Sending those through unchanged lands the user on expo-router's Unmatched
 * screen, which from a push notification looks like the app is broken.
 */
const PATH_ALIASES: { match: RegExp; to: (m: RegExpMatchArray) => string }[] = [
  // A collection is /infinity/<numeric id> in the app. Both spellings, singular and plural:
  // `kiddo://collection/511117328673` is what the live campaigns send.
  { match: /^\/collections?\/(\d+)$/, to: (m) => `/infinity/${m[1]}` },
  { match: /^\/collections?\/gid:\/\/shopify\/Collection\/(\d+)$/i, to: (m) => `/infinity/${m[1]}` },

  // Singular forms of routes that are plural in `app/`.
  { match: /^\/product\/([^/]+)$/, to: (m) => `/products/${m[1]}` },
  { match: /^\/order\/([^/]+)$/, to: (m) => `/orders/${m[1]}` },
  { match: /^\/return\/([^/]+)$/, to: (m) => `/returns/${m[1]}` },

  // /products/<handle> — the PDP accepts a handle in place of an id (see app/products/[id].tsx)
  { match: /^\/products\/([^/]+)$/, to: (m) => `/products/${m[1]}` },
  { match: /^\/cart\/?$/, to: () => '/cart' },
  { match: /^\/account\/?$/, to: () => '/account' },
  { match: /^\/account\/login\/?$/, to: () => '/account' },
  { match: /^\/pages\/about-us\/?$/, to: () => '/about-us' },
  { match: /^\/pages\/privacy-policy\/?$/, to: () => '/privacy-policy' },
  { match: /^\/pages\/terms-conditions\/?$/, to: () => '/terms-conditions' },
  { match: /^\/pages\/return-refund\/?$/, to: () => '/return-refund' },
  { match: /^\/?$/, to: () => '/' },
];

export type ParsedDeepLink =
  /** Navigate here with expo-router. */
  | { kind: 'route'; path: string }
  /** Ours, but no native screen for it — show it in the in-app browser. */
  | { kind: 'web'; url: string }
  /** Someone else's URL, or an AppsFlyer link the AppsFlyer SDK will resolve. Do not navigate. */
  | { kind: 'ignore'; reason: string };

type UrlParts = { scheme: string; host: string; path: string; query: string };

/** Split a URL without relying on the engine's URL implementation. */
export function splitUrl(raw: string): UrlParts | null {
  const url = (raw ?? '').trim();
  if (!url) return null;

  // Bare path, e.g. "/orders/123" or "orders/123" — treated as an app route.
  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(url)) {
    const [pathPart, ...rest] = url.split('?');
    return {
      scheme: '',
      host: '',
      path: pathPart.startsWith('/') ? pathPart : `/${pathPart}`,
      query: rest.length ? `?${rest.join('?')}` : '',
    };
  }

  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):(\/\/)?([^/?#]*)?([^?#]*)?(\?[^#]*)?/.exec(url);
  if (!m) return null;

  const scheme = (m[1] || '').toLowerCase();
  const hadAuthority = Boolean(m[2]);
  const authority = m[3] || '';
  let path = m[4] || '';
  const query = m[5] || '';

  // What follows `://` is only sometimes a host.
  //
  //   https://allforkiddo.com/orders/1   -> host, drop it
  //   kiddo://orders/28893               -> NOT a host; `orders` is the first path segment
  //   kiddo://allforkiddo.com/infinity/1 -> a host after all — campaigns are written this way
  //
  // That last shape is a malformed hybrid of the two valid forms, and it is what the live
  // CleverTap campaigns send. Left alone it routes to `/allforkiddo.com/infinity/1` and lands on
  // the Unmatched screen (expo-router's own `fromDeepLink` concatenates host + pathname, so the
  // native path gets this wrong too). Treat a domain-shaped authority as a host whatever the
  // scheme; no app route segment contains a dot, so this cannot swallow a real route.
  const schemeHasHost = scheme === 'http' || scheme === 'https';
  const authorityLooksLikeDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(authority);
  const host = hadAuthority && (schemeHasHost || authorityLooksLikeDomain)
    ? authority.toLowerCase()
    : '';

  if (!schemeHasHost && host) {
    console.warn(
      `[DeepLink] "${scheme}://${host}${path}" mixes a custom scheme with a web host. ` +
      `Dropping the host; the canonical forms are "${scheme}://${path.replace(/^\//, '')}" ` +
      `or "https://${host}${path}". Fix the campaign to avoid relying on this.`
    );
  }

  if (!host && authority) path = `/${authority}${path}`;

  if (!path.startsWith('/')) path = `/${path}`;
  return { scheme, host, path, query };
}

/** Strip a trailing slash but keep the root "/". */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '') || '/';
  return path || '/';
}

function firstSegment(path: string): string {
  return normalizePath(path).split('/').filter(Boolean)[0] ?? '';
}

/**
 * Turn any inbound URL into a navigation decision.
 *
 * @param raw  the URL as the sender wrote it
 * @param opts `webFallback` (default true) sends unmapped URLs on our own hosts to the in-app
 *             browser instead of dropping them.
 */
export function parseDeepLink(
  raw: string | null | undefined,
  opts: { webFallback?: boolean } = {}
): ParsedDeepLink {
  const webFallback = opts.webFallback !== false;
  const parts = splitUrl(raw ?? '');
  if (!parts) return { kind: 'ignore', reason: 'empty' };

  const { scheme, host, query } = parts;
  const path = normalizePath(parts.path);

  // AppsFlyer OneLink: the SDK's deferred-deep-link callback resolves these. Handling them here
  // too would navigate twice, to two different places.
  if (APPSFLYER_HOSTS.includes(host)) {
    return { kind: 'ignore', reason: 'appsflyer_onelink' };
  }

  const isOwnScheme = KIDDO_APP_SCHEMES.includes(scheme);
  const isOwnWeb = (scheme === 'http' || scheme === 'https') && KIDDO_WEB_HOSTS.includes(host);
  const isBarePath = scheme === '';

  if (!isOwnScheme && !isOwnWeb && !isBarePath) {
    return { kind: 'ignore', reason: scheme ? `foreign_scheme:${scheme}` : 'unknown' };
  }

  // Aliases run first because they are the more specific rule: `/account/login` sits under the
  // `account` root but is a storefront path, and must map to `/account` rather than pass through
  // to a route that does not exist.
  for (const alias of PATH_ALIASES) {
    const m = path.match(alias.match);
    if (m) return { kind: 'route', path: `${alias.to(m)}${query}` };
  }

  // Anything that is already an app route passes through untouched.
  const isKnownRoute = APP_ROUTE_ROOTS.includes(firstSegment(path));
  if (isKnownRoute) {
    return { kind: 'route', path: `${path}${query}` };
  }

  // A custom-scheme link naming a route that does not exist. There is no web URL to fall back to,
  // and pushing it would show expo-router's "Unmatched Route" screen — a debug page, from a
  // marketing push. Home is the honest landing, and the warning names the link so the campaign
  // can be found and fixed.
  if (isOwnScheme || isBarePath) {
    console.warn(
      `[DeepLink] "${raw}" does not match any route in app/. Known roots: ` +
      `${APP_ROUTE_ROOTS.join(', ')}. Falling back to home.`
    );
    return { kind: 'route', path: '/' };
  }

  // Our website, on a page with no app screen (collection handles, blog posts, campaign pages) —
  // show it in the in-app browser.
  const full = `${scheme}://${host}${path}${query}`;
  return webFallback
    ? { kind: 'web', url: full }
    : { kind: 'ignore', reason: 'unmapped_web_path' };
}

/** CleverTap puts the deep link in `wzrk_dl`; the aliases cover hand-built payloads. */
export const DEEP_LINK_PAYLOAD_KEYS = ['wzrk_dl', 'deeplink', 'deep_link', 'url', 'launch_url'];

/** Pull a deep link out of a push payload, whatever shape the provider used. */
export function deepLinkFromPushPayload(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [payload, payload.data, payload.additionalData, payload.custom?.a];
  for (const source of candidates) {
    if (!source || typeof source !== 'object') continue;
    for (const key of DEEP_LINK_PAYLOAD_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}
