import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const flows = await db.flow.findMany({
    orderBy: { criadoEm: 'desc' },
    include: { _count: { select: { runs: true } } },
  });
  return NextResponse.json(flows);
}

export async function POST(req: Request) {
  const corpo = (await req.json()) as { nome?: string; graph?: unknown; clonarDe?: string };

  if (corpo.clonarDe) {
    const base = await db.flow.findUniqueOrThrow({ where: { id: corpo.clonarDe } });
    const novo = await db.flow.create({
      data: { nome: `${base.nome} (copia)`, graph: base.graph as any, ativo: false },
    });
    return NextResponse.json(novo, { status: 201 });
  }

  const novo = await db.flow.create({
    data: { nome: corpo.nome ?? 'Fluxo sem nome', graph: (corpo.graph ?? { nodes: [], edges: [] }) as any },
  });
  return NextResponse.json(novo, { status: 201 });
}
