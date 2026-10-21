import { parseEnv } from './env-schema';

export const env = parseEnv(import.meta.env);
