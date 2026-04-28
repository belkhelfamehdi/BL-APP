import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { Brand } from '@/constants/brand';
import { Spacing, Typography } from '@/constants/design-system';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Loading({ size = 'md', text }: LoadingProps) {
  const sizeMap = { sm: 16, md: 24, lg: 32 };
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size === 'sm' ? 'small' : 'large'} color={Brand.ink} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description && <Text style={styles.emptyDescription}>{description}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  text: {
    ...Typography.bodySmall,
    color: Brand.muted,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  icon: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Brand.ink,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptyDescription: {
    ...Typography.bodySmall,
    color: Brand.muted,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.lg,
  },
});