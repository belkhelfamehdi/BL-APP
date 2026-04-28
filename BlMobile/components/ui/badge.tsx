import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { Brand } from '@/constants/brand';
import { BorderRadius, Spacing, Typography } from '@/constants/design-system';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantStyles = {
  default: { bg: Brand.sand, text: Brand.inkLight },
  success: { bg: Brand.accentLight, text: Brand.accent },
  warning: { bg: '#fef3e0', text: Brand.warning },
  danger: { bg: '#fdecea', text: Brand.danger },
};

export function Badge({ children, variant = 'default', style, ...props }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]} {...props}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
  },
});