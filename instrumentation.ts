/**
 * Modo combinado: com WORKER_IN_PROCESS=true, o mesmo servico que serve a
 * interface tambem consome a fila e roda o cron. Cabe em um slot so.
 *
 * O custo dessa economia: um render pesado ocupa a CPU do processo que serve
 * as telas. Para dois videos por dia e aceitavel; passando disso, separe o
 * worker num servico proprio.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.WORKER_IN_PROCESS !== 'true') return;

  const { iniciarWorker } = await import('./worker/boot');
  await iniciarWorker();
}
