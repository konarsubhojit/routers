import {
  AppSettingsStore,
  createInMemoryStorage,
  DEFAULT_APP_SETTINGS,
} from '../../src/settings/appSettings';

describe('AppSettingsStore', () => {
  it('defaults cloud classification to OFF and crash reporting to ON', async () => {
    const store = new AppSettingsStore(createInMemoryStorage());

    const settings = await store.load();

    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(settings.cloudClassificationEnabled).toBe(false);
    expect(settings.crashReportingEnabled).toBe(true);
  });

  it('persists updates and returns them from subsequent loads', async () => {
    const storage = createInMemoryStorage();
    const store = new AppSettingsStore(storage);

    await store.update({cloudClassificationEnabled: true, cloudGranularity: 'filename+metadata'});

    const reloaded = new AppSettingsStore(storage);
    const settings = await reloaded.load();

    expect(settings.cloudClassificationEnabled).toBe(true);
    expect(settings.cloudGranularity).toBe('filename+metadata');
  });

  it('supports opting out of crash reporting', async () => {
    const store = new AppSettingsStore(createInMemoryStorage());

    const updated = await store.update({crashReportingEnabled: false});

    expect(updated.crashReportingEnabled).toBe(false);
  });

  it('falls back to defaults when stored JSON is corrupt', async () => {
    const storage = createInMemoryStorage();
    await storage.setItem('filesage.settings.v1', 'not-json');
    const store = new AppSettingsStore(storage);

    const settings = await store.load();

    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('ignores unknown/invalid granularity values from storage', async () => {
    const storage = createInMemoryStorage();
    await storage.setItem(
      'filesage.settings.v1',
      JSON.stringify({cloudGranularity: 'everything', cloudClassificationEnabled: true}),
    );
    const store = new AppSettingsStore(storage);

    const settings = await store.load();

    expect(settings.cloudGranularity).toBe(DEFAULT_APP_SETTINGS.cloudGranularity);
    expect(settings.cloudClassificationEnabled).toBe(true);
  });
});
