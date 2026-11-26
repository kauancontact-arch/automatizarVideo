import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listChannels } from '@/lib/providers/buffer';

export async function GET() {
  try {
    const canais = await listChannels();

    for (const c of canais) {
      await db.channel.upsert({
        where: { bufferId: c.id },
        create: { bufferId: c.id, rede: c.rede, nome: c.nome },
        update: { rede: c.rede, nome: c.nome, ativo: true },
      });
    }

    return NextResponse.json({ sincronizados: canais.length, canais });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'falhou' }, { status: 502 });
  }
}
