import { z } from 'zod';

export const authenticationVerificationSchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.record(z.any()).default({}),
  }),
  challengeId: z.string(),
});

export type AuthenticationVerificationSchema = z.infer<
  typeof authenticationVerificationSchema
>;
