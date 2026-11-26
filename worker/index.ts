import { CronJob } from 'cron';
import { db } from '@/lib/db';
import { fila, FILA_RUN } from '@/lib/fila';
import { executarRun } from '@/lib/engine/run';
import { lerGrafo } from '@/lib/engine/graph';
import { verificarPublicacoes } from './jobs/verify-publish';
import { sincronizarUso } from './jobs/usage-sync';

const agendados = new Map<string, CronJob>();

async function recarregarAgendamentos(): Promise<void> {
  const flows = await db.flow.findMany({ where: { ativo: true } });
  const vistos = new Set<string>();

  for (const flow of flows) {
    let grafo;
    try {
      grafo = lerGrafo(flow.graph);
    } catch {
      continue;
    }

    const gatilho = grafo.nodes.find((n) => n.type === 'trigger.schedule');
    if (!gatilho) continue;

    const cron = (gatilho.config as any)?.cron as string | undefined;
    const tz = ((gatilho.config as any)?.tz as string) ?? process.env.TZ ?? 'America/Sao_Paulo';
    if (!cron) continue;

    const chave = `${flow.id}:${cron}:${tz}`;
    vistos.add(chave);
    if (agendados.has(chave)) continue;

    // Troca de horario: para o antigo antes de criar o novo.
    for (const [k, job] of agendados) {
      if (k.startsWith(`${flow.id}:`)) {
        job.stop();
        agendados.delete(k);
      }
    }

    const job = new CronJob(
      cron,
      async () => {
        const run = await db.run.create({ data: { flowId: flow.id } });
        const boss = await fila();
        await boss.send(FILA_RUN, { runId: run.id });
        console.log(`[cron] fluxo ${flow.nome} disparou run ${run.id}`);
      },
      null,
      true,
      tz,
    );

    agendados.set(chave, job);
    console.log(`[cron] ${flow.nome}: ${cron} (${tz})`);
  }

  for (const [chave, job] of agendados) {
    if (!vistos.has(chave)) {
      job.stop();
      agendados.delete(chave);
    }
  }
}

async function principal(): Promise<void> {
  console.log('[worker] iniciando');
  const boss = await fila();

  await boss.work<{ runId: string; retomar?: boolean }>(FILA_RUN, { batchSize: 1 }, async ([job]) => {
    const { runId, retomar } = job.data;
    console.log(`[worker] run ${runId}${retomar ? ' (retomada)' : ''}`);
    await executarRun(runId, { retomar });
  });

  await recarregarAgendamentos();

  // Recarrega os horarios quando um fluxo muda, sem reiniciar o processo.
  new CronJob('*/2 * * * *', recarregarAgendamentos, null, true);
  new CronJob('*/5 * * * *', verificarPublicacoes, null, true);
  new CronJob('0 * * * *', sincronizarUso, null, true);

  console.log('[worker] pronto');
}

principal().catch((e) => {
  console.error('[worker] falhou ao iniciar:', e);
  process.exit(1);
});
