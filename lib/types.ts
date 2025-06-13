import { z } from 'zod';

export type DataPart = { type: 'append-message'; message: string };

export const UserContextSchema = z.object({
  telegramId: z
    .number()
    .describe(
      'The Telegram ID of the user. You can use this to send messages to the user.',
    )
    .nullable(),
});

export type UserContext = z.infer<typeof UserContextSchema>;
