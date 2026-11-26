import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enfileirarRun } from '@/lib/fila';

/** Reenfileira a partir do no que falhou: o que ja foi pago nao e refeito. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.run.update({ where: { id }, data: { status: 'fila', erro: null, terminadoEm: null } });
  await enfileirarRun(id, { retomar: true });
  return NextResponse.json({ ok: true }, { status: 202 });
}
