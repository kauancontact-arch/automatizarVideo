import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'av_sessao';

function assinar(valor: string): string {
  const segredo = process.env.APP_PASSWORD ?? '';
  return createHmac('sha256', segredo).update(valor).digest('hex');
}

export function conferirSenha(enviada: string): boolean {
  const esperada = process.env.APP_PASSWORD ?? '';
  const a = Buffer.from(assinar(enviada));
  const b = Buffer.from(assinar(esperada));
  return a.length === b.length && timingSafeEqual(a, b) && enviada === esperada;
}

export function valorDoCookie(): string {
  return assinar('autenticado');
}

export async function autenticado(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === valorDoCookie();
}

export const NOME_COOKIE = COOKIE;
