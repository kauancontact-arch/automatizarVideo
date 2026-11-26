import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enfileirarRun } from '@/lib/fila';

/** Gatilho externo. Autenticado pelo segredo do fluxo, nao pelo cookie. */
export async function POST(req: Request, ctx: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await ctx.params;
  const segredo = new URL(req.url).searchParams.get('segredo');

  const flow = await db.flow.findUnique({ where: { id: flowId } });
  if (!flow || flow.segredo !== segredo) {
    return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });
  }
  if (!flow.ativo) return NextResponse.json({ erro: 'fluxo inativo' }, { status: 409 });

  const corpo = await req.json().catch(() => ({}));
  const run = await db.run.create({ data: { flowId, envelope: { meta: corpo, cost: [] } as any } });
  await enfileirarRun(run.id);

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
