import {
  ChatSDKError,
  getMessageByErrorCode,
  visibilityBySurface,
  type ErrorCode,
  type ErrorType,
  type Surface,
  type ErrorVisibility,
} from './errors';

// Mock console.error for testing
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Errors Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ChatSDKError', () => {
    describe('constructor', () => {
      test('should create error with valid error code', () => {
        const error = new ChatSDKError('bad_request:api');

        expect(error.type).toBe('bad_request');
        expect(error.surface).toBe('api');
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe(
          "The request couldn't be processed. Please check your input and try again.",
        );
      });

      test('should create error with cause', () => {
        const cause = 'Invalid input parameters';
        const error = new ChatSDKError('bad_request:api', cause);

        expect(error.cause).toBe(cause);
        expect(error.message).toBe(
          "The request couldn't be processed. Please check your input and try again.",
        );
      });

      test('should handle database error codes', () => {
        const error = new ChatSDKError('bad_request:database');

        expect(error.type).toBe('bad_request');
        expect(error.surface).toBe('database');
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe(
          'An error occurred while executing a database query.',
        );
      });

      test('should handle unauthorized auth errors', () => {
        const error = new ChatSDKError('unauthorized:auth');

        expect(error.type).toBe('unauthorized');
        expect(error.surface).toBe('auth');
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('You need to sign in before continuing.');
      });

      test('should handle forbidden auth errors', () => {
        const error = new ChatSDKError('forbidden:auth');

        expect(error.type).toBe('forbidden');
        expect(error.surface).toBe('auth');
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe(
          'Your account does not have access to this feature.',
        );
      });

      test('should handle chat-related errors', () => {
        const rateLimitError = new ChatSDKError('rate_limit:chat');
        expect(rateLimitError.statusCode).toBe(429);
        expect(rateLimitError.message).toBe(
          'You have exceeded your maximum number of messages for the day. Please try again later.',
        );

        const notFoundError = new ChatSDKError('not_found:chat');
        expect(notFoundError.statusCode).toBe(404);
        expect(notFoundError.message).toBe(
          'The requested chat was not found. Please check the chat ID and try again.',
        );

        const forbiddenError = new ChatSDKError('forbidden:chat');
        expect(forbiddenError.statusCode).toBe(403);
        expect(forbiddenError.message).toBe(
          'This chat belongs to another user. Please check the chat ID and try again.',
        );

        const unauthorizedError = new ChatSDKError('unauthorized:chat');
        expect(unauthorizedError.statusCode).toBe(401);
        expect(unauthorizedError.message).toBe(
          'You need to sign in to view this chat. Please sign in and try again.',
        );

        const offlineError = new ChatSDKError('offline:chat');
        expect(offlineError.statusCode).toBe(503);
        expect(offlineError.message).toBe(
          "We're having trouble sending your message. Please check your internet connection and try again.",
        );
      });

      test('should handle document-related errors', () => {
        const notFoundError = new ChatSDKError('not_found:document');
        expect(notFoundError.statusCode).toBe(404);
        expect(notFoundError.message).toBe(
          'The requested document was not found. Please check the document ID and try again.',
        );

        const forbiddenError = new ChatSDKError('forbidden:document');
        expect(forbiddenError.statusCode).toBe(403);
        expect(forbiddenError.message).toBe(
          'This document belongs to another user. Please check the document ID and try again.',
        );

        const unauthorizedError = new ChatSDKError('unauthorized:document');
        expect(unauthorizedError.statusCode).toBe(401);
        expect(unauthorizedError.message).toBe(
          'You need to sign in to view this document. Please sign in and try again.',
        );

        const badRequestError = new ChatSDKError('bad_request:document');
        expect(badRequestError.statusCode).toBe(400);
        expect(badRequestError.message).toBe(
          'The request to create or update the document was invalid. Please check your input and try again.',
        );
      });

      test('should handle unknown error codes with default message', () => {
        const error = new ChatSDKError(
          'not_found:unknown_surface' as ErrorCode,
        );

        expect(error.type).toBe('not_found');
        expect(error.surface).toBe('unknown_surface');
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe(
          'Something went wrong. Please try again later.',
        );
      });

      test('should handle unknown error types with default status code', () => {
        const error = new ChatSDKError('unknown_type:api' as ErrorCode);

        expect(error.type).toBe('unknown_type');
        expect(error.surface).toBe('api');
        expect(error.statusCode).toBe(500); // Default status code
        expect(error.message).toBe(
          'Something went wrong. Please try again later.',
        );
      });
    });

    describe('toResponse', () => {
      test('should return response with error details for visible surfaces', () => {
        const error = new ChatSDKError('bad_request:api', 'Test cause');
        const response = error.toResponse();

        expect(response).toBeInstanceOf(Response);
        // Cannot easily test Response.json content in Jest without additional setup
        // In a real test environment, you would check the response body and status
      });

      test('should log error and return generic message for database errors', () => {
        const error = new ChatSDKError(
          'bad_request:database',
          'Database connection failed',
        );
        const response = error.toResponse();

        expect(console.error).toHaveBeenCalledWith({
          code: 'bad_request:database',
          message: 'An error occurred while executing a database query.',
          cause: 'Database connection failed',
        });

        expect(response).toBeInstanceOf(Response);
      });

      test('should handle surfaces with response visibility', () => {
        const surfaces: Surface[] = [
          'chat',
          'auth',
          'stream',
          'api',
          'history',
          'vote',
          'document',
          'suggestions',
        ];

        surfaces.forEach((surface) => {
          const error = new ChatSDKError(`bad_request:${surface}` as ErrorCode);
          const response = error.toResponse();

          expect(response).toBeInstanceOf(Response);
          expect(console.error).not.toHaveBeenCalled();
        });
      });

      test('should handle surfaces with log visibility', () => {
        const error = new ChatSDKError('bad_request:database');
        const response = error.toResponse();

        expect(console.error).toHaveBeenCalled();
        expect(response).toBeInstanceOf(Response);
      });
    });
  });

  describe('getMessageByErrorCode', () => {
    test('should return database error message for any database error code', () => {
      const databaseCodes: ErrorCode[] = [
        'bad_request:database',
        'unauthorized:database',
        'forbidden:database',
        'not_found:database',
      ];

      databaseCodes.forEach((code) => {
        const message = getMessageByErrorCode(code);
        expect(message).toBe(
          'An error occurred while executing a database query.',
        );
      });
    });

    test('should return specific messages for known error codes', () => {
      const testCases: [ErrorCode, string][] = [
        [
          'bad_request:api',
          "The request couldn't be processed. Please check your input and try again.",
        ],
        ['unauthorized:auth', 'You need to sign in before continuing.'],
        [
          'forbidden:auth',
          'Your account does not have access to this feature.',
        ],
        [
          'rate_limit:chat',
          'You have exceeded your maximum number of messages for the day. Please try again later.',
        ],
        [
          'not_found:chat',
          'The requested chat was not found. Please check the chat ID and try again.',
        ],
        [
          'forbidden:chat',
          'This chat belongs to another user. Please check the chat ID and try again.',
        ],
        [
          'unauthorized:chat',
          'You need to sign in to view this chat. Please sign in and try again.',
        ],
        [
          'offline:chat',
          "We're having trouble sending your message. Please check your internet connection and try again.",
        ],
        [
          'not_found:document',
          'The requested document was not found. Please check the document ID and try again.',
        ],
        [
          'forbidden:document',
          'This document belongs to another user. Please check the document ID and try again.',
        ],
        [
          'unauthorized:document',
          'You need to sign in to view this document. Please sign in and try again.',
        ],
        [
          'bad_request:document',
          'The request to create or update the document was invalid. Please check your input and try again.',
        ],
      ];

      testCases.forEach(([code, expectedMessage]) => {
        const message = getMessageByErrorCode(code);
        expect(message).toBe(expectedMessage);
      });
    });

    test('should return default message for unknown error codes', () => {
      const unknownCodes: ErrorCode[] = [
        'unknown:unknown' as ErrorCode,
        'bad_request:unknown_surface' as ErrorCode,
        'unknown_type:api' as ErrorCode,
      ];

      unknownCodes.forEach((code) => {
        const message = getMessageByErrorCode(code);
        expect(message).toBe('Something went wrong. Please try again later.');
      });
    });
  });

  describe('visibilityBySurface', () => {
    test('should have correct visibility settings for all surfaces', () => {
      const expectedVisibilities: Record<Surface, ErrorVisibility> = {
        database: 'log',
        chat: 'response',
        auth: 'response',
        stream: 'response',
        api: 'response',
        history: 'response',
        vote: 'response',
        document: 'response',
        suggestions: 'response',
      };

      Object.entries(expectedVisibilities).forEach(
        ([surface, expectedVisibility]) => {
          expect(visibilityBySurface[surface as Surface]).toBe(
            expectedVisibility,
          );
        },
      );
    });

    test('should only have database as log visibility', () => {
      const logSurfaces = Object.entries(visibilityBySurface)
        .filter(([_, visibility]) => visibility === 'log')
        .map(([surface, _]) => surface);

      expect(logSurfaces).toEqual(['database']);
    });

    test('should have all other surfaces as response visibility', () => {
      const responseSurfaces = Object.entries(visibilityBySurface)
        .filter(([_, visibility]) => visibility === 'response')
        .map(([surface, _]) => surface);

      const expectedResponseSurfaces = [
        'chat',
        'auth',
        'stream',
        'api',
        'history',
        'vote',
        'document',
        'suggestions',
      ];

      expect(responseSurfaces.sort()).toEqual(expectedResponseSurfaces.sort());
    });
  });

  describe('Error Type Integration', () => {
    test('should create proper error instances for all error types', () => {
      const errorTypes: ErrorType[] = [
        'bad_request',
        'unauthorized',
        'forbidden',
        'not_found',
        'rate_limit',
        'offline',
      ];

      errorTypes.forEach((type) => {
        const error = new ChatSDKError(`${type}:api` as ErrorCode);
        expect(error.type).toBe(type);
        expect(error.surface).toBe('api');
        expect(error instanceof Error).toBe(true);
        expect(error instanceof ChatSDKError).toBe(true);
      });
    });

    test('should have proper status codes for all error types', () => {
      const expectedStatusCodes: Record<ErrorType, number> = {
        bad_request: 400,
        unauthorized: 401,
        forbidden: 403,
        not_found: 404,
        rate_limit: 429,
        offline: 503,
      };

      Object.entries(expectedStatusCodes).forEach(([type, expectedStatus]) => {
        const error = new ChatSDKError(`${type}:api` as ErrorCode);
        expect(error.statusCode).toBe(expectedStatus);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle malformed error codes gracefully', () => {
      // Test with error code that doesn't follow the pattern
      const error = new ChatSDKError('invalid_error_code' as ErrorCode);

      expect(error.type).toBe('invalid_error_code');
      expect(error.surface).toBeUndefined();
      expect(error.statusCode).toBe(500); // Default status code
      expect(error.message).toBe(
        'Something went wrong. Please try again later.',
      );
    });

    test('should handle empty error code', () => {
      const error = new ChatSDKError('' as ErrorCode);

      expect(error.type).toBe('');
      expect(error.surface).toBeUndefined();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe(
        'Something went wrong. Please try again later.',
      );
    });

    test('should handle error code with only one part', () => {
      const error = new ChatSDKError('bad_request' as ErrorCode);

      expect(error.type).toBe('bad_request');
      expect(error.surface).toBeUndefined();
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(
        'Something went wrong. Please try again later.',
      );
    });

    test('should handle error code with multiple colons', () => {
      const error = new ChatSDKError('bad_request:api:extra' as ErrorCode);

      expect(error.type).toBe('bad_request');
      expect(error.surface).toBe('api');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(
        'Something went wrong. Please try again later.',
      ); // Changed expectation
    });
  });
});
