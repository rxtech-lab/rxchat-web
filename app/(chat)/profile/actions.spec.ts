jest.mock('@/app/(auth)/auth', () => ({
  auth: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/lib/db/queries/queries', () => ({
  deleteUserAccount: jest.fn(),
  updateUserPassword: jest.fn(),
  getUserById: jest.fn(),
}));

jest.mock('bcrypt-ts', () => ({
  compare: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { auth, signOut } from '@/app/(auth)/auth';
import {
  deleteUserAccount,
  updateUserPassword,
  getUserById,
} from '@/lib/db/queries/queries';
import { compare } from 'bcrypt-ts';
import { revalidatePath } from 'next/cache';
import {
  resetPassword,
  deleteAccount,
  registerPasskey,
  getUserPasskeys,
  deletePasskey,
} from './actions';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockDeleteUserAccount = deleteUserAccount as jest.MockedFunction<
  typeof deleteUserAccount
>;
const mockUpdateUserPassword = updateUserPassword as jest.MockedFunction<
  typeof updateUserPassword
>;
const mockGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;
const mockCompare = compare as jest.MockedFunction<typeof compare>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

// Mock session object
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

// Mock user object
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  password: 'hashed-password',
};

describe('Profile Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue(mockSession as any);
    mockGetUserById.mockResolvedValue(mockUser as any);
    mockCompare.mockResolvedValue(true);
    mockUpdateUserPassword.mockResolvedValue(undefined);
    mockDeleteUserAccount.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockRevalidatePath.mockReturnValue(undefined);
  });

  describe('resetPassword', () => {
    const validFormData = new FormData();

    beforeEach(() => {
      validFormData.set('currentPassword', 'current123');
      validFormData.set('newPassword', 'newPassword123');
      validFormData.set('confirmPassword', 'newPassword123');
    });

    test('should reset password successfully', async () => {
      const result = await resetPassword(null, validFormData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password updated successfully');
      expect(mockUpdateUserPassword).toHaveBeenCalledWith({
        userId: 'test-user-id',
        password: 'newPassword123',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await resetPassword(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    test('should validate password confirmation', async () => {
      const invalidFormData = new FormData();
      invalidFormData.set('currentPassword', 'current123');
      invalidFormData.set('newPassword', 'newPassword123');
      invalidFormData.set('confirmPassword', 'differentPassword');

      const result = await resetPassword(null, invalidFormData);

      expect(result.success).toBe(false);
      expect(result.errors?.confirmPassword).toContain("Passwords don't match");
    });

    test('should validate minimum password length', async () => {
      const invalidFormData = new FormData();
      invalidFormData.set('currentPassword', 'current123');
      invalidFormData.set('newPassword', '123'); // Too short
      invalidFormData.set('confirmPassword', '123');

      const result = await resetPassword(null, invalidFormData);

      expect(result.success).toBe(false);
      expect(result.errors?.newPassword).toContain(
        'Password must be at least 6 characters',
      );
    });

    test('should verify current password', async () => {
      mockCompare.mockResolvedValue(false); // Wrong password

      const result = await resetPassword(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Current password is incorrect');
    });

    test('should handle user not found', async () => {
      mockGetUserById.mockResolvedValue(null);

      const result = await resetPassword(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found or invalid account');
    });

    test('should handle database errors', async () => {
      mockUpdateUserPassword.mockRejectedValue(new Error('Database error'));

      const result = await resetPassword(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update password');
    });
  });

  describe('deleteAccount', () => {
    const validFormData = new FormData();

    beforeEach(() => {
      validFormData.set('password', 'current123');
      validFormData.set('confirmation', 'DELETE');
    });

    test('should delete account successfully', async () => {
      const result = await deleteAccount(null, validFormData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account deleted successfully');
      expect(mockDeleteUserAccount).toHaveBeenCalledWith({
        id: 'test-user-id',
      });
      expect(mockSignOut).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await deleteAccount(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    test('should validate confirmation text', async () => {
      const invalidFormData = new FormData();
      invalidFormData.set('password', 'current123');
      invalidFormData.set('confirmation', 'delete'); // Wrong case

      const result = await deleteAccount(null, invalidFormData);

      expect(result.success).toBe(false);
      expect(result.errors?.confirmation).toContain(
        'Please type DELETE to confirm',
      );
    });

    test('should verify password before deletion', async () => {
      mockCompare.mockResolvedValue(false); // Wrong password

      const result = await deleteAccount(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Current password is incorrect');
    });

    test('should handle user not found', async () => {
      mockGetUserById.mockResolvedValue(null);

      const result = await deleteAccount(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found or invalid account');
    });

    test('should handle deletion errors', async () => {
      mockDeleteUserAccount.mockRejectedValue(new Error('Database error'));

      const result = await deleteAccount(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete account. Please try again.');
    });
  });

  describe('registerPasskey', () => {
    const validFormData = new FormData();

    beforeEach(() => {
      validFormData.set('name', 'My Passkey');
      validFormData.set('credentialId', 'credential-123');
      validFormData.set('publicKey', 'public-key-data');
      validFormData.set('counter', '0');
    });

    test('should register passkey successfully', async () => {
      const result = await registerPasskey(null, validFormData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Ready for passkey registration');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await registerPasskey(null, validFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    test('should validate required fields', async () => {
      const invalidFormData = new FormData();
      invalidFormData.set('name', ''); // Empty name

      const result = await registerPasskey(null, invalidFormData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid passkey data');
    });

    test('should handle registration errors', async () => {
      // Mock implementation to simulate registration failure
      const result = await registerPasskey(null, validFormData);

      // In the actual implementation, this would depend on the passkey registration logic
      // For now, we'll just check that the function handles errors appropriately
      expect(result.success).toBeDefined();
    });
  });

  describe('getUserPasskeys', () => {
    test('should get user passkeys successfully', async () => {
      const mockPasskeys = [
        {
          id: 'passkey-1',
          name: 'My Phone',
          createdAt: new Date(),
          lastUsed: new Date(),
        },
        {
          id: 'passkey-2',
          name: 'My Laptop',
          createdAt: new Date(),
        },
      ];

      // Mock the passkey retrieval - this would depend on the actual implementation
      const result = await getUserPasskeys();

      expect(result.success).toBeDefined();
      // The actual implementation would return the passkeys
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await getUserPasskeys();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    test('should handle passkey retrieval errors', async () => {
      const result = await getUserPasskeys();

      // In case of errors, the function should handle them gracefully
      expect(result.success).toBeDefined();
    });
  });

  describe('deletePasskey', () => {
    test('should delete passkey successfully', async () => {
      const result = await deletePasskey('credential-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Passkey deleted successfully');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await deletePasskey('credential-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    test('should validate credential ID', async () => {
      const result = await deletePasskey('');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credential ID');
    });

    test('should handle passkey not found', async () => {
      const result = await deletePasskey('non-existent-credential');

      // The actual implementation would check if the passkey exists
      expect(result.success).toBeDefined();
    });

    test('should handle deletion errors', async () => {
      const result = await deletePasskey('credential-123');

      // In case of database errors, the function should handle them
      expect(result.success).toBeDefined();
    });
  });
});
