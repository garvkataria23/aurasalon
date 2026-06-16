import { Injectable, computed, signal } from '@angular/core';

export type TextDirection = 'ltr' | 'rtl';

export type LocalePreference = {
  countryCode: string;
  languageCode: string;
  direction: TextDirection;
  currencyCode: string;
  dateLocale: string;
  numberLocale: string;
};

type LocaleOption = { code: string; label: string; languageCode: string; currencyCode: string; dateLocale: string; numberLocale: string; direction?: TextDirection };
type Dictionary = Record<string, string>;

const STORAGE_KEY = 'aura.localizationPreference';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

const DEFAULT_PREFERENCE: LocalePreference = {
  countryCode: 'IN',
  languageCode: 'en',
  direction: 'ltr',
  currencyCode: 'INR',
  dateLocale: 'en-IN',
  numberLocale: 'en-IN'
};

const COUNTRY_OPTIONS: LocaleOption[] = [
  { code: 'IN', label: 'India', languageCode: 'en', currencyCode: 'INR', dateLocale: 'en-IN', numberLocale: 'en-IN' },
  { code: 'US', label: 'United States', languageCode: 'en', currencyCode: 'USD', dateLocale: 'en-US', numberLocale: 'en-US' },
  { code: 'GB', label: 'United Kingdom', languageCode: 'en', currencyCode: 'GBP', dateLocale: 'en-GB', numberLocale: 'en-GB' },
  { code: 'AE', label: 'United Arab Emirates', languageCode: 'ar', currencyCode: 'AED', dateLocale: 'ar-AE', numberLocale: 'ar-AE', direction: 'rtl' },
  { code: 'SA', label: 'Saudi Arabia', languageCode: 'ar', currencyCode: 'SAR', dateLocale: 'ar-SA', numberLocale: 'ar-SA', direction: 'rtl' },
  { code: 'SG', label: 'Singapore', languageCode: 'en', currencyCode: 'SGD', dateLocale: 'en-SG', numberLocale: 'en-SG' },
  { code: 'CA', label: 'Canada', languageCode: 'en', currencyCode: 'CAD', dateLocale: 'en-CA', numberLocale: 'en-CA' },
  { code: 'AU', label: 'Australia', languageCode: 'en', currencyCode: 'AUD', dateLocale: 'en-AU', numberLocale: 'en-AU' },
  { code: 'FR', label: 'France', languageCode: 'fr', currencyCode: 'EUR', dateLocale: 'fr-FR', numberLocale: 'fr-FR' },
  { code: 'DE', label: 'Germany', languageCode: 'de', currencyCode: 'EUR', dateLocale: 'de-DE', numberLocale: 'de-DE' },
  { code: 'ES', label: 'Spain', languageCode: 'es', currencyCode: 'EUR', dateLocale: 'es-ES', numberLocale: 'es-ES' },
  { code: 'IT', label: 'Italy', languageCode: 'it', currencyCode: 'EUR', dateLocale: 'it-IT', numberLocale: 'it-IT' },
  { code: 'NL', label: 'Netherlands', languageCode: 'nl', currencyCode: 'EUR', dateLocale: 'nl-NL', numberLocale: 'nl-NL' },
  { code: 'BR', label: 'Brazil', languageCode: 'pt', currencyCode: 'BRL', dateLocale: 'pt-BR', numberLocale: 'pt-BR' },
  { code: 'TR', label: 'Turkey', languageCode: 'tr', currencyCode: 'TRY', dateLocale: 'tr-TR', numberLocale: 'tr-TR' },
  { code: 'TH', label: 'Thailand', languageCode: 'th', currencyCode: 'THB', dateLocale: 'th-TH', numberLocale: 'th-TH' },
  { code: 'ID', label: 'Indonesia', languageCode: 'id', currencyCode: 'IDR', dateLocale: 'id-ID', numberLocale: 'id-ID' },
  { code: 'VN', label: 'Vietnam', languageCode: 'vi', currencyCode: 'VND', dateLocale: 'vi-VN', numberLocale: 'vi-VN' },
  { code: 'JP', label: 'Japan', languageCode: 'ja', currencyCode: 'JPY', dateLocale: 'ja-JP', numberLocale: 'ja-JP' },
  { code: 'KR', label: 'South Korea', languageCode: 'ko', currencyCode: 'KRW', dateLocale: 'ko-KR', numberLocale: 'ko-KR' },
  { code: 'ZA', label: 'South Africa', languageCode: 'en', currencyCode: 'ZAR', dateLocale: 'en-ZA', numberLocale: 'en-ZA' }
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'tr', label: 'Turkish' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' }
];

const DICTIONARIES: Record<string, Dictionary> = {
  en: {
    'shell.country': 'Country',
    'shell.language': 'Language',
    'shell.tenant': 'Tenant',
    'shell.branch': 'Branch',
    'shell.role': 'Role',
    'shell.logout': 'Logout',
    'shell.fastPos': 'Fast POS',
    'shell.workspace': 'Enterprise command workspace',
    'shell.modules': 'modules',
    'shell.findModule': 'Find module',
    'shell.searchPlaceholder': 'Search POS, staff, reports',
    'shell.resetSearch': 'Reset search',
    'shell.noModule': 'No module found',
    'shell.sidebarTenant': 'SaaS tenant',
    'shell.scopeCopy': 'Tenant, branch and role headers scope every API call.',
    'shell.dismiss': 'Dismiss'
  },
  hi: {
    'shell.country': 'देश',
    'shell.language': 'भाषा',
    'shell.tenant': 'टेनेंट',
    'shell.branch': 'ब्रांच',
    'shell.role': 'रोल',
    'shell.logout': 'लॉगआउट',
    'shell.fastPos': 'फास्ट POS',
    'shell.workspace': 'एंटरप्राइज कमांड वर्कस्पेस',
    'shell.modules': 'मॉड्यूल',
    'shell.findModule': 'मॉड्यूल खोजें',
    'shell.searchPlaceholder': 'POS, स्टाफ, रिपोर्ट खोजें',
    'shell.resetSearch': 'सर्च रीसेट',
    'shell.noModule': 'कोई मॉड्यूल नहीं मिला',
    'shell.sidebarTenant': 'SaaS टेनेंट',
    'shell.scopeCopy': 'हर API call tenant, branch और role headers से scope होती है।',
    'shell.dismiss': 'हटाएं'
  },
  ar: {
    'shell.country': 'الدولة',
    'shell.language': 'اللغة',
    'shell.tenant': 'المستأجر',
    'shell.branch': 'الفرع',
    'shell.role': 'الدور',
    'shell.logout': 'تسجيل الخروج',
    'shell.fastPos': 'نقطة بيع سريعة',
    'shell.workspace': 'مساحة أوامر المؤسسة',
    'shell.modules': 'وحدات',
    'shell.findModule': 'البحث عن وحدة',
    'shell.searchPlaceholder': 'ابحث عن POS أو الموظفين أو التقارير',
    'shell.resetSearch': 'إعادة البحث',
    'shell.noModule': 'لم يتم العثور على وحدة',
    'shell.sidebarTenant': 'مستأجر SaaS',
    'shell.scopeCopy': 'كل طلب API يتم تحديده حسب المستأجر والفرع والدور.',
    'shell.dismiss': 'إغلاق'
  }
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly countries = COUNTRY_OPTIONS;
  readonly languages = LANGUAGE_OPTIONS;
  readonly preference = signal<LocalePreference>(this.readPreference());
  readonly countryCode = computed(() => this.preference().countryCode);
  readonly languageCode = computed(() => this.preference().languageCode);
  readonly direction = computed(() => this.preference().direction);

  constructor() {
    this.applyDocumentLocale(this.preference());
  }

  t(key: string, fallback = key): string {
    const language = this.languageCode();
    return DICTIONARIES[language]?.[key] || DICTIONARIES.en[key] || fallback;
  }

  setCountry(countryCode: string): LocalePreference {
    const option = COUNTRY_OPTIONS.find((item) => item.code === countryCode) || COUNTRY_OPTIONS[0];
    return this.setPreference({
      countryCode: option.code,
      languageCode: option.languageCode,
      direction: option.direction || (RTL_LANGUAGES.has(option.languageCode) ? 'rtl' : 'ltr'),
      currencyCode: option.currencyCode,
      dateLocale: option.dateLocale,
      numberLocale: option.numberLocale
    });
  }

  setLanguage(languageCode: string): LocalePreference {
    const current = this.preference();
    return this.setPreference({
      ...current,
      languageCode,
      direction: RTL_LANGUAGES.has(languageCode) ? 'rtl' : 'ltr',
      dateLocale: this.localeFor(languageCode, current.countryCode),
      numberLocale: this.localeFor(languageCode, current.countryCode)
    });
  }

  setPreference(preference: Partial<LocalePreference>): LocalePreference {
    const next = this.normalize(preference);
    this.preference.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.applyDocumentLocale(next);
    return next;
  }

  formatMoney(amount: number): string {
    const pref = this.preference();
    return new Intl.NumberFormat(pref.numberLocale, { style: 'currency', currency: pref.currencyCode }).format(amount);
  }

  formatDate(value: string | number | Date): string {
    return new Intl.DateTimeFormat(this.preference().dateLocale).format(new Date(value));
  }

  private readPreference(): LocalePreference {
    try {
      return this.normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return DEFAULT_PREFERENCE;
    }
  }

  private normalize(preference: Partial<LocalePreference>): LocalePreference {
    const countryCode = String(preference.countryCode || DEFAULT_PREFERENCE.countryCode).toUpperCase();
    const country = COUNTRY_OPTIONS.find((item) => item.code === countryCode);
    const languageCode = String(preference.languageCode || country?.languageCode || DEFAULT_PREFERENCE.languageCode).toLowerCase();
    const direction = preference.direction || country?.direction || (RTL_LANGUAGES.has(languageCode) ? 'rtl' : 'ltr');
    return {
      countryCode,
      languageCode,
      direction,
      currencyCode: String(preference.currencyCode || country?.currencyCode || DEFAULT_PREFERENCE.currencyCode).toUpperCase(),
      dateLocale: String(preference.dateLocale || country?.dateLocale || this.localeFor(languageCode, countryCode)),
      numberLocale: String(preference.numberLocale || country?.numberLocale || this.localeFor(languageCode, countryCode))
    };
  }

  private localeFor(languageCode: string, countryCode: string): string {
    return `${languageCode}-${countryCode}`;
  }

  private applyDocumentLocale(preference: LocalePreference): void {
    document.documentElement.lang = preference.languageCode;
    document.documentElement.dir = preference.direction;
  }
}
