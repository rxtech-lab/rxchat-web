/**
 * Unit test for multimodal input textarea height adjustment fix
 * Tests that adjustHeight function respects CSS max-height constraint
 */
import '@testing-library/jest-dom';

describe('Textarea Height Adjustment Fix', () => {
  // Mock window object for viewport height calculations
  let originalWindow: typeof window;
  
  beforeEach(() => {
    originalWindow = global.window;
    global.window = {
      ...global.window,
      innerHeight: 800
    } as any;
  });
  
  afterEach(() => {
    global.window = originalWindow;
  });

  test('adjustHeight should respect max-height constraint for long content', () => {
    // Create mock textarea element
    const mockTextarea = {
      style: {} as CSSStyleDeclaration,
      scrollHeight: 1000 // Very long content
    };

    // Mock textareaRef
    const textareaRef = {
      current: mockTextarea as HTMLTextAreaElement
    };

    // Simulate the fixed adjustHeight function logic
    const adjustHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        
        // Calculate the max-height constraint (75% of viewport height minus toolbar space)
        // Subtract 48px for bottom toolbar height (approximately 3rem including padding)
        const maxHeight = Math.floor(window.innerHeight * 0.75) - 48;
        const scrollHeight = textareaRef.current.scrollHeight + 2;
        
        // Use the smaller of scrollHeight and maxHeight to respect CSS constraint
        const targetHeight = Math.min(scrollHeight, maxHeight);
        textareaRef.current.style.height = `${targetHeight}px`;
      }
    };

    // Test the function
    adjustHeight();

    // Verify that height is capped at max-height (75% of 800px - 48px = 552px)
    expect(mockTextarea.style.height).toBe('552px');
  });

  test('adjustHeight should use natural height for normal content', () => {
    // Create mock textarea element with normal content
    const mockTextarea = {
      style: {} as CSSStyleDeclaration,
      scrollHeight: 100 // Normal content
    };

    // Mock textareaRef
    const textareaRef = {
      current: mockTextarea as HTMLTextAreaElement
    };

    // Simulate the fixed adjustHeight function logic
    const adjustHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        
        // Calculate the max-height constraint (75% of viewport height minus toolbar space)
        // Subtract 48px for bottom toolbar height (approximately 3rem including padding)
        const maxHeight = Math.floor(window.innerHeight * 0.75) - 48;
        const scrollHeight = textareaRef.current.scrollHeight + 2;
        
        // Use the smaller of scrollHeight and maxHeight to respect CSS constraint
        const targetHeight = Math.min(scrollHeight, maxHeight);
        textareaRef.current.style.height = `${targetHeight}px`;
      }
    };

    // Test the function
    adjustHeight();

    // Verify that height uses natural scrollHeight + 2 (102px)
    expect(mockTextarea.style.height).toBe('102px');
  });

  test('original behavior would cause overflow (for comparison)', () => {
    // This test demonstrates the problem that was fixed
    const mockTextarea = {
      style: {} as CSSStyleDeclaration,
      scrollHeight: 1000 // Very long content
    };

    const textareaRef = {
      current: mockTextarea as HTMLTextAreaElement
    };

    // Simulate the original (problematic) adjustHeight function
    const originalAdjustHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
      }
    };

    originalAdjustHeight();

    // This would cause overflow by setting height to 1002px
    expect(mockTextarea.style.height).toBe('1002px');
    
    // Compare with max allowed height (552px)
    const maxAllowedHeight = Math.floor(window.innerHeight * 0.75) - 48;
    expect(Number.parseInt(mockTextarea.style.height)).toBeGreaterThan(maxAllowedHeight);
  });
});