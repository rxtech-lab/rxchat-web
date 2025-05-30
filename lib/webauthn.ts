import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

import {
  createChallenge,
  getChallenge,
  deleteChallenge,
} from '@/lib/webauthn-challenges';
import {
  getPasskeyAuthenticatorsByUserId,
  getPasskeyAuthenticatorByCredentialId,
  createPasskeyAuthenticator,
  updatePasskeyAuthenticatorCounter,
} from '@/lib/db/queries';

// Environment variables with defaults for development
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'RxChat';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

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
  // Get existing authenticators for this user
  const existingAuthenticators = await getPasskeyAuthenticatorsByUserId(userId);

  // Convert to format expected by SimpleWebAuthn v13
  const excludeCredentials = existingAuthenticators.map((authenticator) => ({
    id: authenticator.credentialID,
    transports: authenticator.transports,
  }));

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
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration({
  response,
  challengeId,
  expectedOrigin = webAuthnConfig.origin,
  expectedRPID = webAuthnConfig.rpID,
}: {
  response: RegistrationResponseJSON;
  challengeId: string;
  expectedOrigin?: string;
  expectedRPID?: string;
}) {
  // Get and validate the challenge
  const challengeRecord = await getChallenge(challengeId);
  if (!challengeRecord || challengeRecord.type !== 'registration') {
    throw new Error('Invalid or expired challenge');
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

  // Store the authenticator in the database
  const authenticator = await createPasskeyAuthenticator({
    credentialID: registrationInfo.credential.id,
    userId: challengeRecord.userId,
    credentialPublicKey: Buffer.from(
      registrationInfo.credential.publicKey,
    ).toString('base64'),
    counter: registrationInfo.credential.counter,
    credentialDeviceType: registrationInfo.credentialDeviceType,
    credentialBackedUp: registrationInfo.credentialBackedUp,
    transports: registrationInfo.credential.transports || [],
  });

  return {
    verified: true,
    authenticator,
  };
}

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthenticationOptions({
  userId,
}: {
  userId?: string;
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
    throw new Error('Invalid or expired challenge');
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
