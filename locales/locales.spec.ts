import enCommon from './en/common.json';
import zhCNCommon from './zh-CN/common.json';
import zhTWCommon from './zh-TW/common.json';

describe('Translation files', () => {
  describe('English translations', () => {
    it('should have greeting translations', () => {
      expect(enCommon.greeting).toBeDefined();
      expect(enCommon.greeting.hello).toBe('Hello there!');
      expect(enCommon.greeting.help).toBe('How can I help you today?');
    });

    it('should have auth translations', () => {
      expect(enCommon.auth).toBeDefined();
      expect(enCommon.auth.signIn).toBe('Sign In');
      expect(enCommon.auth.signUp).toBe('Sign up');
    });

    it('should have language selector translations', () => {
      expect(enCommon.language).toBeDefined();
      expect(enCommon.language.select).toBe('Select Language');
    });
  });

  describe('Chinese Simplified translations', () => {
    it('should have greeting translations', () => {
      expect(zhCNCommon.greeting).toBeDefined();
      expect(zhCNCommon.greeting.hello).toBe('您好！');
      expect(zhCNCommon.greeting.help).toBe('我今天能帮您什么忙？');
    });

    it('should have auth translations', () => {
      expect(zhCNCommon.auth).toBeDefined();
      expect(zhCNCommon.auth.signIn).toBe('登录');
      expect(zhCNCommon.auth.signUp).toBe('注册');
    });

    it('should have same structure as English', () => {
      expect(Object.keys(zhCNCommon)).toEqual(Object.keys(enCommon));
    });
  });

  describe('Chinese Traditional translations', () => {
    it('should have greeting translations', () => {
      expect(zhTWCommon.greeting).toBeDefined();
      expect(zhTWCommon.greeting.hello).toBe('您好！');
      expect(zhTWCommon.greeting.help).toBe('我今天能幫您什麼忙？');
    });

    it('should have auth translations', () => {
      expect(zhTWCommon.auth).toBeDefined();
      expect(zhTWCommon.auth.signIn).toBe('登入');
      expect(zhTWCommon.auth.signUp).toBe('註冊');
    });

    it('should have same structure as English', () => {
      expect(Object.keys(zhTWCommon)).toEqual(Object.keys(enCommon));
    });
  });

  describe('Translation consistency', () => {
    it('should have same keys across all locales', () => {
      const enKeys = Object.keys(enCommon);
      const zhCNKeys = Object.keys(zhCNCommon);
      const zhTWKeys = Object.keys(zhTWCommon);

      expect(zhCNKeys).toEqual(enKeys);
      expect(zhTWKeys).toEqual(enKeys);
    });

    it('should have same nested structure for greeting', () => {
      const enGreetingKeys = Object.keys(enCommon.greeting);
      const zhCNGreetingKeys = Object.keys(zhCNCommon.greeting);
      const zhTWGreetingKeys = Object.keys(zhTWCommon.greeting);

      expect(zhCNGreetingKeys).toEqual(enGreetingKeys);
      expect(zhTWGreetingKeys).toEqual(enGreetingKeys);
    });

    it('should have same nested structure for auth', () => {
      const enAuthKeys = Object.keys(enCommon.auth);
      const zhCNAuthKeys = Object.keys(zhCNCommon.auth);
      const zhTWAuthKeys = Object.keys(zhTWCommon.auth);

      expect(zhCNAuthKeys).toEqual(enAuthKeys);
      expect(zhTWAuthKeys).toEqual(enAuthKeys);
    });
  });
});
