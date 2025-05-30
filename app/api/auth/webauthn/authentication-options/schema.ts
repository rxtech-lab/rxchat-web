import { z } from 'zod';

export const authenticationOptionsSchema = z.object({
  userId: z.string(),
});

export type AuthenticationOptionsSchema = z.infer<
  typeof authenticationOptionsSchema
>;
