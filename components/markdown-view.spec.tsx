/**
 * @jest-environment jsdom
 */

import React from 'react';

// Simple integration test to verify the component can be imported and used
describe('MarkdownView', () => {
  // Mock all lexical dependencies at module level
  beforeEach(() => {
    jest.doMock('@lexical/react/LexicalComposer');
    jest.doMock('@lexical/react/LexicalRichTextPlugin');
    jest.doMock('@lexical/react/LexicalContentEditable');
    jest.doMock('@lexical/react/LexicalHistoryPlugin');
    jest.doMock('@lexical/react/LexicalOnChangePlugin');
    jest.doMock('@lexical/react/LexicalComposerContext');
    jest.doMock('@lexical/react/LexicalErrorBoundary');
    jest.doMock('@lexical/react/LexicalListPlugin');
    jest.doMock('@lexical/markdown');
    jest.doMock('@lexical/list');
    jest.doMock('@lexical/rich-text');
    jest.doMock('@lexical/code');
    jest.doMock('@lexical/link');
    jest.doMock('lexical');
  });

  it('should be importable', () => {
    // This test just verifies the module can be imported
    expect(() => {
      require('./markdown-view');
    }).not.toThrow();
  });

  // Basic test that the component exports what we expect
  it('should export MarkdownView component', () => {
    const { MarkdownView } = require('./markdown-view');
    expect(typeof MarkdownView).toBe('function');
  });
});