import {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {aicoreClassifier} from './src/classify/aicoreClassifier';
import {cloudClassifier} from './src/classify/cloudClassifier';
import {mediapipeClassifier} from './src/classify/mediapipeClassifier';
import {createTieredClassifier} from './src/classify/tieredClassifier';
import {isOlderThanThreshold} from './src/preprocess/ageFilter';
import {ExtensionBucket, extensionToBucket} from './src/preprocess/extensionBuckets';
import {requestTreePermission, scanTree, sha256} from './src/native';
import {NativeScannedFileMetadata} from './src/native/types';

const BUCKET_ORDER: ExtensionBucket[] = [
  'Installers',
  'Archives',
  'Images',
  'Docs',
  'Audio',
  'Video',
  'Other',
];

type ReviewBadge = 'DUPLICATE' | 'OLD' | 'TEMPORARY';

interface ScannedFileViewModel {
  uri: string;
  name: string;
  bucket: ExtensionBucket;
  badges: ReviewBadge[];
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cloudTierEnabled, setCloudTierEnabled] = useState(false);
  const [classifierDiagnostic, setClassifierDiagnostic] = useState(
    'Classifier diagnostics unavailable until first scan.',
  );
  const [groupedFiles, setGroupedFiles] = useState<
    Array<{bucket: ExtensionBucket; files: ScannedFileViewModel[]}>
  >([]);
  const [selectedForReview, setSelectedForReview] = useState<ScannedFileViewModel[]>([]);

  const tieredClassifier = useMemo(
    () =>
      createTieredClassifier([
        aicoreClassifier,
        mediapipeClassifier,
        ...(cloudTierEnabled ? [cloudClassifier] : []),
      ]),
    [cloudTierEnabled],
  );

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      const [aicoreAvailable, mediaPipeAvailable] = await Promise.all([
        aicoreClassifier.isAvailable(),
        mediapipeClassifier.isAvailable(),
      ]);

      setClassifierDiagnostic(
        aicoreAvailable
          ? 'AICore: available'
          : mediaPipeAvailable
            ? 'MediaPipe: available'
            : 'No on-device classifier available',
      );

      const treeUri = await requestTreePermission();
      const scannedFiles = await scanTree(treeUri);
      const fileHashes = await hashFiles(scannedFiles);
      const duplicateUris = findDuplicateUris(fileHashes);

      const fileModels = await Promise.all(
        scannedFiles.map(async file => {
          const name = getDisplayName(file);
          const classification = await tieredClassifier.classify({path: name});
          const badges = buildBadges(file, duplicateUris, classification === 'TEMPORARY');

          return {
            uri: file.uri,
            name,
            bucket: extensionToBucket(name),
            badges,
          } satisfies ScannedFileViewModel;
        }),
      );

      setGroupedFiles(groupFilesByBucket(fileModels));
      setSelectedForReview(fileModels.filter(file => file.badges.length > 0));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Scan failed.';
      setScanError(message);
      setGroupedFiles([]);
      setSelectedForReview([]);
    } finally {
      setIsScanning(false);
    }
  }, [tieredClassifier]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: safeAreaInsets.top + 16,
          paddingBottom: safeAreaInsets.bottom + 24,
        },
      ]}>
      <Text style={styles.title}>FileSage DownloadSorter</Text>
      <Text style={styles.subtitle}>Read-only scan for any selected folder</Text>

      <View style={styles.settingsCard}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingTitle}>Tier 3: cloud classification</Text>
          <Switch
            testID="cloud-tier-toggle"
            value={cloudTierEnabled}
            onValueChange={setCloudTierEnabled}
          />
        </View>
        <Text style={styles.warningText}>
          Privacy warning: when enabled, file metadata or extracted text may be
          sent to cloud services for classification.
        </Text>
      </View>

      <View style={styles.scanButtonContainer}>
        <Button
          title={isScanning ? 'Scanning…' : 'Scan Folder'}
          onPress={handleScan}
          disabled={isScanning}
        />
      </View>

      {isScanning ? <ActivityIndicator style={styles.loading} /> : null}
      <Text testID="classifier-diagnostic" style={styles.diagnosticText}>
        {classifierDiagnostic}
      </Text>
      {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

      <Text style={styles.sectionTitle}>Grouped by bucket</Text>
      {groupedFiles.length === 0 ? (
        <Text style={styles.emptyText}>No scanned files yet.</Text>
      ) : (
        groupedFiles.map(group => (
          <View key={group.bucket} style={styles.groupSection}>
            <Text style={styles.groupTitle}>{group.bucket}</Text>
            {group.files.map(file => (
              <View key={file.uri} style={styles.fileRow}>
                <Text style={styles.fileName}>{file.name}</Text>
                <View style={styles.badgeRow}>
                  {file.badges.map(badge => (
                    <Text key={`${file.uri}-${badge}`} style={styles.badge}>
                      {badge}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Selected for review</Text>
      {selectedForReview.length === 0 ? (
        <Text style={styles.emptyText}>No files selected for review.</Text>
      ) : (
        selectedForReview.map(file => (
          <Text key={`review-${file.uri}`} style={styles.reviewItem}>
            • {file.name} ({file.badges.join(', ')})
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4b5563',
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    gap: 8,
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
    color: '#7f1d1d',
    fontSize: 12,
  },
  scanButtonContainer: {
    marginTop: 4,
  },
  loading: {
    marginVertical: 8,
  },
  diagnosticText: {
    color: '#111827',
    fontWeight: '600',
  },
  errorText: {
    color: '#b91c1c',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    color: '#6b7280',
  },
  groupSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fileRow: {
    gap: 4,
  },
  fileName: {
    color: '#111827',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    color: '#1f2937',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewItem: {
    color: '#111827',
  },
});

function getDisplayName(file: NativeScannedFileMetadata): string {
  const trimmedName = file.name?.trim();
  return trimmedName && trimmedName.length > 0 ? trimmedName : file.uri;
}

async function hashFiles(
  files: NativeScannedFileMetadata[],
): Promise<Map<string, string>> {
  const uriToHashEntries = await Promise.all(
    files.map(async file => {
      try {
        return [file.uri, await sha256(file.uri)] as const;
      } catch {
        return [file.uri, ''] as const;
      }
    }),
  );

  return new Map(uriToHashEntries);
}

function findDuplicateUris(uriToHash: Map<string, string>): Set<string> {
  const hashToUris = new Map<string, string[]>();

  for (const [uri, hash] of uriToHash.entries()) {
    if (hash.length === 0) {
      continue;
    }

    const uris = hashToUris.get(hash);
    if (uris != null) {
      uris.push(uri);
    } else {
      hashToUris.set(hash, [uri]);
    }
  }

  const duplicates = new Set<string>();
  for (const uris of hashToUris.values()) {
    if (uris.length > 1) {
      for (const uri of uris) {
        duplicates.add(uri);
      }
    }
  }

  return duplicates;
}

function buildBadges(
  file: NativeScannedFileMetadata,
  duplicateUris: Set<string>,
  isTemporary: boolean,
): ReviewBadge[] {
  const badges: ReviewBadge[] = [];

  if (duplicateUris.has(file.uri)) {
    badges.push('DUPLICATE');
  }

  if (file.mtime != null && isOlderThanThreshold(file.mtime)) {
    badges.push('OLD');
  }

  if (isTemporary) {
    badges.push('TEMPORARY');
  }

  return badges;
}

function groupFilesByBucket(
  files: ScannedFileViewModel[],
): Array<{bucket: ExtensionBucket; files: ScannedFileViewModel[]}> {
  const grouped = new Map<ExtensionBucket, ScannedFileViewModel[]>();
  for (const file of files) {
    const current = grouped.get(file.bucket);
    if (current == null) {
      grouped.set(file.bucket, [file]);
    } else {
      current.push(file);
    }
  }

  return BUCKET_ORDER
    .map(bucket => ({bucket, files: grouped.get(bucket) ?? []}))
    .filter(group => group.files.length > 0);
}

export default App;
