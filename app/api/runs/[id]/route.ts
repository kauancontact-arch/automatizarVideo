import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await db.run.findUnique({
    where: { id },
    include: { flow: { select: { nome: true } }, steps: { orderBy: { ordem: 'asc' } } },
  });
  if (!run) return NextResponse.json({ erro: 'run nao encontrado' }, { status: 404 });
  return NextResponse.json(run);
}
