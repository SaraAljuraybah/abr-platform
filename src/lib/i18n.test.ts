import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'abr.lang';

async function loadI18n() {
  vi.resetModules();
  return import('@/lib/i18n');
}

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to English, left-to-right', async () => {
    const { currentLanguage } = await loadI18n();
    expect(currentLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('switching to Arabic sets <html lang="ar" dir="rtl"> and persists the choice', async () => {
    const { changeLanguage, currentLanguage } = await loadI18n();
    await changeLanguage('ar');
    expect(currentLanguage()).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(KEY)).toBe('ar');
  });

  it('switching back to English restores left-to-right', async () => {
    const { changeLanguage } = await loadI18n();
    await changeLanguage('ar');
    await changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(window.localStorage.getItem(KEY)).toBe('en');
  });

  it('restores a persisted Arabic choice on load', async () => {
    window.localStorage.setItem(KEY, 'ar');
    const { currentLanguage } = await loadI18n();
    expect(currentLanguage()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ignores an unsupported persisted value', async () => {
    window.localStorage.setItem(KEY, 'fr');
    const { currentLanguage } = await loadI18n();
    expect(currentLanguage()).toBe('en');
  });

  it('still works when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { changeLanguage, currentLanguage } = await loadI18n();
    expect(currentLanguage()).toBe('en');
    await changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
