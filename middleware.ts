import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'av_sessao';
const LIVRES = ['/login', '/api/auth', '/api/health', '/api/hooks'];

/** Mesmo HMAC que lib/auth.ts, escrito em Web Crypto para rodar no edge. */
async function esperado(): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.APP_PASSWORD ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode('autenticado'));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LIVRES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (req.cookies.get(COOKIE)?.value === (await esperado())) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'nao autenticado' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
