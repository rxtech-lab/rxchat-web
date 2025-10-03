import { locales, defaultLocale, localeNames } from './config';

describe('i18n configuration', () => {
  it('should have correct locales defined', () => {
    expect(locales).toEqual(['en', 'zh-CN', 'zh-TW']);
  });

  it('should have English as default locale', () => {
    expect(defaultLocale).toBe('en');
  });

  it('should have locale names for all locales', () => {
    expect(localeNames).toHaveProperty('en');
    expect(localeNames).toHaveProperty('zh-CN');
    expect(localeNames).toHaveProperty('zh-TW');
  });

  it('should have correct locale names', () => {
    expect(localeNames.en).toBe('English');
    expect(localeNames['zh-CN']).toBe('简体中文');
    expect(localeNames['zh-TW']).toBe('繁體中文');
  });

  it('should have locale names for all defined locales', () => {
    locales.forEach((locale) => {
      expect(localeNames).toHaveProperty(locale);
      expect(localeNames[locale]).toBeTruthy();
    });
  });
});
