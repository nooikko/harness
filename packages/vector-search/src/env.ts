import { z } from 'zod';

const envSchema = z.object({
  QDRANT_URL: z.string().optional(),
});

type LoadEnv = () => z.infer<typeof envSchema>;

export const loadEnv: LoadEnv = () => envSchema.parse(process.env);
