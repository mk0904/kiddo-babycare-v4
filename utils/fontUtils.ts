import { Fonts } from '@/constants/theme';

/**
 * Converts fontWeight to Fonts constant
 * @param fontWeight - Font weight value (string or number)
 * @returns Fonts constant string
 */
export function fontWeightToFontFamily(fontWeight?: string | number | 'normal' | 'bold'): string {
  if (!fontWeight) return Fonts.Regular;
  
  // Handle string values
  if (typeof fontWeight === 'string') {
    const weight = fontWeight.trim();
    if (weight === 'bold' || weight === '700' || weight.toLowerCase() === 'bold') return Fonts.Bold;
    if (weight === 'normal' || weight === '400' || weight.toLowerCase() === 'normal') return Fonts.Regular;
    if (weight === '500') return Fonts.Medium;
    if (weight === '600') return Fonts.SemiBold;
  }
  
  // Handle numeric values
  if (typeof fontWeight === 'number') {
    if (fontWeight >= 700) return Fonts.Bold;
    if (fontWeight >= 600) return Fonts.SemiBold;
    if (fontWeight >= 500) return Fonts.Medium;
    return Fonts.Regular;
  }
  
  return Fonts.Regular;
}

/**
 * Processes style object to convert fontWeight to fontFamily
 * @param style - Style object that may contain fontWeight
 * @param defaultFontFamily - Default font family to use if no fontWeight is provided
 * @returns Style object with fontFamily instead of fontWeight
 */
export function processFontStyle(
  style?: Record<string, any>,
  defaultFontFamily?: string
): Record<string, any> {
  if (!style) return {};
  
  const { fontWeight, fontFamily, ...rest } = style;
  
  // If fontFamily is explicitly provided, use it
  if (fontFamily) {
    return { ...rest, fontFamily };
  }
  
  // If fontWeight is provided, convert it to fontFamily
  if (fontWeight !== undefined) {
    return { ...rest, fontFamily: fontWeightToFontFamily(fontWeight) };
  }
  
  // Use default font family if provided
  if (defaultFontFamily) {
    return { ...rest, fontFamily: defaultFontFamily };
  }
  
  return rest;
}
