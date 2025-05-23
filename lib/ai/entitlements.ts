import type { UserType } from '@/app/(auth)/auth';

export interface Entitlements {
  maxMessagesPerDay: number;
  maximumModelPromptPrice: number;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 0,
    maximumModelPromptPrice: 0.00000015,
  },
  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    maximumModelPromptPrice: 0.000003,
  },
  paid: {
    maxMessagesPerDay: 1000,
    maximumModelPromptPrice: 0.000003,
  },
};
