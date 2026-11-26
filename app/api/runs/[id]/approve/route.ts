import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enfileirarRun } from '@/lib/fila';
import type { Envelope } from '@/lib/engine/envelope';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { aprovado } = (await req.json()) as { aprovado: boolean };

  const run = await db.run.findUniqueOrThrow({ where: { id } });

  if (!aprovado) {
    await db.run.update({
      where: { id },
      data: { status: 'falhou', erro: 'roteiro rejeitado', terminadoEm: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  const envelope = (run.envelope as Envelope | null) ?? { meta: {}, cost: [] };
  envelope.meta.aprovado = true;

  await db.run.update({ where: { id }, data: { envelope: envelope as any, status: 'fila' } });
  await enfileirarRun(id, { retomar: true });

  return NextResponse.json({ ok: true }, { status: 202 });
}
