import {
  WorkflowEngineError,
  WorkflowInputOutputMismatchError,
  WorkflowToolMissingError,
  WorkflowReferenceError,
} from '@/lib/workflow/errors';
import { UserContextSchema } from '@/lib/types';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * Test suite for workflow error classes
 * Covers all custom error types used in the workflow engine
 */
describe('Workflow Errors', () => {
  describe('WorkflowEngineError', () => {
    /**
     * Test the base WorkflowEngineError class constructor and inheritance
     */
    it('should create a WorkflowEngineError with correct properties', () => {
      const message = 'Test error message';
      const error = new WorkflowEngineError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkflowEngineError);
      expect(error.message).toBe(message);
      expect(error.name).toBe('WorkflowEngineError');
    });

    /**
     * Test prototype chain is correctly set
     */
    it('should have correct prototype chain', () => {
      const error = new WorkflowEngineError('test');
      expect(Object.getPrototypeOf(error)).toBe(WorkflowEngineError.prototype);
    });

    /**
     * Test error can be caught and identified
     */
    it('should be catchable and identifiable', () => {
      const throwError = () => {
        throw new WorkflowEngineError('test error');
      };

      expect(() => throwError()).toThrow(WorkflowEngineError);
      expect(() => throwError()).toThrow('test error');
    });
  });

  describe('WorkflowInputOutputMismatchError', () => {
    const testErrors = ['Input field missing', 'Output schema invalid'];
    const testSuggestions = ['Add required field', 'Update schema definition'];

    /**
     * Test WorkflowInputOutputMismatchError constructor and properties
     */
    it('should create error with correct properties', () => {
      const error = new WorkflowInputOutputMismatchError(
        testErrors,
        testSuggestions,
      );

      expect(error).toBeInstanceOf(WorkflowEngineError);
      expect(error).toBeInstanceOf(WorkflowInputOutputMismatchError);
      expect(error.name).toBe('WorkflowInputOutputMismatchError');
      expect(error.errors).toEqual(testErrors);
      expect(error.suggestions).toEqual(testSuggestions);
    });

    /**
     * Test error message formatting
     */
    it('should format message correctly', () => {
      const error = new WorkflowInputOutputMismatchError(
        testErrors,
        testSuggestions,
      );
      const expectedMessage = `Input and output mismatch: ${testErrors.join(', ')}. Suggestions: ${testSuggestions.join(', ')}`;

      expect(error.message).toBe(expectedMessage);
    });

    /**
     * Test with empty arrays
     */
    it('should handle empty arrays', () => {
      const error = new WorkflowInputOutputMismatchError([], []);

      expect(error.errors).toEqual([]);
      expect(error.suggestions).toEqual([]);
      expect(error.message).toBe('Input and output mismatch: . Suggestions: ');
    });

    /**
     * Test with single error and suggestion
     */
    it('should handle single error and suggestion', () => {
      const singleError = ['Single error'];
      const singleSuggestion = ['Single suggestion'];
      const error = new WorkflowInputOutputMismatchError(
        singleError,
        singleSuggestion,
      );

      expect(error.message).toBe(
        'Input and output mismatch: Single error. Suggestions: Single suggestion',
      );
    });

    /**
     * Test prototype chain
     */
    it('should have correct prototype chain', () => {
      const error = new WorkflowInputOutputMismatchError(
        testErrors,
        testSuggestions,
      );
      expect(Object.getPrototypeOf(error)).toBe(
        WorkflowInputOutputMismatchError.prototype,
      );
    });
  });

  describe('WorkflowToolMissingError', () => {
    const testMissingTools = ['binance', 'telegram-bot', 'weather-api'];

    /**
     * Test WorkflowToolMissingError constructor and properties
     */
    it('should create error with correct properties', () => {
      const error = new WorkflowToolMissingError(testMissingTools);

      expect(error).toBeInstanceOf(WorkflowEngineError);
      expect(error).toBeInstanceOf(WorkflowToolMissingError);
      expect(error.name).toBe('WorkflowToolMissingError');
      expect(error.getMissingTools()).toEqual(testMissingTools);
    });

    /**
     * Test error message formatting
     */
    it('should format message correctly', () => {
      const error = new WorkflowToolMissingError(testMissingTools);
      const expectedMessage = `Tools missing: ${testMissingTools.join(', ')}. Please check if the tools are available in the MCP Router.`;

      expect(error.message).toBe(expectedMessage);
    });

    /**
     * Test getMissingTools method
     */
    it('should return missing tools via getter method', () => {
      const error = new WorkflowToolMissingError(testMissingTools);

      expect(error.getMissingTools()).toEqual(testMissingTools);
      expect(error.getMissingTools()).toBe(error.getMissingTools()); // Should return the same reference consistently
    });

    /**
     * Test with empty array
     */
    it('should handle empty missing tools array', () => {
      const error = new WorkflowToolMissingError([]);

      expect(error.getMissingTools()).toEqual([]);
      expect(error.message).toBe(
        'Tools missing: . Please check if the tools are available in the MCP Router.',
      );
    });

    /**
     * Test with single missing tool
     */
    it('should handle single missing tool', () => {
      const singleTool = ['single-tool'];
      const error = new WorkflowToolMissingError(singleTool);

      expect(error.message).toBe(
        'Tools missing: single-tool. Please check if the tools are available in the MCP Router.',
      );
    });

    /**
     * Test prototype chain
     */
    it('should have correct prototype chain', () => {
      const error = new WorkflowToolMissingError(testMissingTools);
      expect(Object.getPrototypeOf(error)).toBe(
        WorkflowToolMissingError.prototype,
      );
    });
  });

  describe('WorkflowReferenceError', () => {
    /**
     * Test WorkflowReferenceError constructor with input field
     */
    it('should create error for input field reference', () => {
      const field = 'input';
      const reference = 'user.name';
      const error = new WorkflowReferenceError(field, reference);

      expect(error).toBeInstanceOf(WorkflowEngineError);
      expect(error).toBeInstanceOf(WorkflowReferenceError);
      expect(error.name).toBe('WorkflowReferenceError');
      expect(error.field).toBe(field);
      expect(error.reference).toBe(reference);
    });

    /**
     * Test WorkflowReferenceError constructor with context field
     */
    it('should create error for context field reference', () => {
      const field = 'context';
      const reference = 'telegramId';
      const error = new WorkflowReferenceError(field, reference);

      expect(error.field).toBe(field);
      expect(error.reference).toBe(reference);
    });

    /**
     * Test error message formatting for input field
     */
    it('should format message correctly for input field', () => {
      const field = 'input';
      const reference = 'user.email';
      const error = new WorkflowReferenceError(field, reference);
      const expectedMessage = `Reference to non existing ${field}: ${reference}. Please check if the ${field} is available in the workflow.`;

      expect(error.message).toBe(expectedMessage);
    });

    /**
     * Test error message formatting for context field
     */
    it('should format message correctly for context field', () => {
      const field = 'context';
      const reference = 'telegramId';
      const error = new WorkflowReferenceError(field, reference);
      const expectedMessage = `Reference to non existing ${field}: ${reference}. Please check if the ${field} is available in the workflow.`;

      expect(error.message).toBe(expectedMessage);
    });

    /**
     * Test humanReadableMessage for input field
     */
    it('should return appropriate human readable message for input field', () => {
      const error = new WorkflowReferenceError('input', 'user.name');
      const expectedMessage =
        "Please check if the input field 'user.name' should be passed by its parent node but not. Call AI to fix it.";

      expect(error.humanReadableMessage).toBe(expectedMessage);
    });

    /**
     * Test humanReadableMessage for context field with valid telegramId reference
     */
    it('should return appropriate human readable message for valid context field', () => {
      const error = new WorkflowReferenceError('context', 'telegramId');

      // The humanReadableMessage should include description from UserContextSchema
      expect(error.humanReadableMessage).toContain('telegramId');
      expect(error.humanReadableMessage).toContain(
        'You can go to my account tab to set it',
      );
    });

    /**
     * Test humanReadableMessage for context field with invalid reference
     */
    it('should return fallback message for invalid context field reference', () => {
      const error = new WorkflowReferenceError('context', 'nonExistentField');
      const expectedMessage =
        "Please check if the context field 'nonExistentField' should be passed by its parent node but not. Call AI to fix it.";

      expect(error.humanReadableMessage).toBe(expectedMessage);
    });

    /**
     * Test nested reference handling
     */
    it('should handle nested references correctly', () => {
      const error = new WorkflowReferenceError(
        'input',
        'user.profile.settings.theme',
      );

      expect(error.reference).toBe('user.profile.settings.theme');
      expect(error.humanReadableMessage).toContain(
        'user.profile.settings.theme',
      );
    });

    /**
     * Test getDescriptionForField method indirectly through humanReadableMessage
     */
    it('should properly parse UserContextSchema for telegramId field', () => {
      const error = new WorkflowReferenceError('context', 'telegramId');
      const jsonSchema = zodToJsonSchema(UserContextSchema);

      // Verify that the schema has the expected structure
      expect(jsonSchema.properties).toHaveProperty('telegramId');
      expect(jsonSchema.properties?.telegramId).toHaveProperty('description');

      // Verify the human readable message uses the schema description
      const humanMessage = error.humanReadableMessage;
      expect(humanMessage).toContain('telegramId');
      expect(humanMessage).toContain('You can go to my account tab to set it');
    });

    /**
     * Test empty reference handling
     */
    it('should handle empty reference', () => {
      const error = new WorkflowReferenceError('input', '');

      expect(error.reference).toBe('');
      expect(error.humanReadableMessage).toContain("input field ''");
    });

    /**
     * Test prototype chain
     */
    it('should have correct prototype chain', () => {
      const error = new WorkflowReferenceError('input', 'test');
      expect(Object.getPrototypeOf(error)).toBe(
        WorkflowReferenceError.prototype,
      );
    });
  });

  describe('Error Inheritance and Polymorphism', () => {
    /**
     * Test that all custom errors inherit from WorkflowEngineError
     */
    it('should have all custom errors inherit from WorkflowEngineError', () => {
      const inputOutputError = new WorkflowInputOutputMismatchError(
        ['error'],
        ['suggestion'],
      );
      const toolMissingError = new WorkflowToolMissingError(['tool']);
      const referenceError = new WorkflowReferenceError('input', 'field');

      expect(inputOutputError).toBeInstanceOf(WorkflowEngineError);
      expect(toolMissingError).toBeInstanceOf(WorkflowEngineError);
      expect(referenceError).toBeInstanceOf(WorkflowEngineError);
    });

    /**
     * Test that all custom errors can be caught as WorkflowEngineError
     */
    it('should be catchable as WorkflowEngineError', () => {
      const errors = [
        new WorkflowInputOutputMismatchError(['error'], ['suggestion']),
        new WorkflowToolMissingError(['tool']),
        new WorkflowReferenceError('input', 'field'),
      ];

      errors.forEach((error) => {
        expect(() => {
          throw error;
        }).toThrow(WorkflowEngineError);
      });
    });

    /**
     * Test error type checking in catch blocks
     */
    it('should allow type checking in catch blocks', () => {
      const testErrors = [
        new WorkflowInputOutputMismatchError(['error'], ['suggestion']),
        new WorkflowToolMissingError(['tool']),
        new WorkflowReferenceError('input', 'field'),
      ];

      testErrors.forEach((error) => {
        try {
          throw error;
        } catch (caught) {
          expect(caught).toBeInstanceOf(WorkflowEngineError);

          if (caught instanceof WorkflowInputOutputMismatchError) {
            expect(caught.errors).toBeDefined();
            expect(caught.suggestions).toBeDefined();
          } else if (caught instanceof WorkflowToolMissingError) {
            expect(caught.getMissingTools).toBeDefined();
          } else if (caught instanceof WorkflowReferenceError) {
            expect(caught.field).toBeDefined();
            expect(caught.reference).toBeDefined();
            expect(caught.humanReadableMessage).toBeDefined();
          }
        }
      });
    });
  });
});
