import { I18nService } from './i18n.service';

// Mock localStorage and document for Node test environment
const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
  },
  writable: true
});
Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { lang: '', dir: '' } },
  writable: true
});

function makeService(): I18nService {
  localStorage.clear();
  return new I18nService();
}

describe('I18nService', () => {
  it('defaults to India / INR / ltr', () => {
    const svc = makeService();
    const pref = svc.preference();
    expect(pref.countryCode).toBe('IN');
    expect(pref.currencyCode).toBe('INR');
    expect(pref.direction).toBe('ltr');
  });

  it('setCountry switches locale to UAE and sets rtl direction', () => {
    const svc = makeService();
    const pref = svc.setCountry('AE');
    expect(pref.countryCode).toBe('AE');
    expect(pref.currencyCode).toBe('AED');
    expect(pref.direction).toBe('rtl');
  });

  it('setLanguage switches to Arabic and marks rtl', () => {
    const svc = makeService();
    const pref = svc.setLanguage('ar');
    expect(pref.languageCode).toBe('ar');
    expect(pref.direction).toBe('rtl');
  });

  it('setLanguage to English restores ltr', () => {
    const svc = makeService();
    svc.setLanguage('ar');
    const pref = svc.setLanguage('en');
    expect(pref.direction).toBe('ltr');
  });

  it('t() returns translation for known key', () => {
    const svc = makeService();
    const result = svc.t('shell.searchPlaceholder');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('t() returns fallback for unknown key', () => {
    const svc = makeService();
    expect(svc.t('nonexistent.key', 'my fallback')).toBe('my fallback');
  });

  it('formatMoney returns currency string', () => {
    const svc = makeService();
    const result = svc.formatMoney(1500);
    expect(result).toContain('1');
  });

  it('setCountry to Saudi Arabia uses SAR', () => {
    const svc = makeService();
    const pref = svc.setCountry('SA');
    expect(pref.currencyCode).toBe('SAR');
    expect(pref.direction).toBe('rtl');
  });

  it('preference persists to localStorage', () => {
    const svc = makeService();
    svc.setCountry('GB');
    const svc2 = new I18nService();
    expect(svc2.preference().countryCode).toBe('GB');
  });
});
