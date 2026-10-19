export type Config = {
  baseUrl: string;
  port: number;
  host: string;
  trustProxyHops: number;
  dataDir: string;
  adminEmail: string;
  ownerName: string;
  sessionSecret: string;
  smtp: { host: string; port: number; user: string; pass: string; from: string };
  folk: { apiKey: string | null; groupId: string | null };
  s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string } | null;
};

const REQUIRED = ['BASE_URL', 'DATA_DIR', 'ADMIN_EMAIL', 'OWNER_NAME', 'SESSION_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

export function loadConfig(env: Record<string, string | undefined>): Config {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  const v = (k: string) => env[k] as string;
  const s3Keys = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const s3Present = s3Keys.filter((k) => env[k]);
  if (s3Present.length && s3Present.length < s3Keys.length) {
    throw new Error(`Configuration S3 incomplète, il manque : ${s3Keys.filter((k) => !env[k]).join(', ')}`);
  }
  return {
    baseUrl: v('BASE_URL').replace(/\/+$/, ''),
    port: Number(env.PORT ?? 3000),
    host: env.HOST || '127.0.0.1',
    trustProxyHops: Math.max(0, Number(env.TRUST_PROXY_HOPS ?? 1) || 0),
    dataDir: v('DATA_DIR'),
    adminEmail: v('ADMIN_EMAIL').trim().toLowerCase(),
    ownerName: v('OWNER_NAME'),
    sessionSecret: v('SESSION_SECRET'),
    smtp: { host: v('SMTP_HOST'), port: Number(v('SMTP_PORT')), user: v('SMTP_USER'), pass: v('SMTP_PASS'), from: v('SMTP_FROM') },
    folk: { apiKey: env.FOLK_API_KEY || null, groupId: env.FOLK_GROUP_ID || null },
    s3: s3Present.length
      ? { endpoint: v('S3_ENDPOINT'), region: v('S3_REGION'), bucket: v('S3_BUCKET'), accessKeyId: v('S3_ACCESS_KEY_ID'), secretAccessKey: v('S3_SECRET_ACCESS_KEY') }
      : null,
  };
}
