import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { randomBytes } from 'node:crypto';
import type { Config } from '../config.ts';
import type { Mailer, MailMessage } from './mailer.ts';

// Client SMTP minimal : TLS direct (465) ou STARTTLS (587), AUTH PLAIN, message MIME UTF-8 en base64.

export type TlsMode = 'implicit' | 'starttls' | 'none';

export function encodeHeader(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function parseAddress(s: string): { name: string | null; address: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  return m ? { name: m[1].replace(/^"|"$/g, '') || null, address: m[2].trim() } : { name: null, address: s.trim() };
}

function formatAddress(s: string): string {
  const { name, address } = parseAddress(s);
  return name ? `${encodeHeader(name)} <${address}>` : address;
}

function b64lines(s: string): string {
  return (Buffer.from(s.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').match(/.{1,76}/g) ?? []).join('\r\n');
}

function rfc2822Date(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]}, ${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

export function buildMime(m: { from: string; to: string; subject: string; text: string; html?: string; date: Date; messageId: string }): string {
  const head = [
    `From: ${formatAddress(m.from)}`,
    `To: ${formatAddress(m.to)}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${rfc2822Date(m.date)}`,
    `Message-ID: ${m.messageId}`,
    'MIME-Version: 1.0',
  ];
  if (!m.html) {
    return [...head, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64lines(m.text)].join('\r\n');
  }
  const boundary = `=_carte_${randomBytes(12).toString('hex')}`;
  return [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64lines(m.text),
    `--${boundary}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64lines(m.html),
    `--${boundary}--`, '',
  ].join('\r\n');
}

class SmtpConnection {
  private sock: Socket | TLSSocket;
  private buf = '';
  private waiters: ((line: string) => void)[] = [];
  private lines: string[] = [];
  private error: Error | null = null;

  constructor(sock: Socket | TLSSocket) {
    this.sock = sock;
    this.attach(sock);
  }

  private attach(sock: Socket | TLSSocket) {
    sock.setEncoding('utf8');
    sock.on('data', (d: string) => {
      this.buf += d;
      let i: number;
      while ((i = this.buf.indexOf('\r\n')) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        const w = this.waiters.shift();
        if (w) w(line); else this.lines.push(line);
      }
    });
    const fail = (e: Error) => { this.error = e; this.waiters.splice(0).forEach((w) => w(`999 ${e.message}`)); };
    sock.on('error', fail);
    sock.on('timeout', () => { fail(new Error('Délai SMTP dépassé')); sock.destroy(); });
    sock.on('close', () => fail(new Error('Connexion SMTP fermée')));
  }

  private nextLine(): Promise<string> {
    const l = this.lines.shift();
    if (l !== undefined) return Promise.resolve(l);
    if (this.error) return Promise.resolve(`999 ${this.error.message}`);
    return new Promise((r) => this.waiters.push(r));
  }

  async reply(expect: number[]): Promise<string[]> {
    const out: string[] = [];
    while (true) {
      const line = await this.nextLine();
      out.push(line);
      if (line.length < 4 || line[3] !== '-') break;
    }
    const code = Number(out[out.length - 1].slice(0, 3));
    if (!expect.includes(code)) throw new Error(`SMTP ${out.join(' | ')}`);
    return out;
  }

  write(s: string) { this.sock.write(s); }

  async command(cmd: string, expect: number[]): Promise<string[]> {
    this.write(cmd + '\r\n');
    return this.reply(expect);
  }

  async upgrade(host: string, timeoutMs: number, ca?: string): Promise<void> {
    const plain = this.sock as Socket;
    plain.removeAllListeners('data');
    plain.removeAllListeners('close');
    plain.removeAllListeners('error');
    plain.removeAllListeners('timeout');
    const secure = await new Promise<TLSSocket>((resolve, reject) => {
      const timer = setTimeout(() => { s.destroy(); plain.destroy(); reject(new Error('Délai STARTTLS dépassé')); }, timeoutMs);
      const s = tlsConnect({ socket: plain, servername: host, ca }, () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
    secure.setTimeout(timeoutMs);
    this.sock = secure;
    this.attach(secure);
  }

  end() { this.sock.end(); }
  destroy() { this.sock.destroy(); }
}

function open(host: string, port: number, mode: TlsMode, timeoutMs: number, ca?: string): Promise<Socket | TLSSocket> {
  return new Promise((resolve, reject) => {
    const s = mode === 'implicit' ? tlsConnect({ host, port, servername: host, ca }) : netConnect({ host, port });
    s.setTimeout(timeoutMs);
    const ready = mode === 'implicit' ? 'secureConnect' : 'connect';
    s.once(ready, () => { s.removeListener('error', reject); resolve(s); });
    s.once('error', reject);
    s.once('timeout', () => { s.destroy(); reject(new Error('Délai de connexion SMTP dépassé')); });
  });
}

async function dialog(conn: SmtpConnection, msg: MailMessage, smtp: Config['smtp'], mode: TlsMode, timeoutMs: number, ca?: string): Promise<void> {
  await conn.reply([220]);
  const ehlo = 'EHLO carte-qr';
  const caps = await conn.command(ehlo, [250]);
  if (mode === 'starttls') {
    if (!caps.some((l) => /STARTTLS/i.test(l))) throw new Error('Le serveur SMTP ne propose pas STARTTLS');
    await conn.command('STARTTLS', [220]);
    await conn.upgrade(smtp.host, timeoutMs, ca);
    await conn.command(ehlo, [250]);
  }
  const auth = Buffer.from(`\0${smtp.user}\0${smtp.pass}`, 'utf8').toString('base64');
  await conn.command(`AUTH PLAIN ${auth}`, [235]);
  const from = parseAddress(smtp.from).address;
  const to = parseAddress(msg.to).address;
  await conn.command(`MAIL FROM:<${from}>`, [250]);
  await conn.command(`RCPT TO:<${to}>`, [250, 251]);
  await conn.command('DATA', [354]);
  const domain = from.split('@')[1] ?? 'carte-qr';
  const mime = buildMime({ ...msg, from: smtp.from, date: new Date(), messageId: `<${randomBytes(16).toString('hex')}@${domain}>` });
  conn.write(mime.replace(/^\./gm, '..') + '\r\n.\r\n');
  await conn.reply([250]);
  await conn.command('QUIT', [221]).catch(() => {});
}

export function createSmtpMailer(smtp: Config['smtp'], opts: { tls?: TlsMode; timeoutMs?: number; ca?: string } = {}): Mailer {
  const mode: TlsMode = opts.tls ?? (smtp.port === 465 ? 'implicit' : 'starttls');
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return {
    async send(msg: MailMessage): Promise<void> {
      const conn = new SmtpConnection(await open(smtp.host, smtp.port, mode, timeoutMs, opts.ca));
      // Délai global : aucun envoi ne peut rester bloqué plus de 3 fois le délai unitaire.
      let deadline: NodeJS.Timeout | undefined;
      const expired = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => { conn.destroy(); reject(new Error("Délai global d'envoi SMTP dépassé")); }, timeoutMs * 3);
      });
      try {
        await Promise.race([dialog(conn, msg, smtp, mode, timeoutMs, opts.ca), expired]);
      } finally {
        clearTimeout(deadline);
        conn.end();
      }
    },
  };
}
