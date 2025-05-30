import { expect, test } from '../fixtures';

test.describe
  .serial('/api/auth/webauthn', () => {
    let registrationChallengeId: string;
    let authenticationChallengeId: string;

    test('Ada can generate registration options without authentication', async ({
      page,
    }) => {
      // Create a new context without auth to test unauthenticated access
      const unauthenticatedRequest = page.request;

      const response = await unauthenticatedRequest.post(
        '/api/auth/webauthn/registration-options',
        {
          data: {
            email: 'test@test.com',
          },
        },
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('challengeId');
      expect(data.options).toHaveProperty('challenge');
      expect(data.options).toHaveProperty('rp');
      expect(data.options).toHaveProperty('user');
      expect(data.options.rp).toHaveProperty('name');
      expect(data.options.rp).toHaveProperty('id');
    });

    test('Ada can generate registration options', async ({ adaContext }) => {
      const response = await adaContext.request.post(
        '/api/auth/webauthn/registration-options',
        {
          data: {
            email: adaContext.user.email,
          },
        },
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('challengeId');
      expect(data.options).toHaveProperty('challenge');
      expect(data.options).toHaveProperty('rp');
      expect(data.options).toHaveProperty('user');
      expect(data.options.rp).toHaveProperty('name');
      expect(data.options.rp).toHaveProperty('id');
      expect(data.options.user).toHaveProperty('id');
      expect(data.options.user).toHaveProperty('name');
      expect(data.options.user).toHaveProperty('displayName');

      registrationChallengeId = data.challengeId;
    });

    test('Ada cannot verify registration with invalid challenge', async ({
      adaContext,
    }) => {
      const mockRegistrationResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          attestationObject: 'mock-attestation-object',
        },
        type: 'public-key',
      };

      const response = await adaContext.request.post(
        '/api/auth/webauthn/registration-verification',
        {
          data: {
            response: mockRegistrationResponse,
            challengeId: 'invalid-challenge-id',
            name: 'Test Passkey',
          },
        },
      );

      expect(response.status()).toBe(500);
      const { error } = await response.json();
      expect(error).toBe('Failed to verify registration');
    });

    test('Ada can generate authentication options', async ({ adaContext }) => {
      const response = await adaContext.request.post(
        '/api/auth/webauthn/authentication-options',
        {
          data: {
            userId: adaContext.user.id,
          },
        },
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('challengeId');
      expect(data.options).toHaveProperty('challenge');
      expect(data.options).toHaveProperty('rpId');
      expect(data.options).toHaveProperty('allowCredentials');

      authenticationChallengeId = data.challengeId;
    });

    test('Ada can generate authentication option using email', async ({
      adaContext,
    }) => {
      const response = await adaContext.request.post(
        '/api/auth/webauthn/authentication-options',
        {
          data: {
            email: adaContext.user.email,
          },
        },
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('challengeId');
      expect(data.options).toHaveProperty('challenge');
      expect(data.options).toHaveProperty('rpId');
      expect(data.options).toHaveProperty('allowCredentials');

      authenticationChallengeId = data.challengeId;
    });

    test('Ada cannot verify authentication with invalid challenge', async ({
      adaContext,
    }) => {
      const mockAuthenticationResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-authenticator-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      const response = await adaContext.request.post(
        '/api/auth/webauthn/authentication-verification',
        {
          data: {
            response: mockAuthenticationResponse,
            challengeId: 'invalid-challenge-id',
          },
        },
      );

      expect(response.status()).toBe(400);
      const { error } = await response.json();
      expect(error).toBe('Invalid or expired challenge');
    });

    test('Ada cannot verify authentication with missing parameters', async ({
      adaContext,
    }) => {
      const response = await adaContext.request.post(
        '/api/auth/webauthn/authentication-verification',
        {
          data: JSON.stringify({}),
        },
      );

      expect(response.status()).toBe(400);
      const { error } = await response.json();
      expect(error).toBe('Invalid request payload');
    });

    test('Ada cannot verify authentication with valid challenge but invalid response', async ({
      adaContext,
    }) => {
      const mockAuthenticationResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'invalid-client-data',
          authenticatorData: 'invalid-authenticator-data',
          signature: 'invalid-signature',
          userHandle: 'invalid-user-handle',
        },
        type: 'public-key',
      };

      const response = await adaContext.request.post(
        '/api/auth/webauthn/authentication-verification',
        {
          data: {
            response: mockAuthenticationResponse,
            challengeId: authenticationChallengeId,
          },
        },
      );

      expect(response.status()).toBe(400);
      const { error } = await response.json();
      expect(error).toBe('Authenticator not found');
    });

    test('Babbage can verify authentication (no auth required)', async ({
      babbageContext,
    }) => {
      const mockAuthenticationResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-authenticator-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      const response = await babbageContext.request.post(
        '/api/auth/webauthn/authentication-verification',
        {
          data: {
            response: mockAuthenticationResponse,
            challengeId: authenticationChallengeId,
          },
        },
      );

      expect(response.status()).toBe(400);
      const { error } = await response.json();
      expect(error).toBe('Authenticator not found');
    });
  });
