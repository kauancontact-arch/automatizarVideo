import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pedir } from './http';

/**
 * Storage S3 compativel (bucket do Railway, R2, MinIO), assinado na mao para
 * nao arrastar o SDK inteiro por duas chamadas.
 *
 * Dois detalhes que o bucket do Railway impoe:
 *  - virtual-host style: o bucket vai no HOST, nao no caminho.
 *  - bucket privado: o Buffer busca o video por URL, entao a publicacao usa
 *    uma URL assinada, em vez de exigir um bucket publico.
 *
 * Sem STORAGE_BUCKET configurado, devolve o caminho local — util para rodar o
 * pipeline antes de existir bucket.
 */
const SERVICO = 's3';
const ALGO = 'AWS4-HMAC-SHA256';

function config() {
  return {
    endpoint: process.env.STORAGE_ENDPOINT?.replace(/\/$/, '') ?? '',
    bucket: process.env.STORAGE_BUCKET ?? '',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? '',
    secretKey: process.env.STORAGE_SECRET_KEY ?? '',
    regiao: process.env.STORAGE_REGION || 'auto',
  };
}

export function storageConfigurado(): boolean {
  const c = config();
  return Boolean(c.endpoint && c.bucket && c.accessKey && c.secretKey);
}

/** Virtual-host: https://<bucket>.<host>/<chave> */
function urlDoObjeto(chave: string): URL {
  const c = config();
  const host = new URL(c.endpoint).host;
  return new URL(`https://${c.bucket}.${host}/${chave.split('/').map(encodeURIComponent).join('/')}`);
}

function hmac(chave: Buffer | string, dado: string): Buffer {
  return createHmac('sha256', chave).update(dado, 'utf8').digest();
}

function sha256(dado: Buffer | string): string {
  return createHash('sha256').update(dado).digest('hex');
}

function chaveDeAssinatura(secretKey: string, dataCurta: string, regiao: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dataCurta), regiao), SERVICO), 'aws4_request');
}

function agora() {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dataCurta: amzDate.slice(0, 8) };
}

export async function subir(caminhoLocal: string, chaveDestino: string, contentType: string): Promise<string> {
  if (!storageConfigurado()) return `file://${caminhoLocal}`;

  const c = config();
  const corpo = await readFile(caminhoLocal);
  const url = urlDoObjeto(chaveDestino);
  const { amzDate, dataCurta } = agora();
  const hashCorpo = sha256(corpo);

  const headersAssinados = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = [
    'PUT',
    url.pathname,
    '',
    `host:${url.host}`,
    `x-amz-content-sha256:${hashCorpo}`,
    `x-amz-date:${amzDate}`,
    '',
    headersAssinados,
    hashCorpo,
  ].join('\n');

  const escopo = `${dataCurta}/${c.regiao}/${SERVICO}/aws4_request`;
  const paraAssinar = [ALGO, amzDate, escopo, sha256(canonical)].join('\n');
  const assinatura = createHmac('sha256', chaveDeAssinatura(c.secretKey, dataCurta, c.regiao))
    .update(paraAssinar, 'utf8')
    .digest('hex');

  await pedir(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `${ALGO} Credential=${c.accessKey}/${escopo}, SignedHeaders=${headersAssinados}, Signature=${assinatura}`,
      'x-amz-content-sha256': hashCorpo,
      'x-amz-date': amzDate,
      'Content-Type': contentType,
      'Content-Length': String(corpo.length),
    },
    body: new Uint8Array(corpo),
    timeoutMs: 300_000,
  });

  return chaveDestino;
}

/**
 * URL de leitura temporaria. O Buffer precisa alcancar o video sem
 * credenciais, e um bucket publico seria pior: qualquer um com a URL do
 * padrao poderia varrer o bucket inteiro.
 * Maximo do SigV4: 7 dias.
 */
export function urlAssinada(chave: string, segundos = 7 * 24 * 3600): string {
  if (!storageConfigurado()) return `file://${chave}`;

  const c = config();
  const url = urlDoObjeto(chave);
  const { amzDate, dataCurta } = agora();
  const escopo = `${dataCurta}/${c.regiao}/${SERVICO}/aws4_request`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm': ALGO,
    'X-Amz-Credential': `${c.accessKey}/${escopo}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.min(segundos, 7 * 24 * 3600)),
    'X-Amz-SignedHeaders': 'host',
  });

  // A query canonica precisa estar ordenada por nome do parametro.
  const queryCanonica = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonical = [
    'GET',
    url.pathname,
    queryCanonica,
    `host:${url.host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const paraAssinar = [ALGO, amzDate, escopo, sha256(canonical)].join('\n');
  const assinatura = createHmac('sha256', chaveDeAssinatura(c.secretKey, dataCurta, c.regiao))
    .update(paraAssinar, 'utf8')
    .digest('hex');

  return `${url.origin}${url.pathname}?${queryCanonica}&X-Amz-Signature=${assinatura}`;
}
