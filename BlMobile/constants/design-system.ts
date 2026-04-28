import { Platform, TextStyle } from 'react-native';

const fontFamilies = {
  ios: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold: 'sans-serif',
  },
  web: {
    regular: 'system-ui, sans-serif',
    medium: 'system-ui, sans-serif',
    semibold: 'system-ui, sans-serif',
    bold: 'system-ui, sans-serif',
  },
};

function font(weight: keyof typeof fontFamilies.ios): TextStyle {
  const platform = Platform.OS;
  const fonts = fontFamilies[platform] || fontFamilies.web;
  return { fontFamily: fonts[weight], fontWeight: weight === 'bold' ? '700' : weight === 'semibold' ? '600' : weight === 'medium' ? '500' : '400' };
}

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

export const Typography = {
  h1: { ...font('bold'), fontSize: 32, lineHeight: 40, letterSpacing: -0.5 } as TextStyle,
  h2: { ...font('bold'), fontSize: 24, lineHeight: 32, letterSpacing: -0.25 } as TextStyle,
  h3: { ...font('semibold'), fontSize: 20, lineHeight: 28 } as TextStyle,
  h4: { ...font('semibold'), fontSize: 18, lineHeight: 26 } as TextStyle,
  body: { ...font('regular'), fontSize: 16, lineHeight: 24 } as TextStyle,
  bodySmall: { ...font('regular'), fontSize: 14, lineHeight: 20 } as TextStyle,
  caption: { ...font('regular'), fontSize: 12, lineHeight: 16 } as TextStyle,
  button: { ...font('semibold'), fontSize: 14, lineHeight: 20, letterSpacing: 0.5 } as TextStyle,
  buttonSmall: { ...font('semibold'), fontSize: 12, lineHeight: 16, letterSpacing: 0.5 } as TextStyle,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export type SpacingKey = keyof typeof Spacing;
export type TypographyKey = keyof typeof Typography;