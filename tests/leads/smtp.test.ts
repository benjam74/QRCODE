import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { createSmtpMailer, buildMime, encodeHeader } from '../../src/leads/smtp.ts';

type Session = { commands: string[]; data: string };

function fakeSmtp(opts: { authCode?: string } = {}): Promise<{ port: number; sessions: Session[]; close: () => void }> {
  const sessions: Session[] = [];
  const server = createServer((sock: Socket) => {
    const s: Session = { commands: [], data: '' };
    sessions.push(s);
    let buf = '';
    let inData = false;
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      while (true) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          s.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          sock.write('250 OK queued\r\n');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        s.commands.push(line);
        const cmd = line.split(' ')[0].toUpperCase();
        if (cmd === 'EHLO') sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd === 'AUTH') sock.write(opts.authCode ?? '235 OK\r\n');
        else if (cmd === 'MAIL' || cmd === 'RCPT') sock.write('250 OK\r\n');
        else if (cmd === 'DATA') { sock.write('354 go\r\n'); inData = true; }
        else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('500 ?\r\n');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as { port: number }).port;
    resolve({ port, sessions, close: () => server.close() });
  }));
}

const cfg = (port: number) => ({ host: '127.0.0.1', port, user: 'carte@ex.ch', pass: 'sécret', from: 'Carte QR <carte@ex.ch>' });

test('envoi complet : AUTH PLAIN, enveloppe, sujet encodé, corps base64', async () => {
  const srv = await fakeSmtp();
  try {
    const mailer = createSmtpMailer(cfg(srv.port), { tls: 'none' });
    await mailer.send({ to: 'benjamin@ex.ch', subject: 'Nouveau contact : Anne Müller', text: 'Ligne 1\n.\nLigne é' });
    const s = srv.sessions[0];
    assert.ok(s.commands[0].startsWith('EHLO '));
    const auth = s.commands.find((c) => c.startsWith('AUTH PLAIN '))!;
    assert.equal(Buffer.from(auth.slice(11), 'base64').toString('utf8'), '\0carte@ex.ch\0sécret');
    assert.ok(s.commands.includes('MAIL FROM:<carte@ex.ch>'));
    assert.ok(s.commands.includes('RCPT TO:<benjamin@ex.ch>'));
    assert.ok(s.commands.includes('QUIT'));
    assert.ok(s.data.includes(`Subject: ${encodeHeader('Nouveau contact : Anne Müller')}`));
    const body = s.data.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    assert.equal(Buffer.from(body, 'base64').toString('utf8'), 'Ligne 1\r\n.\r\nLigne é');
  } finally { srv.close(); }
});

test('authentification refusée : erreur explicite', async () => {
  const srv = await fakeSmtp({ authCode: '535 bad credentials\r\n' });
  try {
    const mailer = createSmtpMailer(cfg(srv.port), { tls: 'none' });
    await assert.rejects(mailer.send({ to: 'b@ex.ch', subject: 's', text: 't' }), /535/);
  } finally { srv.close(); }
});

test('serveur injoignable : erreur', async () => {
  const mailer = createSmtpMailer(cfg(1), { tls: 'none', timeoutMs: 2000 });
  await assert.rejects(mailer.send({ to: 'b@ex.ch', subject: 's', text: 't' }));
});

test('en-têtes ASCII laissés tels quels, non ASCII encodés', () => {
  assert.equal(encodeHeader('Hello'), 'Hello');
  assert.equal(encodeHeader('é'), '=?UTF-8?B?w6k=?=');
});

test('MIME : From avec nom accentué, multipart si html', () => {
  const m = buildMime({ from: 'Benjamin Vallée <b@ex.ch>', to: 'x@ex.ch', subject: 'S', text: 't', html: '<p>t</p>', date: new Date('2026-10-19T08:00:00Z'), messageId: '<1@ex.ch>' });
  assert.ok(m.includes(`From: ${encodeHeader('Benjamin Vallée')} <b@ex.ch>`));
  assert.ok(m.includes('Content-Type: multipart/alternative; boundary='));
  assert.ok(m.includes('Date: Mon, 19 Oct 2026 08:00:00 +0000'));
  for (const line of m.split('\r\n')) assert.ok(line.length <= 998);
});
