import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pedir } from './http';

/**
 * S3 compativel (bucket do Railway, R2, MinIO). Assinatura V4 na mao para
 * nao arrastar o SDK inteiro por tres chamadas.
 * Sem STORAGE_BUCKET configurado, grava em /data e devolve caminho local —
 * util para rodar o pipeline antes do bucket existir.
 */
const REGIAO = 'auto';
const SERVICO = 's3';

function configurado(): boolean {
  return Boolean(process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_ENDPOINT);
}

function hmac(chave: Buffer | string, dado: string): Buffer {
  return createHmac('sha256', chave).update(dado, 'utf8').digest();
}

function sha256(dado: Buffer | string): string {
  return createHash('sha256').update(dado).digest('hex');
}

export async function subir(caminhoLocal: string, chaveDestino: string, contentType: string): Promise<string> {
  const corpo = await readFile(caminhoLocal);

  if (!configurado()) return `file://${caminhoLocal}`;

  const endpoint = process.env.STORAGE_ENDPOINT!.replace(/\/$/, '');
  const bucket = process.env.STORAGE_BUCKET!;
  const accessKey = process.env.STORAGE_ACCESS_KEY!;
  const secretKey = process.env.STORAGE_SECRET_KEY!;

  const url = new URL(`${endpoint}/${bucket}/${chaveDestino}`);
  const agora = new Date();
  const amzDate = agora.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dataCurta = amzDate.slice(0, 8);
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

  const escopo = `${dataCurta}/${REGIAO}/${SERVICO}/aws4_request`;
  const paraAssinar = ['AWS4-HMAC-SHA256', amzDate, escopo, sha256(canonical)].join('\n');

  const chaveAssinatura = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dataCurta), REGIAO), SERVICO), 'aws4_request');
  const assinatura = createHmac('sha256', chaveAssinatura).update(paraAssinar, 'utf8').digest('hex');

  await pedir(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${escopo}, SignedHeaders=${headersAssinados}, Signature=${assinatura}`,
      'x-amz-content-sha256': hashCorpo,
      'x-amz-date': amzDate,
      'Content-Type': contentType,
      'Content-Length': String(corpo.length),
    },
    body: new Uint8Array(corpo),
    timeoutMs: 300_000,
  });

  const publico = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, '');
  return publico ? `${publico}/${chaveDestino}` : url.toString();
}
