import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo-mark';
import { Brand, BrandFonts } from '@/constants/brand';

export default function GuideScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View pointerEvents="none" style={styles.bgOrbTop} />
        <View pointerEvents="none" style={styles.bgOrbBottom} />

        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <LogoMark size={46} />
            <View>
              <Text style={styles.headerTitle}>Guide rapide</Text>
              <Text style={styles.headerSub}>DistriResto operations quotidiennes</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Demarrage</Text>
          <Text style={styles.cardText}>1. Connecte-toi avec ton role.</Text>
          <Text style={styles.cardText}>2. Choisis la date et charge les BL.</Text>
          <Text style={styles.cardText}>3. Enregistre ou mets a jour la selection.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Responsable BL</Text>
          <Text style={styles.cardText}>- Selectionne les BL du lendemain.</Text>
          <Text style={styles.cardText}>- Tu peux cocher ou decocher puis mettre a jour.</Text>
          <Text style={styles.cardText}>- Les changements sont sauvegardes dans l API.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preparateur</Text>
          <Text style={styles.cardText}>- Ouvre un BL et controle les produits.</Text>
          <Text style={styles.cardText}>- Choisis un statut et ajuste la quantite si partiel.</Text>
          <Text style={styles.cardText}>- Envoie le rapport une fois termine.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin</Text>
          <Text style={styles.cardText}>- Consulte les rapports de preparation.</Text>
          <Text style={styles.cardText}>- Ouvre un rapport pour voir les details.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bone,
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  bgOrbTop: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(243, 107, 28, 0.16)',
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 9, 7, 0.12)',
  },
  headerCard: {
    backgroundColor: Brand.ink,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.inkSoft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: Brand.bone,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: BrandFonts.title,
  },
  headerSub: {
    color: Brand.emberGlow,
    marginTop: 4,
    fontWeight: '600',
    fontFamily: BrandFonts.body,
  },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: Brand.ink,
    fontWeight: '800',
    fontSize: 16,
    fontFamily: BrandFonts.title,
  },
  cardText: {
    color: Brand.inkSoft,
    fontSize: 13,
    fontFamily: BrandFonts.body,
  },
});
