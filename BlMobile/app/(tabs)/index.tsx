import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArticleScannerScreen } from '@/components/bl/article-scanner-screen';
import { Brand } from '@/constants/brand';

export default function ArticlesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recherche article</Text>
        <Text style={styles.headerSub}>Recherchez par désignation ou scannez un code barre</Text>
      </View>
      <ArticleScannerScreen token="" fullName="" onClose={() => {}} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.ink,
  },
  headerSub: {
    fontSize: 13,
    color: Brand.muted,
    marginTop: 3,
  },
});
