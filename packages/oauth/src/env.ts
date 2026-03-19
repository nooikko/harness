import { z } from 'zod';

const envSchema = z.object({
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  OAUTH_ENCRYPTION_KEY: z.string().optional(),
});

type LoadEnv = () => z.infer<typeof envSchema>;

export const loadEnv: LoadEnv = () => envSchema.parse(process.env);
