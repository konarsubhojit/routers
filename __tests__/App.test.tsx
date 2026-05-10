/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  };
});

test('renders correctly', async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<App />);
  });

  expect(root!).toBeDefined();
  const content = JSON.stringify(root!.toJSON());
  expect(content).toContain('Scan Folder');
  expect(content).toContain('Grouped by bucket');
  expect(content).toContain('Selected for review');
  expect(content).toContain('Tier 3: cloud classification');
  expect(content).toContain('Privacy warning');
});
