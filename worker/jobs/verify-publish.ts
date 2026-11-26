import { db } from '@/lib/db';
import { getStatus } from '@/lib/providers/buffer';

/**
 * Agendar devolve sucesso do agendamento, nao da publicacao: o post pode
 * falhar horas depois por token expirado ou video fora das especificacoes.
 * Este job fecha o run como publicado ou falho.
 */
export async function verificarPublicacoes(): Promise<void> {
  const limite = new Date(Date.now() - 10 * 60 * 1000);

  const runs = await db.run.findMany({
    where: { status: 'agendado', terminadoEm: { lte: limite } },
    take: 50,
  });

  for (const run of runs) {
    const envelope = run.envelope as { meta?: { postIds?: string[] } } | null;
    const postIds = envelope?.meta?.postIds ?? [];
    if (!postIds.length) continue;

    try {
      const estados = await Promise.all(postIds.map((id) => getStatus(id)));

      if (estados.some((e) => e.estado === 'pendente')) continue;

      const falhas = estados.filter((e) => e.estado === 'falhou');

      await db.run.update({
        where: { id: run.id },
        data: falhas.length
          ? { status: 'falhou', erro: `publicacao falhou: ${falhas.map((f) => f.erro).join('; ')}` }
          : { status: 'publicado', publicadoEm: new Date() },
      });
    } catch (e) {
      console.error(`[verify-publish] run ${run.id}:`, e);
    }
  }
}
