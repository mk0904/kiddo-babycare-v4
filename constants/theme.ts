/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

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
};

export const Fonts = {
  Regular: 'Metropolis-Regular',
  Medium: 'Metropolis-Medium',
  SemiBold: 'Metropolis-SemiBold',
  Bold: 'Metropolis-Bold',
  ExtraBold: 'Metropolis-ExtraBold',
  Black: 'Metropolis-Black',
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
