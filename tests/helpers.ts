import type { Config } from '../src/config.ts';

export const ENV: Record<string, string> = {
  BASE_URL: 'https://carte.test',
  PORT: '3000',
  DATA_DIR: '/tmp/carte-test',
  ADMIN_EMAIL: 'benjamin@test.ch',
  OWNER_NAME: 'Benjamin Vallée',
  SESSION_SECRET: 'x'.repeat(32),
  SMTP_HOST: 'smtp.test',
  SMTP_PORT: '465',
  SMTP_USER: 'u',
  SMTP_PASS: 'p',
  SMTP_FROM: 'Carte <carte@test.ch>',
};

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    baseUrl: 'https://carte.test',
    port: 3000,
    dataDir: '/tmp/carte-test',
    adminEmail: 'benjamin@test.ch',
    ownerName: 'Benjamin Vallée',
    sessionSecret: 'x'.repeat(32),
    smtp: { host: 'smtp.test', port: 465, user: 'u', pass: 'p', from: 'Carte <carte@test.ch>' },
    folk: { apiKey: null, groupId: null },
    s3: null,
    ...over,
  };
}
