import {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Button,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
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
import {batchMove, BatchMoveProgressEvent} from './src/move/batchMove';
import {isOlderThanThreshold} from './src/preprocess/ageFilter';
import {
  EXTENSION_BUCKETS,
  ExtensionBucket,
  extensionToBucket,
} from './src/preprocess/extensionBuckets';
import {
  checkManageExternalStorageGranted,
  isFileScannerError,
  requestManageExternalStorage,
  requestTreePermission,
  scanTree,
  sha256,
} from './src/native';
import {NativeScannedFileMetadata} from './src/native/types';

const BUCKET_ORDER: ExtensionBucket[] = [...EXTENSION_BUCKETS];

type ReviewBadge = 'DUPLICATE' | 'OLD' | 'TEMPORARY';

/** Drives the "Permission needed" screen. */
type PermissionStatus = 'none' | 'saf_denied' | 'manage_storage_needed';

interface ScannedFileViewModel {
  uri: string;
  name: string;
  bucket: ExtensionBucket;
  badges: ReviewBadge[];
}

interface BucketGroupViewModel {
  bucket: ExtensionBucket;
  files: ScannedFileViewModel[];
}

interface MoveProgressState {
  total: number;
  processed: number;
  moved: number;
  currentFileName: string | null;
}

interface MoveReportState {
  total: number;
  moved: number;
  errors: Array<{uri: string; name: string; message: string}>;
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
  const [manageStorageEnabled, setManageStorageEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('none');
  const [lastTreeUri, setLastTreeUri] = useState<string | null>(null);
  const [classifierDiagnostic, setClassifierDiagnostic] = useState(
    'Classifier diagnostics unavailable until first scan.',
  );
  const [groupedFiles, setGroupedFiles] = useState<BucketGroupViewModel[]>([]);
  const [selectedForReview, setSelectedForReview] = useState<ScannedFileViewModel[]>([]);
  const [isMoveConfirmationVisible, setIsMoveConfirmationVisible] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState<MoveProgressState | null>(null);
  const [moveReport, setMoveReport] = useState<MoveReportState | null>(null);

  const tieredClassifier = useMemo(
    () =>
      createTieredClassifier([
        aicoreClassifier,
        mediapipeClassifier,
        ...(cloudTierEnabled ? [cloudClassifier] : []),
      ]),
    [cloudTierEnabled],
  );

  const handleManageStorageToggle = useCallback(
    async (value: boolean) => {
      setManageStorageEnabled(value);
      if (value) {
        const granted = await checkManageExternalStorageGranted().catch(() => false);
        if (!granted) {
          setPermissionStatus('manage_storage_needed');
        }
      }
    },
    [],
  );

  const handleOpenSettings = useCallback(async () => {
    if (permissionStatus === 'manage_storage_needed') {
      await requestManageExternalStorage().catch(() => {});
    } else {
      await Linking.openSettings();
    }
    setPermissionStatus('none');
  }, [permissionStatus]);

  const runScan = useCallback(
    async (treeUri: string) => {
      setIsScanning(true);
      setScanError(null);
      setPermissionStatus('none');
      setIsMoveConfirmationVisible(false);
      setMoveProgress(null);
      setMoveReport(null);

      try {
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
        if (
          isFileScannerError(error, 'E_PERMISSION_DENIED') ||
          isFileScannerError(error, 'E_PERMISSION_CANCELLED')
        ) {
          setPermissionStatus('saf_denied');
          setGroupedFiles([]);
          setSelectedForReview([]);
        } else {
          const message = error instanceof Error ? error.message : 'Scan failed.';
          setScanError(message);
          setGroupedFiles([]);
          setSelectedForReview([]);
        }
      } finally {
        setIsScanning(false);
      }
    },
    [tieredClassifier],
  );

  const bucketCounts = useMemo(
    () =>
      groupedFiles.map(group => ({
        bucket: group.bucket,
        count: group.files.length,
      })),
    [groupedFiles],
  );
  const totalFilesToMove = useMemo(
    () => bucketCounts.reduce((sum, group) => sum + group.count, 0),
    [bucketCounts],
  );

  const handleMoveProgress = useCallback((event: BatchMoveProgressEvent) => {
    setMoveProgress({
      total: event.total,
      processed: event.processed,
      moved: event.moved,
      currentFileName: event.file.name,
    });
  }, []);

  const handleConfirmMove = useCallback(async () => {
    if (lastTreeUri == null || totalFilesToMove === 0) {
      return;
    }

    setIsMoveConfirmationVisible(false);
    setIsMoving(true);
    setMoveReport(null);
    setMoveProgress({
      total: totalFilesToMove,
      processed: 0,
      moved: 0,
      currentFileName: null,
    });

    try {
      const result = await batchMove(groupedFiles, lastTreeUri, {
        onProgress: handleMoveProgress,
      });
      const movedUris = new Set(result.moved.map(item => item.file.uri));

      setGroupedFiles(currentGroups => removeMovedFilesFromGroups(currentGroups, movedUris));
      setSelectedForReview(currentFiles =>
        currentFiles.filter(file => !movedUris.has(file.uri)),
      );
      setMoveReport({
        total: result.total,
        moved: result.moved.length,
        errors: result.errors.map(({file, error}) => ({
          uri: file.uri,
          name: file.name,
          message: error.message,
        })),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Batch move failed.';
      setMoveReport({
        total: totalFilesToMove,
        moved: 0,
        errors: [{uri: 'batch', name: 'Batch move', message}],
      });
    } finally {
      setIsMoving(false);
      setMoveProgress(null);
    }
  }, [groupedFiles, handleMoveProgress, lastTreeUri, totalFilesToMove]);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    setPermissionStatus('none');

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

      if (manageStorageEnabled) {
        const granted = await checkManageExternalStorageGranted().catch(() => false);
        if (!granted) {
          setPermissionStatus('manage_storage_needed');
          setIsScanning(false);
          return;
        }
      }

      const treeUri = await requestTreePermission();
      setLastTreeUri(treeUri);
      await runScan(treeUri);
    } catch (error: unknown) {
      if (
        isFileScannerError(error, 'E_PERMISSION_DENIED') ||
        isFileScannerError(error, 'E_PERMISSION_CANCELLED')
      ) {
        setPermissionStatus('saf_denied');
        setGroupedFiles([]);
        setSelectedForReview([]);
      } else {
        const message = error instanceof Error ? error.message : 'Scan failed.';
        setScanError(message);
        setGroupedFiles([]);
        setSelectedForReview([]);
      }
      setIsScanning(false);
    }
  }, [manageStorageEnabled, runScan]);

  const handleRescan = useCallback(async () => {
    if (lastTreeUri != null) {
      await runScan(lastTreeUri);
    }
  }, [lastTreeUri, runScan]);

  if (permissionStatus !== 'none') {
    return (
      <PermissionNeededScreen
        permissionStatus={permissionStatus}
        safeAreaInsets={safeAreaInsets}
        onOpenSettings={handleOpenSettings}
        onDismiss={() => setPermissionStatus('none')}
      />
    );
  }

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
      <Text style={styles.subtitle}>
        Scan a folder, then move classified files into bucket folders.
      </Text>

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

      <View style={styles.settingsCard}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingTitle}>Full storage access</Text>
          <Switch
            testID="manage-storage-toggle"
            value={manageStorageEnabled}
            onValueChange={handleManageStorageToggle}
          />
        </View>
        <Text style={styles.warningText}>
          Play Store policy: MANAGE_EXTERNAL_STORAGE is a restricted permission
          intended for file-manager apps. Enable only if you need to traverse
          Android/data or Android/obb directories. The app will redirect you to
          system settings to grant this permission.
        </Text>
      </View>

      <View style={styles.scanButtonContainer}>
        <Button
          title={isScanning ? 'Scanning…' : 'Choose Folder & Scan'}
          onPress={handleScan}
          disabled={isScanning || isMoving}
        />
      </View>

      {lastTreeUri != null && !isScanning ? (
        <TouchableOpacity
          testID="rescan-button"
          style={styles.rescanButton}
          disabled={isMoving}
          onPress={handleRescan}>
          <Text style={styles.rescanText}>
            ↩ Re-scan last folder
          </Text>
        </TouchableOpacity>
      ) : null}

      {isScanning ? <ActivityIndicator style={styles.loading} /> : null}
      <Text testID="classifier-diagnostic" style={styles.diagnosticText}>
        {classifierDiagnostic}
      </Text>
      {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

      {totalFilesToMove > 0 || moveProgress != null || moveReport != null ? (
        <View style={styles.moveCard}>
          {totalFilesToMove > 0 ? (
            <Button
              title={`Move ${totalFilesToMove} files`}
              onPress={() => setIsMoveConfirmationVisible(true)}
              disabled={isMoving || isScanning}
            />
          ) : null}

          {isMoveConfirmationVisible ? (
            <View testID="move-confirmation-sheet" style={styles.confirmationSheet}>
              <Text style={styles.confirmationTitle}>Move {totalFilesToMove} files?</Text>
              <Text style={styles.confirmationSubtitle}>
                FileSage will create bucket folders if needed, then move each classified
                file into its bucket.
              </Text>
              {bucketCounts.map(group => (
                <Text key={`confirm-${group.bucket}`} style={styles.confirmationItem}>
                  • {group.bucket}: {group.count}
                </Text>
              ))}
              <View style={styles.confirmationActions}>
                <Button
                  title="Cancel"
                  onPress={() => setIsMoveConfirmationVisible(false)}
                />
                <Button title="Move now" onPress={handleConfirmMove} />
              </View>
            </View>
          ) : null}

          {isMoving && moveProgress != null ? (
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>
                {moveProgress.moved}/{moveProgress.total} files moved
              </Text>
              <Text style={styles.progressText}>
                Processed {moveProgress.processed} of {moveProgress.total}
              </Text>
              {moveProgress.currentFileName != null ? (
                <Text style={styles.progressText}>
                  Working on: {moveProgress.currentFileName}
                </Text>
              ) : null}
            </View>
          ) : null}

          {moveReport != null ? (
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>Move report</Text>
              <Text style={styles.reportSummary}>
                {moveReport.moved}/{moveReport.total} files moved
              </Text>
              {moveReport.errors.length === 0 ? (
                <Text style={styles.reportSuccess}>All selected files were moved.</Text>
              ) : (
                moveReport.errors.map(error => (
                  <Text key={`move-error-${error.uri}`} style={styles.reportError}>
                    • {error.name}: {error.message}
                  </Text>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}

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

interface PermissionNeededScreenProps {
  permissionStatus: PermissionStatus;
  safeAreaInsets: {top: number; bottom: number};
  onOpenSettings: () => void;
  onDismiss: () => void;
}

function PermissionNeededScreen({
  permissionStatus,
  safeAreaInsets,
  onOpenSettings,
  onDismiss,
}: PermissionNeededScreenProps) {
  const isSafDenied = permissionStatus === 'saf_denied';
  const title = isSafDenied ? 'Folder access needed' : 'Full storage access needed';
  const description = isSafDenied
    ? 'FileSage needs permission to read the selected folder. Please grant folder access when prompted, or open system settings to adjust app permissions.'
    : 'MANAGE_EXTERNAL_STORAGE is required to scan restricted directories (Android/data, Android/obb). Tap "Open Settings" to grant this permission.';

  return (
    <View
      testID="permission-screen"
      style={[
        styles.permissionScreen,
        {
          paddingTop: safeAreaInsets.top + 24,
          paddingBottom: safeAreaInsets.bottom + 24,
        },
      ]}>
      <Text style={styles.permissionTitle}>{title}</Text>
      <Text style={styles.permissionDescription}>{description}</Text>
      <View style={styles.permissionActions}>
        <Button title="Open Settings" onPress={onOpenSettings} />
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  moveCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  confirmationSheet: {
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    padding: 12,
    gap: 8,
  },
  confirmationTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  confirmationSubtitle: {
    color: '#4b5563',
    lineHeight: 20,
  },
  confirmationItem: {
    color: '#111827',
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressCard: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    padding: 12,
    gap: 4,
  },
  progressTitle: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '700',
  },
  progressText: {
    color: '#1f2937',
  },
  reportCard: {
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    padding: 12,
    gap: 6,
  },
  reportTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  reportSummary: {
    color: '#111827',
    fontWeight: '600',
  },
  reportSuccess: {
    color: '#166534',
  },
  reportError: {
    color: '#b91c1c',
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
  rescanButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  rescanText: {
    color: '#2563eb',
    fontSize: 14,
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
  permissionScreen: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  permissionDescription: {
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 22,
  },
  permissionActions: {
    gap: 12,
    marginTop: 8,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    color: '#6b7280',
    fontSize: 14,
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
): BucketGroupViewModel[] {
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

function removeMovedFilesFromGroups(
  groups: BucketGroupViewModel[],
  movedUris: Set<string>,
): BucketGroupViewModel[] {
  return groups
    .map(group => ({
      bucket: group.bucket,
      files: group.files.filter(file => !movedUris.has(file.uri)),
    }))
    .filter(group => group.files.length > 0);
}

export default App;
