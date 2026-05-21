import React, {useMemo} from 'react';
import {Button, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {ExtensionBucket} from '../preprocess/extensionBuckets';
import {BucketGroup, ScannedFileViewModel} from './types';
import {EmptyState} from './StatusStates';

interface ReviewScreenProps {
  groupedFiles: BucketGroup[];
  isDarkMode: boolean;
  onRescan: () => void;
  onToggleBucketCollapsed: (bucket: ExtensionBucket) => void;
  onToggleFileSelected: (uri: string) => void;
  selectedUris: Set<string>;
  collapsedBuckets: Set<ExtensionBucket>;
}

export function ReviewScreen({
  groupedFiles,
  isDarkMode,
  onRescan,
  onToggleBucketCollapsed,
  onToggleFileSelected,
  selectedUris,
  collapsedBuckets,
}: ReviewScreenProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = isDarkMode ? darkStyles : lightStyles;
  const selectedForReview = useMemo(
    () =>
      groupedFiles.flatMap(group =>
        group.files.filter(file => selectedUris.has(file.uri)),
      ),
    [groupedFiles, selectedUris],
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contentContainer,
        palette.background,
        {paddingBottom: safeAreaInsets.bottom + 24, paddingTop: safeAreaInsets.top + 16},
      ]}>
      <Text style={[styles.title, palette.textPrimary]}>Scan results</Text>
      <Text style={[styles.subtitle, palette.textMuted]}>
        Select files to include in the upcoming move action.
      </Text>

      <View style={styles.scanButtonContainer}>
        <Button title="Scan another folder" onPress={onRescan} />
      </View>

      <Text style={[styles.sectionTitle, palette.textPrimary]}>Grouped by bucket</Text>

      {groupedFiles.length === 0 ? (
        <EmptyState
          isDarkMode={isDarkMode}
          message="No files were found in the selected folder."
          title="Nothing to review"
        />
      ) : (
        groupedFiles.map(group => {
          const bucketSize = sumBucketSize(group.files);
          const isCollapsed = collapsedBuckets.has(group.bucket);

          return (
            <View
              key={group.bucket}
              style={[styles.groupSection, palette.card]}>
              <Pressable
                testID={`bucket-toggle-${group.bucket}`}
                onPress={() => onToggleBucketCollapsed(group.bucket)}
                style={styles.groupHeader}>
                <Text style={[styles.groupTitle, palette.textPrimary]}>
                  {isCollapsed ? '▸' : '▾'} {group.bucket}
                </Text>
                <Text style={[styles.groupMeta, palette.textMuted]}>
                  {group.files.length} files · {formatSize(bucketSize)}
                </Text>
              </Pressable>
              {isCollapsed
                ? null
                : group.files.map(file => (
                    <Pressable
                      key={file.uri}
                      onPress={() => onToggleFileSelected(file.uri)}
                      style={styles.fileRow}
                      testID={`file-checkbox-${file.uri}`}>
                      <Text
                        style={[
                          styles.checkbox,
                          getCheckboxColorStyle(isDarkMode, selectedUris.has(file.uri)),
                        ]}>
                        {selectedUris.has(file.uri) ? '☑' : '☐'}
                      </Text>
                      <View style={styles.fileContent}>
                        <Text style={[styles.fileName, palette.textPrimary]}>{file.name}</Text>
                        <Text style={[styles.fileMeta, palette.fileMeta]}>
                          {formatSize(file.sizeBytes)}
                          {file.badges.length > 0 ? ` · ${file.badges.join(', ')}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
            </View>
          );
        })
      )}

      <Text style={[styles.sectionTitle, palette.textPrimary]}>
        Selected for review ({selectedForReview.length})
      </Text>
      {selectedForReview.length === 0 ? (
        <EmptyState
          isDarkMode={isDarkMode}
          message="Use the checkboxes above to choose files for the move list."
          title="No files selected"
        />
      ) : (
        selectedForReview.map(file => (
          <Text
            key={`review-${file.uri}`}
            style={[styles.reviewItem, palette.reviewItem]}>
            • {file.name}
            {file.badges.length > 0 ? ` (${file.badges.join(', ')})` : ''}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

function sumBucketSize(files: ScannedFileViewModel[]): number {
  return files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
}

function formatSize(sizeBytes: number | null): string {
  if (sizeBytes == null || sizeBytes <= 0) {
    return '0 B';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCheckboxColorStyle(isDarkMode: boolean, selected: boolean) {
  if (selected) {
    return isDarkMode ? darkStyles.checkboxSelected : lightStyles.checkboxSelected;
  }

  return isDarkMode ? darkStyles.checkboxUnselected : lightStyles.checkboxUnselected;
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  groupSection: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  groupHeader: {
    gap: 4,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupMeta: {
    fontSize: 13,
  },
  fileRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  checkbox: {
    fontSize: 18,
    marginTop: 2,
  },
  fileContent: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 14,
  },
  fileMeta: {
    fontSize: 12,
  },
  reviewItem: {
    fontSize: 14,
  },
  scanButtonContainer: {
    marginTop: 4,
  },
});

const lightStyles = StyleSheet.create({
  background: {
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  textPrimary: {
    color: '#111827',
  },
  textMuted: {
    color: '#4b5563',
  },
  fileMeta: {
    color: '#6b7280',
  },
  reviewItem: {
    color: '#111827',
  },
  checkboxSelected: {
    color: '#0284c7',
  },
  checkboxUnselected: {
    color: '#9ca3af',
  },
});

const darkStyles = StyleSheet.create({
  background: {
    backgroundColor: '#030712',
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  textPrimary: {
    color: '#f9fafb',
  },
  textMuted: {
    color: '#9ca3af',
  },
  fileMeta: {
    color: '#9ca3af',
  },
  reviewItem: {
    color: '#d1d5db',
  },
  checkboxSelected: {
    color: '#22d3ee',
  },
  checkboxUnselected: {
    color: '#6b7280',
  },
});
