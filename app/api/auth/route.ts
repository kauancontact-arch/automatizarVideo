import { NextResponse } from 'next/server';
import { conferirSenha, valorDoCookie, NOME_COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  const { senha } = (await req.json()) as { senha?: string };

  if (!senha || !conferirSenha(senha)) {
    return NextResponse.json({ erro: 'senha incorreta' }, { status: 401 });
  }

  const r = NextResponse.json({ ok: true });
  r.cookies.set(NOME_COOKIE, valorDoCookie(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return r;
}
