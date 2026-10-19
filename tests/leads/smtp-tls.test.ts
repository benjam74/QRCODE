import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as tlsServer, TLSSocket } from 'node:tls';
import { createServer as netServer, type Socket } from 'node:net';
import { createSmtpMailer } from '../../src/leads/smtp.ts';

let key = '';
let cert = '';
before(() => {
  const dir = mkdtempSync(join(tmpdir(), 'tls-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem')], { stdio: 'ignore' });
  key = readFileSync(join(dir, 'k.pem'), 'utf8');
  cert = readFileSync(join(dir, 'c.pem'), 'utf8');
});

function smtpDialog(sock: Socket | TLSSocket, log: string[], onStartTls?: () => void) {
  let buf = '';
  let inData = false;
  const handler = (chunk: Buffer) => {
    buf += chunk.toString();
    while (true) {
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        buf = buf.slice(end + 5); inData = false; sock.write('250 OK\r\n'); continue;
      }
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2); log.push(line);
      const cmd = line.split(' ')[0].toUpperCase();
      if (cmd === 'EHLO') sock.write(onStartTls && !(sock instanceof TLSSocket) ? '250-fake\r\n250 STARTTLS\r\n' : '250-fake\r\n250 AUTH PLAIN\r\n');
      else if (cmd === 'STARTTLS' && onStartTls) { sock.write('220 go\r\n'); sock.removeListener('data', handler); onStartTls(); return; }
      else if (cmd === 'AUTH') sock.write('235 OK\r\n');
      else if (cmd === 'MAIL' || cmd === 'RCPT') sock.write('250 OK\r\n');
      else if (cmd === 'DATA') { sock.write('354 go\r\n'); inData = true; }
      else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
    }
  };
  sock.on('data', handler);
}

test('TLS direct (port 465)', async () => {
  const log: string[] = [];
  const srv = tlsServer({ key, cert }, (s) => { s.write('220 tls\r\n'); smtpDialog(s, log); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  try {
    const m = createSmtpMailer({ host: 'localhost', port, user: 'u', pass: 'p', from: 'a@ex.ch' }, { tls: 'implicit', ca: cert });
    await m.send({ to: 'b@ex.ch', subject: 's', text: 't' });
    assert.ok(log.includes('RCPT TO:<b@ex.ch>'));
  } finally { srv.close(); }
});

test('STARTTLS (port 587)', async () => {
  const log: string[] = [];
  const srv = netServer((s) => {
    s.write('220 plain\r\n');
    smtpDialog(s, log, () => {
      const secure = new TLSSocket(s, { isServer: true, key, cert });
      smtpDialog(secure, log);
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  try {
    const m = createSmtpMailer({ host: 'localhost', port, user: 'u', pass: 'p', from: 'a@ex.ch' }, { tls: 'starttls', ca: cert });
    await m.send({ to: 'b@ex.ch', subject: 's', text: 't' });
    assert.ok(log.includes('STARTTLS'));
    assert.ok(log.filter((l) => l.startsWith('EHLO')).length === 2);
    assert.ok(log.some((l) => l.startsWith('AUTH PLAIN')));
  } finally { srv.close(); }
});

test('STARTTLS absent : refus d envoyer en clair', async () => {
  const log: string[] = [];
  const srv = netServer((s) => { s.write('220 plain\r\n'); smtpDialog(s, log); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  try {
    const m = createSmtpMailer({ host: 'localhost', port, user: 'u', pass: 'p', from: 'a@ex.ch' }, { tls: 'starttls' });
    await assert.rejects(m.send({ to: 'b@ex.ch', subject: 's', text: 't' }), /STARTTLS/);
    assert.ok(!log.some((l) => l.startsWith('AUTH')));
  } finally { srv.close(); }
});

test('STARTTLS sans poignée de main : échec dans le délai', async () => {
  const socks: Socket[] = [];
  const srv = netServer((s) => {
    socks.push(s);
    s.write('220 plain\r\n');
    s.on('data', (d) => {
      const line = d.toString();
      if (line.startsWith('EHLO')) s.write('250-fake\r\n250 STARTTLS\r\n');
      else if (line.startsWith('STARTTLS')) s.write('220 go\r\n'); // puis silence
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  try {
    const m = createSmtpMailer({ host: 'localhost', port, user: 'u', pass: 'p', from: 'a@ex.ch' }, { tls: 'starttls', timeoutMs: 500 });
    const t0 = Date.now();
    await assert.rejects(m.send({ to: 'b@ex.ch', subject: 's', text: 't' }));
    assert.ok(Date.now() - t0 < 3000);
  } finally { socks.forEach((x) => x.destroy()); srv.close(); }
});
