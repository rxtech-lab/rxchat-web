import { providerSupportsDocuments } from './models';
import type { ProviderType } from './models';

describe('providerSupportsDocuments', () => {
  test('should return true for openRouter provider', () => {
    expect(providerSupportsDocuments('openRouter')).toBe(true);
  });

  test('should return false for openAI provider', () => {
    expect(providerSupportsDocuments('openAI')).toBe(false);
  });

  test('should return false for anthropic provider', () => {
    expect(providerSupportsDocuments('anthropic')).toBe(false);
  });

  test('should return false for azure provider', () => {
    expect(providerSupportsDocuments('azure')).toBe(false);
  });

  test('should return false for google provider', () => {
    expect(providerSupportsDocuments('google')).toBe(false);
  });

  test('should return false for gemini provider', () => {
    expect(providerSupportsDocuments('gemini')).toBe(false);
  });

  test('should return false for test provider', () => {
    expect(providerSupportsDocuments('test')).toBe(false);
  });

  test('should return false for unknown provider', () => {
    expect(providerSupportsDocuments('unknown' as ProviderType)).toBe(false);
  });
});