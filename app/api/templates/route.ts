import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get('tipo');
  const templates = await db.template.findMany({
    where: tipo ? { tipo: tipo as 'roteiro' | 'video' } : {},
    orderBy: { criadoEm: 'asc' },
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const corpo = (await req.json()) as {
    id?: string;
    nome: string;
    tipo: 'roteiro' | 'video';
    definicao: unknown;
  };

  const t = corpo.id
    ? await db.template.update({
        where: { id: corpo.id },
        data: { nome: corpo.nome, definicao: corpo.definicao as any },
      })
    : await db.template.create({
        data: { nome: corpo.nome, tipo: corpo.tipo, definicao: corpo.definicao as any },
      });

  return NextResponse.json(t, { status: corpo.id ? 200 : 201 });
}
