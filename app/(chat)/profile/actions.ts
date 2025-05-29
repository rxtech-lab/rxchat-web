'use server';

import { auth, signOut } from '@/app/(auth)/auth';
import {
  deleteUserAccount,
  updateUserPassword,
  getUserById,
} from '@/lib/db/queries';
import { compare } from 'bcrypt-ts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const resetPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm' }),
  }),
});

export type ActionResult = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

/**
 * Server action to reset user password
 */
export async function resetPassword(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      message: 'Not authenticated',
    };
  }

  const validatedFields = resetPasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid form data',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { currentPassword, newPassword } = validatedFields.data;

  try {
    // Get user from database to verify current password
    const { getUserById } = await import('@/lib/db/queries');
    const user = await getUserById(session.user.id);

    if (!user || !user.password) {
      return {
        success: false,
        message: 'User not found or invalid account',
      };
    }

    // Verify current password
    const passwordsMatch = await compare(currentPassword, user.password);
    if (!passwordsMatch) {
      return {
        success: false,
        message: 'Current password is incorrect',
        errors: { currentPassword: ['Current password is incorrect'] },
      };
    }

    // Update password
    await updateUserPassword({
      id: session.user.id,
      password: newPassword,
    });

    revalidatePath('/profile');

    return {
      success: true,
      message: 'Password updated successfully',
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      message: 'Failed to update password. Please try again.',
    };
  }
}

/**
 * Server action to delete user account
 */
export async function deleteAccount(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      message: 'Not authenticated',
    };
  }

  const validatedFields = deleteAccountSchema.safeParse({
    password: formData.get('password'),
    confirmation: formData.get('confirmation'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid form data',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { password } = validatedFields.data;

  try {
    const user = await getUserById(session.user.id);

    if (!user || !user.password) {
      return {
        success: false,
        message: 'User not found or invalid account',
      };
    }

    // Verify password
    const passwordsMatch = await compare(password, user.password);
    if (!passwordsMatch) {
      return {
        success: false,
        message: 'Password is incorrect',
        errors: { password: ['Password is incorrect'] },
      };
    }

    // Delete user account
    await deleteUserAccount({ id: session.user.id });
  } catch (error) {
    console.error('Account deletion error:', error);
    return {
      success: false,
      message: 'Failed to delete account. Please try again.',
    };
  }
  // Sign out and redirect
  await signOut({ redirectTo: '/' });
  // This should not be reached due to redirect in signOut
  return {
    success: true,
    message: 'Account deleted successfully',
  };
}
