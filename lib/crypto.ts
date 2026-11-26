import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifra credenciais gravadas no banco pela interface.
 * ENCRYPTION_KEY: 32 bytes em hex (openssl rand -hex 32).
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY ausente');
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY precisa ter 32 bytes em hex');
  return buf;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), dados.toString('base64')].join('.');
}

export function decifrar(guardado: string): string {
  const [iv, tag, dados] = guardado.split('.');
  if (!iv || !tag || !dados) throw new Error('valor cifrado malformado');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8');
}
