import React from 'react';
import {Button, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {ErrorState, PermissionRequiredState} from './StatusStates';

interface PickFolderScreenProps {
  cloudTierEnabled: boolean;
  classifierDiagnostic: string;
  errorMessage: string | null;
  isDarkMode: boolean;
  onCloudTierEnabledChange: (value: boolean) => void;
  onScan: () => void;
  permissionMessage: string | null;
}

export function PickFolderScreen({
  cloudTierEnabled,
  classifierDiagnostic,
  errorMessage,
  isDarkMode,
  onCloudTierEnabledChange,
  onScan,
  permissionMessage,
}: PickFolderScreenProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = isDarkMode ? darkStyles : lightStyles;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contentContainer,
        palette.background,
        {
          paddingBottom: safeAreaInsets.bottom + 24,
          paddingTop: safeAreaInsets.top + 16,
        },
      ]}>
      <Text style={[styles.title, palette.title]}>FileSage DownloadSorter</Text>
      <Text style={[styles.subtitle, palette.subtitle]}>
        Read-only scan for any selected folder
      </Text>

      <View style={[styles.settingsCard, palette.settingsCard]}>
        <View style={styles.settingHeader}>
          <Text style={[styles.settingTitle, palette.title]}>Tier 3: cloud classification</Text>
          <Switch
            testID="cloud-tier-toggle"
            value={cloudTierEnabled}
            onValueChange={onCloudTierEnabledChange}
          />
        </View>
        <Text style={styles.warningText}>
          Privacy warning: when enabled, file metadata or extracted text may be
          sent to cloud services for classification.
        </Text>
      </View>

      {permissionMessage ? (
        <PermissionRequiredState
          isDarkMode={isDarkMode}
          message={permissionMessage}
          title="Permission required"
        />
      ) : null}

      {errorMessage ? (
        <ErrorState isDarkMode={isDarkMode} message={errorMessage} title="Scan failed" />
      ) : null}

      <Text testID="classifier-diagnostic" style={styles.diagnosticText}>
        {classifierDiagnostic}
      </Text>

      <View style={styles.scanButtonContainer}>
        <Button title="Scan Folder" onPress={onScan} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 12,
    minHeight: '100%',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  settingsCard: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  settingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    color: '#dc2626',
    fontSize: 12,
  },
  diagnosticText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  scanButtonContainer: {
    marginTop: 4,
  },
});

const lightStyles = StyleSheet.create({
  background: {
    backgroundColor: '#f8fafc',
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
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
  settingsCard: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  title: {
    color: '#f9fafb',
  },
  subtitle: {
    color: '#9ca3af',
  },
});
