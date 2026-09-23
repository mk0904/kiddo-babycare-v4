/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, TextStyle } from 'react-native';

/** Font weight values typed for React Native TextStyle so they can be used in fontWeight. */
const fontWeight = {
  Regular: '400',
  Medium: '500',
  SemiBold: '600',
  Bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  xxxxl: 24,
} as const satisfies Record<string, number>;

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#fc5d5b',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  // Quick commerce app colors (from Kiddo)
  primary: '#fc5d5b',
  primary_light: '#fd7a78',
  grey: '#fefcf9',
  secondary: '#ff8a88',
  text: '#363636',
  textSecondary: '#9197a6',
  disabled: '#9197a6',
  border: '#d0d4dc',
  backgroundSecondary: '#fff5f4',
  backgroundWhite: '#FFFFFF',
  success: '#28A745',
  error: '#EF4444',
  /** Selected size/variant chip: border + label text (same hex) */
  variantSelection: '#DB5656',
};

export const Fonts = {
  Regular: 'Metropolis-Regular',
  Medium: 'Metropolis-Medium',
  SemiBold: 'Metropolis-SemiBold',
  Bold: 'Metropolis-Bold',
  ExtraBold: 'Metropolis-ExtraBold',
  Black: 'Metropolis-Black',
  Bogart: 'Bogart-SemiBold',
  Lexend: 'Lexend-SemiBold',
  LexendRegular: 'Lexend-Regular',
  LexendMedium: 'Lexend-Medium',
  LexendSemiBold: 'Lexend-SemiBold',
  LexendBold: 'Lexend-Bold',
  /** Fredoka SemiBold (600) — loaded in app/_layout via @expo-google-fonts/fredoka */
  FredokaSemiBold: 'Fredoka_600SemiBold',
  RegularWeight: fontWeight.Regular,
  MediumWeight: fontWeight.Medium,
  SemiBoldWeight: fontWeight.SemiBold,
  BoldWeight: fontWeight.Bold,
  ExtraSmallFontSize: FontSizes.xs,
  SmallFontSize: FontSizes.sm,
  MediumFontSize: FontSizes.md,
  LargeFontSize: FontSizes.lg,
  XLargeFontSize: FontSizes.xl,
  XXLargeFontSize: FontSizes.xxl,
  // Keep original platform select for backward compatibility if needed, but the above are what Kiddo uses
  ...Platform.select({
    ios: {
      sans: 'system-ui',
      serif: 'ui-serif',
      rounded: 'ui-rounded',
      mono: 'ui-monospace',
    },
    default: {
      sans: 'normal',
      serif: 'serif',
      rounded: 'normal',
      mono: 'monospace',
    },
    web: {
      sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      serif: "Georgia, 'Times New Roman', serif",
      rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
      mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
  }),
};
