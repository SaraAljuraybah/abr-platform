import { z } from '@/lib/zod-i18n';

/** Sign-in checks presence and email shape only; password rules apply at sign-up. */
export const signInSchema = z.object({
  email: z.string().trim().min(1).pipe(z.email()),
  password: z.string().min(1),
});

export type SignInValues = z.infer<typeof signInSchema>;
