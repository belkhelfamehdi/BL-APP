import { Platform } from 'react-native';

export const Brand = {
  ink: '#0b0b0b',
  inkSoft: '#16110d',
  ember: '#f36b1c',
  emberDark: '#d14f05',
  emberGlow: '#ffb88f',
  bone: '#f8f3ee',
  sand: '#eee1d6',
  card: '#ffffff',
  border: '#e6d6c8',
  muted: '#7b6f65',
  success: '#1f8a5f',
  danger: '#b42318',
};

export const BrandFonts = {
  title: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
    web: 'Georgia, serif',
  }),
  body: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif',
    default: 'sans-serif',
    web: "'Source Sans 3', 'Segoe UI', sans-serif",
  }),
};
