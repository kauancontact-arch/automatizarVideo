import { CronJob } from 'cron';
import { db } from '@/lib/db';
import { fila, FILA_RUN } from '@/lib/fila';
import { executarRun } from '@/lib/engine/run';
import { lerGrafo } from '@/lib/engine/graph';
import { verificarPublicacoes } from './jobs/verify-publish';
import { sincronizarUso } from './jobs/usage-sync';
import { limparIntermediarios, limparRunsAntigos } from '@/lib/ffmpeg/limpeza';

const agendados = new Map<string, CronJob>();
let jaIniciou = false;

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
        await boss.send(FILA_RUN, { runId: run.id }, { retryLimit: 0 });
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

export async function iniciarWorker(): Promise<void> {
  if (jaIniciou) return;
  jaIniciou = true;

  console.log('[worker] iniciando');

  // Render de video enche disco rapido, e disco cheio aparece como ENOSPC em
  // qualquer lugar, nao no render. Limpa antes de aceitar trabalho.
  const intermediarios = await limparIntermediarios();
  const antigos = await limparRunsAntigos(48);
  if (intermediarios || antigos) {
    console.log(`[limpeza] ${intermediarios} intermediarios, ${antigos} pastas antigas`);
  }

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
  new CronJob('30 */6 * * *', async () => {
    const n = await limparRunsAntigos(48);
    if (n) console.log(`[limpeza] ${n} pastas antigas`);
  }, null, true);

  console.log('[worker] pronto');
}
