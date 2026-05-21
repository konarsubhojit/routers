import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

interface StateProps {
  isDarkMode: boolean;
  title: string;
  message: string;
}

export function EmptyState({isDarkMode, title, message}: StateProps) {
  const tone = isDarkMode ? darkStyles.emptyCard : lightStyles.emptyCard;
  const titleTone = isDarkMode ? darkStyles.textPrimary : lightStyles.textPrimary;
  const messageTone = isDarkMode ? darkStyles.textMuted : lightStyles.textMuted;

  return (
    <View style={[styles.card, tone]}>
      <Text style={[styles.title, titleTone]}>{title}</Text>
      <Text style={[styles.message, messageTone]}>{message}</Text>
    </View>
  );
}

export function ErrorState({isDarkMode, title, message}: StateProps) {
  const tone = isDarkMode ? darkStyles.errorCard : lightStyles.errorCard;

  return (
    <View style={[styles.card, tone]}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
    </View>
  );
}

export function PermissionRequiredState({
  isDarkMode,
  title,
  message,
}: StateProps) {
  const tone = isDarkMode ? darkStyles.permissionCard : lightStyles.permissionCard;

  return (
    <View style={[styles.card, tone]}>
      <Text style={styles.permissionTitle}>{title}</Text>
      <Text style={styles.permissionMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
  errorMessage: {
    color: '#fca5a5',
    fontSize: 14,
  },
  permissionTitle: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionMessage: {
    color: '#bfdbfe',
    fontSize: 14,
  },
});

const lightStyles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  permissionCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  textPrimary: {
    color: '#111827',
  },
  textMuted: {
    color: '#4b5563',
  },
});

const darkStyles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  errorCard: {
    backgroundColor: '#451a1a',
    borderColor: '#7f1d1d',
  },
  permissionCard: {
    backgroundColor: '#172554',
    borderColor: '#1d4ed8',
  },
  textPrimary: {
    color: '#f9fafb',
  },
  textMuted: {
    color: '#9ca3af',
  },
});
