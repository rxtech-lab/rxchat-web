import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

/**
 * Client-side WebAuthn registration handler
 */
export async function registerPasskey(
  name?: string,
  email?: string,
): Promise<{
  success: boolean;
  message: string;
  userId?: string;
  signedIn?: boolean;
  currentPasskeyCount?: number;
}> {
  try {
    // Get registration options from server
    const optionsResponse = await fetch(
      '/api/auth/webauthn/registration-options',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(email ? { email } : {}),
      },
    );

    if (!optionsResponse.ok) {
      const errorData = await optionsResponse.json();
      throw new Error(errorData.error || 'Failed to get registration options');
    }

    const { options, challengeId, currentPasskeyCount } =
      await optionsResponse.json();

    // Start WebAuthn registration
    const response = await startRegistration({ optionsJSON: options });

    // Verify registration with server
    const verificationResponse = await fetch(
      '/api/auth/webauthn/registration-verification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response,
          challengeId,
          name: name || 'My Passkey',
          email: email,
        }),
      },
    );

    const verificationResult = await verificationResponse.json();

    if (!verificationResponse.ok) {
      return {
        success: false,
        message: verificationResult.error || 'Failed to verify registration',
      };
    }

    if (verificationResult.verified) {
      return {
        success: true,
        message:
          verificationResult.message || 'Passkey registered successfully',
        userId: verificationResult.userId,
        signedIn: verificationResult.signedIn || false,
        currentPasskeyCount: currentPasskeyCount + 1, // Increment since we just added one
      };
    } else {
      return {
        success: false,
        message: 'Failed to register passkey',
      };
    }
  } catch (error: any) {
    console.error('Passkey registration error:', error);

    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        message: 'Passkey registration was cancelled or not allowed',
      };
    }

    if (error.name === 'NotSupportedError') {
      return {
        success: false,
        message: 'Passkeys are not supported on this device',
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to register passkey',
    };
  }
}

/**
 * Client-side WebAuthn authentication handler
 */
export async function authenticateWithPasskey(
  userId?: string,
  email?: string,
): Promise<{
  success: boolean;
  message: string;
  userId?: string;
}> {
  try {
    // Only send data if we have userId or email
    const hasIdentifier = userId || email;
    const data = hasIdentifier ? (userId ? { userId } : { email }) : {};

    // Get authentication options from server
    const optionsResponse = await fetch(
      '/api/auth/webauthn/authentication-options',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );

    if (!optionsResponse.ok) {
      throw new Error('Failed to get authentication options');
    }

    const { options, challengeId } = await optionsResponse.json();

    // Start WebAuthn authentication
    const response = await startAuthentication({ optionsJSON: options });

    // Verify authentication with server
    const verificationResponse = await fetch(
      '/api/auth/webauthn/authentication-verification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response,
          challengeId,
        }),
      },
    );

    if (!verificationResponse.ok) {
      throw new Error('Failed to verify authentication');
    }

    const verificationResult = await verificationResponse.json();

    if (verificationResult.verified) {
      return {
        success: true,
        message: 'Authentication successful',
        userId: verificationResult.userId,
      };
    } else {
      return {
        success: false,
        message: 'Authentication failed',
      };
    }
  } catch (error: any) {
    console.error('Passkey authentication error:', error);

    // Enhanced error logging for debugging Android issues
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });

    if (error.name === 'NotAllowedError') {
      // More specific error message for Android debugging
      const isAndroid =
        typeof navigator !== 'undefined' &&
        /Android/i.test(navigator.userAgent);
      return {
        success: false,
        message: isAndroid
          ? 'Authentication was cancelled, timed out, or not allowed. Please ensure your device has a screen lock (PIN, pattern, or biometric) enabled and try again.'
          : 'Authentication was cancelled or not allowed',
      };
    }

    if (error.name === 'NotSupportedError') {
      return {
        success: false,
        message: 'Passkeys are not supported on this device',
      };
    }

    if (error.name === 'InvalidStateError') {
      return {
        success: false,
        message:
          'Authentication failed due to device state. Please ensure your screen lock is enabled.',
      };
    }

    if (error.name === 'SecurityError') {
      return {
        success: false,
        message:
          'Security error occurred. Please ensure you are using HTTPS and the correct domain.',
      };
    }

    return {
      success: false,
      message: error.message || 'Authentication failed',
    };
  }
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}
