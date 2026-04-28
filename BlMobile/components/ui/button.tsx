import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle } from 'react-native';
import { Brand } from '@/constants/brand';
import { BorderRadius, Spacing, Typography } from '@/constants/design-system';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, { bg: string; text: string; border: string | null; pressedBg: string }> = {
  primary: { bg: Brand.accent, text: '#fff', border: null, pressedBg: Brand.accentDark },
  secondary: { bg: Brand.sand, text: Brand.ink, border: Brand.border, pressedBg: Brand.border },
  ghost: { bg: 'transparent', text: Brand.ink, border: null, pressedBg: Brand.sand },
  danger: { bg: Brand.danger, text: '#fff', border: null, pressedBg: '#c0392b' },
};

const sizes: Record<ButtonSize, { height: number; px: number; font: TextStyle }> = {
  sm: { height: 36, px: Spacing.md, font: Typography.buttonSmall },
  md: { height: 44, px: Spacing.lg, font: Typography.button },
  lg: { height: 52, px: Spacing.xl, font: Typography.button },
};

export const Button = forwardRef<typeof Pressable, ButtonProps>(function Button(
  { children, onPress, variant = 'primary', size = 'md', disabled, loading, fullWidth },
  ref
) {
  const v = variants[variant];
  const s = sizes[size];

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? v.pressedBg : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1 : 0,
          height: s.height,
          paddingHorizontal: s.px,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.5 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[s.font, { color: v.text, textAlign: 'center' }]}>{children}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});