import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signRequest, createS3Store } from '../../src/backup/s3.ts';

test('signature v4 : vecteur officiel AWS (GET Object)', () => {
  const headers = signRequest({
    method: 'GET', url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'), region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    headers: { range: 'bytes=0-9' }, payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    date: new Date('2013-05-24T00:00:00Z'),
  });
  assert.equal(headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
});

const cfg = { endpoint: 'https://s3.example.test', region: 'us-east-1', bucket: 'sauvegardes', accessKeyId: 'AK', secretAccessKey: 'SK' };

test('put, list (pagination), delete : URLs en path-style', async () => {
  const calls: { method: string; url: string; headers: Headers }[] = [];
  const f = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push({ method: init?.method ?? 'GET', url, headers: new Headers(init?.headers) });
    if (url.includes('list-type=2') && !url.includes('continuation-token')) {
      return new Response('<ListBucketResult><Contents><Key>backups/2026-10-01/carte.db</Key></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>abc/=</NextContinuationToken></ListBucketResult>');
    }
    if (url.includes('continuation-token')) return new Response('<ListBucketResult><Contents><Key>backups/2026-10-02/media.tar.gz</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>');
    return method(init) === 'DELETE' ? new Response(null, { status: 204 }) : new Response('', { status: 200 });
  }) as typeof fetch;
  const method = (i?: RequestInit) => i?.method ?? 'GET';
  const store = createS3Store(cfg, f);
  await store.put('backups/2026-10-19/carte.db', Buffer.from('x'));
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].url, 'https://s3.example.test/sauvegardes/backups/2026-10-19/carte.db');
  assert.match(calls[0].headers.get('authorization') ?? '', /^AWS4-HMAC-SHA256 Credential=AK\//);
  assert.equal(calls[0].headers.get('x-amz-content-sha256'), '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');
  assert.deepEqual(await store.list('backups/'), ['backups/2026-10-01/carte.db', 'backups/2026-10-02/media.tar.gz']);
  assert.ok(calls[2].url.includes('continuation-token=abc%2F%3D'));
  await store.delete('backups/2026-10-01/carte.db');
  assert.equal(calls[3].method, 'DELETE');
});

test('erreur HTTP remontée', async () => {
  const f = (async () => new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 })) as typeof fetch;
  await assert.rejects(createS3Store(cfg, f).put('k', Buffer.from('x')), /403/);
});
