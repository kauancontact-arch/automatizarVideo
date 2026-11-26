import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enfileirarRun } from '@/lib/fila';
import { podeGastar } from '@/lib/engine/cost';

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const veredito = await podeGastar();
  if (!veredito.pode) return NextResponse.json({ erro: veredito.motivo }, { status: 409 });

  const run = await db.run.create({ data: { flowId: id } });
  await enfileirarRun(run.id);
  return NextResponse.json(run, { status: 201 });
}
