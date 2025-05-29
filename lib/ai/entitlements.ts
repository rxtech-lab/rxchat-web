'server-only';

import type { UserType } from '@/app/(auth)/auth';
import { isTestEnvironment } from '../constants';

export interface Entitlements {
  maxMessagesPerDay: number;
  maximumModelPromptPrice: number;
}

export const entitlementsByUserRole: Record<UserType, Entitlements> = {
  /*
   * For free users
   */
  free: {
    maxMessagesPerDay: isTestEnvironment ? 1000 : 0,
    maximumModelPromptPrice: 0.00000015,
  },
  /*
   * For users with regular account
   */
  regular: {
    maxMessagesPerDay: 100,
    maximumModelPromptPrice: 0.000003,
  },
  premium: {
    maxMessagesPerDay: 1000,
    maximumModelPromptPrice: 0.000003,
  },
  admin: {
    maxMessagesPerDay: 10000,
    maximumModelPromptPrice: 1,
  },
};
