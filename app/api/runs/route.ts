import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma, RunStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const status = u.searchParams.get('status');
  const desde = u.searchParams.get('desde');

  const where: Prisma.RunWhereInput = {
    ...(status ? { status: status as RunStatus } : {}),
    ...(desde ? { iniciadoEm: { gte: new Date(desde) } } : {}),
  };

  const runs = await db.run.findMany({
    where,
    orderBy: { iniciadoEm: 'desc' },
    take: Number(u.searchParams.get('limite') ?? 100),
    include: { flow: { select: { nome: true } } },
  });

  return NextResponse.json(runs);
}
