import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lerGrafo, ordenar } from '@/lib/engine/graph';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const flow = await db.flow.findUnique({ where: { id } });
  if (!flow) return NextResponse.json({ erro: 'fluxo nao encontrado' }, { status: 404 });
  return NextResponse.json(flow);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const corpo = (await req.json()) as { nome?: string; graph?: unknown; ativo?: boolean };

  // Ciclo no grafo e erro de montagem: falha aqui, nao no meio de um run.
  if (corpo.graph) {
    try {
      ordenar(lerGrafo(corpo.graph));
    } catch (e) {
      return NextResponse.json({ erro: e instanceof Error ? e.message : 'grafo invalido' }, { status: 400 });
    }
  }

  const flow = await db.flow.update({
    where: { id },
    data: {
      ...(corpo.nome !== undefined ? { nome: corpo.nome } : {}),
      ...(corpo.graph !== undefined ? { graph: corpo.graph as any } : {}),
      ...(corpo.ativo !== undefined ? { ativo: corpo.ativo } : {}),
    },
  });
  return NextResponse.json(flow);
}
