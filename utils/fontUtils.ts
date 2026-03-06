import { Fonts } from '@/constants/theme';

/** Config-friendly font family aliases → actual font names (from theme). Use these in kiddoAppConfig. */
const FONT_FAMILY_ALIASES: Record<string, string> = {
  regular: Fonts.Regular,
  medium: Fonts.Medium,
  semibold: Fonts.SemiBold,
  'semi-bold': Fonts.SemiBold,
  bold: Fonts.Bold,
  extrabold: Fonts.ExtraBold,
  'extra-bold': Fonts.ExtraBold,
  black: Fonts.Black,
  // Exact names (so config can use "Metropolis-Bold" etc.)
  [Fonts.Regular]: Fonts.Regular,
  [Fonts.Medium]: Fonts.Medium,
  [Fonts.SemiBold]: Fonts.SemiBold,
  [Fonts.Bold]: Fonts.Bold,
  [Fonts.ExtraBold]: Fonts.ExtraBold,
  [Fonts.Black]: Fonts.Black,
};

/**
 * Resolves fontFamily from config: alias (e.g. "bold", "medium") or exact name (e.g. "Metropolis-Bold").
 */
export function resolveFontFamilyFromConfig(fontFamily?: string): string | undefined {
  if (!fontFamily || typeof fontFamily !== 'string') return undefined;
  const key = fontFamily.trim().toLowerCase();
  return FONT_FAMILY_ALIASES[key] ?? FONT_FAMILY_ALIASES[fontFamily.trim()] ?? fontFamily;
}

/**
 * Converts fontWeight to Fonts constant
 * @param fontWeight - Font weight value (string or number)
 * @returns Fonts constant string
 */
export function fontWeightToFontFamily(fontWeight?: string | number | 'normal' | 'bold'): string {
  if (!fontWeight) return Fonts.Regular;

  // Handle string values
  if (typeof fontWeight === 'string') {
    const weight = fontWeight.trim().toLowerCase();
    if (weight === 'black' || weight === '900') return Fonts.Black;
    if (weight === 'extrabold' || weight === 'extra-bold' || weight === '800') return Fonts.ExtraBold;
    if (weight === 'bold' || weight === '700') return Fonts.Bold;
    if (weight === 'semibold' || weight === 'semi-bold' || weight === '600') return Fonts.SemiBold;
    if (weight === 'medium' || weight === '500') return Fonts.Medium;
    if (weight === 'normal' || weight === '400') return Fonts.Regular;
  }

  // Handle numeric values
  if (typeof fontWeight === 'number') {
    if (fontWeight >= 900) return Fonts.Black;
    if (fontWeight >= 800) return Fonts.ExtraBold;
    if (fontWeight >= 700) return Fonts.Bold;
    if (fontWeight >= 600) return Fonts.SemiBold;
    if (fontWeight >= 500) return Fonts.Medium;
    return Fonts.Regular;
  }

  return Fonts.Regular;
}

/**
 * Processes style object from config: resolves fontFamily (aliases or exact name), fontWeight → fontFamily, and passes through fontStyle.
 * Use in block styles.title, styles.text, styles.heading, etc.
 * Config can set: fontFamily ("bold" | "medium" | "Metropolis-Bold" | ...), fontWeight ("700" | 600 | ...), fontStyle ("normal" | "italic").
 *
 * @param style - Style object from config (e.g. block.styles.title)
 * @param defaultFontFamily - Default font family when none specified
 * @returns Style object with fontFamily (and fontStyle if provided) for React Native Text
 */
export function processFontStyle(
  style?: Record<string, any>,
  defaultFontFamily?: string
): Record<string, any> {
  if (!style) return {};

  const { fontWeight, fontFamily: rawFontFamily, fontStyle, ...rest } = style;

  let fontFamily: string | undefined;

  if (rawFontFamily) {
    fontFamily = resolveFontFamilyFromConfig(rawFontFamily) ?? rawFontFamily;
  } else if (fontWeight !== undefined) {
    fontFamily = fontWeightToFontFamily(fontWeight);
  } else if (defaultFontFamily) {
    fontFamily = defaultFontFamily;
  }

  const result: Record<string, any> = { ...rest };
  if (fontFamily) result.fontFamily = fontFamily;
  if (fontStyle !== undefined) result.fontStyle = fontStyle;

  return result;
}
