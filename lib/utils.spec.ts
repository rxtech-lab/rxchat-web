import { getBrandName } from './utils';

describe('getBrandName', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return the environment variable value when NEXT_PUBLIC_BRAND_NAME is set', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = 'CustomBrand';
    expect(getBrandName()).toBe('CustomBrand');
  });

  it('should return "RxChat" as fallback when NEXT_PUBLIC_BRAND_NAME is not set', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = undefined;
    expect(getBrandName()).toBe('RxChat');
  });

  it('should return "RxChat" as fallback when NEXT_PUBLIC_BRAND_NAME is empty string', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = '';
    expect(getBrandName()).toBe('RxChat');
  });

  it('should handle different brand names correctly', () => {
    const testBrands = ['MyChat', 'SuperChat', 'AI Assistant', 'ChatBot Pro'];

    testBrands.forEach((brand) => {
      process.env.NEXT_PUBLIC_BRAND_NAME = brand;
      expect(getBrandName()).toBe(brand);
    });
  });
});
