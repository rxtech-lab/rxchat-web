import { z } from 'zod';

export const authenticationOptionsSchema = z.union([
  z.object({
    userId: z.string(),
  }),
  z.object({
    email: z.string().email(),
  }),
  z.object({}), // Allow empty object for discoverable credentials
]);

export type AuthenticationOptionsSchema = z.infer<
  typeof authenticationOptionsSchema
>;
