import { forwardRef, type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { Brand } from '@/constants/brand';
import { BorderRadius, Spacing, Typography } from '@/constants/design-system';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, leftIcon, rightIcon, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: any) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, leftIcon && styles.inputWithLeftIcon, rightIcon && styles.inputWithRightIcon]}
          placeholderTextColor={Brand.muted}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

interface CardProps extends ViewProps {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, padding = 'md', style, ...props }: CardProps) {
  const paddingMap = { none: 0, sm: Spacing.sm, md: Spacing.lg, lg: Spacing.xl };
  return (
    <View style={[styles.card, { padding: paddingMap[padding] }, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodySmall,
    color: Brand.ink,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: BorderRadius.md,
  },
  inputFocused: {
    borderColor: Brand.ink,
  },
  inputError: {
    borderColor: Brand.danger,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Brand.ink,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.xs,
  },
  iconLeft: {
    paddingLeft: Spacing.md,
  },
  iconRight: {
    paddingRight: Spacing.md,
  },
  error: {
    ...Typography.caption,
    color: Brand.danger,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Brand.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
  },
});