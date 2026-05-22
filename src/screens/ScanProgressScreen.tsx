import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface ScanProgressScreenProps {
  classifierDiagnostic: string;
  isDarkMode: boolean;
}

export function ScanProgressScreen({
  classifierDiagnostic,
  isDarkMode,
}: ScanProgressScreenProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = isDarkMode ? darkStyles : lightStyles;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contentContainer,
        palette.background,
        {paddingBottom: safeAreaInsets.bottom + 24, paddingTop: safeAreaInsets.top + 16},
      ]}>
      <Text style={[styles.title, palette.title]}>
        Scanning selected folder
      </Text>
      <Text style={[styles.subtitle, palette.subtitle]}>
        Gathering file metadata and classifier hints…
      </Text>
      <ActivityIndicator size="large" style={styles.loading} />
      <Text testID="classifier-diagnostic" style={styles.diagnosticText}>
        {classifierDiagnostic}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: '100%',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  loading: {
    marginVertical: 6,
  },
  diagnosticText: {
    color: '#4b5563',
    fontWeight: '600',
    textAlign: 'center',
  },
});

const lightStyles = StyleSheet.create({
  background: {
    backgroundColor: '#f8fafc',
  },
  title: {
    color: '#111827',
  },
  subtitle: {
    color: '#4b5563',
  },
});

const darkStyles = StyleSheet.create({
  background: {
    backgroundColor: '#030712',
  },
  title: {
    color: '#f9fafb',
  },
  subtitle: {
    color: '#9ca3af',
  },
});
