/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/classify/aicoreClassifier', () => ({
  aicoreClassifier: {
    isAvailable: jest.fn().mockResolvedValue(true),
    classify: jest.fn().mockResolvedValue('UNKNOWN'),
  },
}));

jest.mock('../src/classify/mediapipeClassifier', () => ({
  mediapipeClassifier: {
    isAvailable: jest.fn().mockResolvedValue(false),
    classify: jest.fn().mockResolvedValue('UNKNOWN'),
  },
}));

jest.mock('../src/classify/cloudClassifier', () => ({
  cloudClassifier: {
    isAvailable: jest.fn().mockResolvedValue(false),
    classify: jest.fn().mockResolvedValue('UNKNOWN'),
  },
}));

jest.mock('../src/classify/tieredClassifier', () => ({
  createTieredClassifier: jest.fn(() => ({
    classify: jest.fn(async ({path}: {path: string}) =>
      path.includes('tmp') ? 'TEMPORARY' : 'PERMANENT',
    ),
  })),
}));

jest.mock('../src/native', () => ({
  requestTreePermission: jest.fn().mockResolvedValue('content://tree/downloads'),
  scanTree: jest.fn().mockResolvedValue([
    {
      uri: 'content://files/1',
      name: 'invoice.pdf',
      sizeBytes: 1024,
      mtime: 1715000000000,
      mimeType: 'application/pdf',
    },
    {
      uri: 'content://files/2',
      name: 'tmp-note.txt',
      sizeBytes: 2048,
      mtime: 1715000000000,
      mimeType: 'text/plain',
    },
  ]),
  sha256: jest.fn().mockResolvedValue('same-hash'),
}));

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  };
});

test('renders pick folder screen', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<App />);
  });

  expect(root!).toBeDefined();
  const content = JSON.stringify(root!.toJSON());
  expect(content).toContain('Scan Folder');
  expect(content).toContain('Tier 3: cloud classification');
  expect(content).toContain('Privacy warning');
  expect(content).toMatchSnapshot();
});

test('renders review screen with collapsible buckets and checkboxes', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<App />);
  });

  const scanButton = root!.root.findByProps({title: 'Scan Folder'});
  await ReactTestRenderer.act(async () => {
    scanButton.props.onPress();
  });

  let content = JSON.stringify(root!.toJSON());
  expect(content).toContain('Scan results');
  expect(content).toContain('Grouped by bucket');
  expect(content).toContain('Selected for review (');
  expect(content).toContain('Docs');

  const firstFileCheckbox = root!.root.findByProps({
    testID: 'file-checkbox-content://files/1',
  });
  await ReactTestRenderer.act(() => {
    firstFileCheckbox.props.onPress();
  });
  content = JSON.stringify(root!.toJSON());
  expect(content).not.toContain('• ","invoice.pdf"," (DUPLICATE, OLD)');

  const docsToggle = root!.root.findByProps({testID: 'bucket-toggle-Docs'});
  await ReactTestRenderer.act(() => {
    docsToggle.props.onPress();
  });
  content = JSON.stringify(root!.toJSON());
  expect(content).toContain('▸');
  expect(content).toMatchSnapshot();
});
