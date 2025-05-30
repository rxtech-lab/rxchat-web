import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

import {
  createPasskeyAuthenticator,
  createUserWithoutPassword,
  getPasskeyAuthenticatorByCredentialId,
  getPasskeyAuthenticatorsByEmail,
  getPasskeyAuthenticatorsByUserId,
  updatePasskeyAuthenticatorCounter,
} from '@/lib/db/queries';
import {
  createChallenge,
  deleteChallenge,
  getChallenge,
} from '@/lib/webauthn-challenges';

/**
 * WebAuthn Implementation with Graceful Challenge Handling
 *
 * HANDLING EXPIRED CHALLENGES:
 *
 * The current implementation handles expired challenges by returning a specific error code
 * 'CHALLENGE_EXPIRED' when a challenge expires but the passkey is still valid.
 *
 * Frontend Usage Example:
 *
 * ```typescript
 * try {
 *   const response = await fetch('/api/auth/webauthn/authentication-verification', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ response: authResponse, challengeId })
 *   });
 *
 *   if (!response.ok) {
 *     const error = await response.json();
 *
 *     if (error.message === 'CHALLENGE_EXPIRED') {
 *       // Challenge expired - restart authentication flow
 *       const retryResponse = await fetch('/api/auth/webauthn/authentication-options', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ email: userEmail }) // or userId if known
 *       });
 *
 *       const { options, challengeId: newChallengeId } = await retryResponse.json();
 *
 *       // Show user a message: "Session expired, please authenticate again"
 *       const newAuthResponse = await startAuthentication(options);
 *
 *       // Retry with new challenge
 *       return await verifyAuthentication(newAuthResponse, newChallengeId);
 *     }
 *
 *     throw new Error(error.message);
 *   }
 *
 *   return await response.json();
 * } catch (error) {
 *   console.error('Authentication failed:', error);
 * }
 * ```
 *
 * BENEFITS OF THIS APPROACH:
 *
 * 1. **Security**: Challenges still expire to prevent replay attacks
 * 2. **User Experience**: Users don't lose their progress, just need to re-authenticate
 * 3. **Reliability**: Handles network delays, browser backgrounding, etc.
 * 4. **Transparency**: Clear error codes help frontend handle different scenarios
 *
 * The `handleExpiredChallenge` function can also be used server-side to restart
 * authentication flows when you detect expired challenges.
 */

// Environment variables with defaults for development
const RP_NAME = process.env.NEXT_PUBLIC_WEBAUTHN_RP_NAME || 'RxChat';
const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
const ORIGIN =
  process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';

export interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

export const webAuthnConfig: WebAuthnConfig = {
  rpName: RP_NAME,
  rpID: RP_ID,
  origin: ORIGIN,
};

/**
 * Generate registration options for a new passkey
 */
export async function generatePasskeyRegistrationOptions({
  userId,
  userName,
  userDisplayName,
}: {
  userId: string;
  userName: string;
  userDisplayName: string;
}) {
  let excludeCredentials: { id: string; transports?: any[] }[] = [];

  // Skip checking existing authenticators for temporary users (new registrations)
  if (!userId.startsWith('temp_')) {
    // Get existing authenticators for this user
    const existingAuthenticators =
      await getPasskeyAuthenticatorsByUserId(userId);

    // Convert to format expected by SimpleWebAuthn v13
    excludeCredentials = existingAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      transports: authenticator.transports,
    }));
  }

  const options = await generateRegistrationOptions({
    rpName: webAuthnConfig.rpName,
    rpID: webAuthnConfig.rpID,
    userID: new Uint8Array(Buffer.from(userId)),
    userName,
    userDisplayName,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
  });

  // Store the challenge in database with 5-minute expiration
  const challengeRecord = await createChallenge({
    challenge: options.challenge,
    userId,
    type: 'registration',
    ttlSeconds: 300, // 5 minutes
  });

  return {
    options,
    challengeId: challengeRecord.id,
  };
}

/**
 * Extend the TTL of an existing challenge if it's close to expiring
 * Note: Since Redis handles TTL automatically, this function creates a new challenge
 * with the same data but extended expiration time if the current one is about to expire
 */
export async function extendChallengeIfNeeded(
  challengeId: string,
  extensionSeconds = 300,
) {
  const challengeRecord = await getChallenge(challengeId);

  if (!challengeRecord) {
    return null;
  }

  // Since Redis handles TTL automatically and we don't store it in the challenge object,
  // we'll create a new challenge with extended TTL and return it
  // This is useful for long-running authentication processes
  const newChallenge = await createChallenge({
    challenge: challengeRecord.challenge,
    userId: challengeRecord.userId,
    type: challengeRecord.type,
    ttlSeconds: extensionSeconds,
  });

  // Delete the old challenge
  await deleteChallenge(challengeId);

  return newChallenge;
}

/**
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration({
  response,
  challengeId,
  name,
  email,
  expectedOrigin = webAuthnConfig.origin,
  expectedRPID = webAuthnConfig.rpID,
}: {
  response: RegistrationResponseJSON;
  challengeId: string;
  name?: string;
  email?: string;
  expectedOrigin?: string;
  expectedRPID?: string;
}) {
  // Get and validate the challenge
  const challengeRecord = await getChallenge(challengeId);
  if (!challengeRecord || challengeRecord.type !== 'registration') {
    throw new Error('CHALLENGE_EXPIRED');
  }

  if (!challengeRecord.userId) {
    throw new Error(
      'Challenge must have an associated user ID for registration',
    );
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin,
    expectedRPID,
  });

  // Clean up the challenge
  await deleteChallenge(challengeId);

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { registrationInfo } = verification;

  let actualUserId = challengeRecord.userId;

  // If this is a new user registration (temporary user ID), create the user account first
  if (challengeRecord.userId.startsWith('temp_')) {
    if (!email) {
      throw new Error('Email is required for new user registration');
    }

    // Create a new user account without a password since this is passkey-only registration
    const newUser = await createUserWithoutPassword(email);
    actualUserId = newUser.id;
  }

  // Store the authenticator in the database
  const authenticator = await createPasskeyAuthenticator({
    credentialID: registrationInfo.credential.id,
    userId: actualUserId,
    credentialPublicKey: Buffer.from(
      registrationInfo.credential.publicKey,
    ).toString('base64'),
    counter: registrationInfo.credential.counter,
    credentialDeviceType: registrationInfo.credentialDeviceType,
    credentialBackedUp: registrationInfo.credentialBackedUp,
    transports: registrationInfo.credential.transports || [],
    name: name || 'Unnamed Passkey',
  });

  return {
    verified: true,
    authenticator,
    userId: actualUserId,
  };
}

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthenticationOptions({
  userId,
  email,
}: {
  userId?: string;
  email?: string;
} = {}) {
  let allowCredentials: { id: string; transports?: any[] }[] = [];

  // If userId is provided, get their specific authenticators
  if (userId) {
    const userAuthenticators = await getPasskeyAuthenticatorsByUserId(userId);
    allowCredentials = userAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      transports: authenticator.transports,
    }));
  }
  // If email is provided (and no userId), get authenticators by email
  else if (email) {
    const userAuthenticators = await getPasskeyAuthenticatorsByEmail(email);
    allowCredentials = userAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      transports: authenticator.transports,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: webAuthnConfig.rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  // Store the challenge with 5-minute expiration
  const challengeRecord = await createChallenge({
    challenge: options.challenge,
    userId,
    type: 'authentication',
    ttlSeconds: 300, // 5 minutes
  });

  return {
    options,
    challengeId: challengeRecord.id,
  };
}

/**
 * Verify passkey authentication response
 */
export async function verifyPasskeyAuthentication({
  response,
  challengeId,
  expectedOrigin = webAuthnConfig.origin,
  expectedRPID = webAuthnConfig.rpID,
}: {
  response: AuthenticationResponseJSON;
  challengeId: string;
  expectedOrigin?: string;
  expectedRPID?: string;
}) {
  // Get and validate the challenge
  const challengeRecord = await getChallenge(challengeId);
  if (!challengeRecord || challengeRecord.type !== 'authentication') {
    // Check if the credential exists to provide better error messaging
    const authenticator = await getPasskeyAuthenticatorByCredentialId(
      response.id,
    );

    if (authenticator) {
      // The user has a valid passkey but the challenge expired
      throw new Error('CHALLENGE_EXPIRED');
    } else {
      // The credential doesn't exist in our system
      throw new Error('Invalid or expired challenge');
    }
  }

  // Get the authenticator
  const authenticator = await getPasskeyAuthenticatorByCredentialId(
    response.id,
  );

  if (!authenticator) {
    throw new Error('Authenticator not found');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: authenticator.credentialID,
      publicKey: new Uint8Array(
        Buffer.from(authenticator.credentialPublicKey, 'base64'),
      ),
      counter: authenticator.counter,
      transports: authenticator.transports,
    },
  });

  // Clean up the challenge
  await deleteChallenge(challengeId);

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  // Update the authenticator counter
  if (verification.authenticationInfo) {
    await updatePasskeyAuthenticatorCounter({
      credentialID: authenticator.credentialID,
      counter: verification.authenticationInfo.newCounter,
    });
  }

  return {
    verified: true,
    userId: authenticator.userId,
    authenticator,
  };
}

/**
 * Handle expired challenge scenario by allowing graceful restart
 */
export async function handleExpiredChallenge({
  credentialId,
  email,
}: {
  credentialId: string;
  email?: string;
}) {
  // Verify the credential exists
  const authenticator =
    await getPasskeyAuthenticatorByCredentialId(credentialId);

  if (!authenticator) {
    throw new Error('Credential not found');
  }

  // Generate new authentication options for this user
  const { options, challengeId } = await generatePasskeyAuthenticationOptions({
    userId: authenticator.userId,
    email,
  });

  return {
    options,
    challengeId,
    userId: authenticator.userId,
    message: 'Challenge expired. Please authenticate again with your passkey.',
  };
}
