import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const canais = await db.channel.findMany({ where: { ativo: true }, orderBy: { rede: 'asc' } });
  return NextResponse.json(canais);
}
