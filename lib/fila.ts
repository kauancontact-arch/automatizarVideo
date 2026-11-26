import PgBoss from 'pg-boss';

export const FILA_RUN = 'executar-run';

let instancia: PgBoss | null = null;

/** pg-boss usa o proprio Postgres: evita um Redis so para enfileirar. */
export async function fila(): Promise<PgBoss> {
  if (instancia) return instancia;
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'fila',
  });
  boss.on('error', (e) => console.error('[fila]', e));
  await boss.start();
  // pg-boss v10 exige que a fila exista antes do primeiro send.
  await boss.createQueue(FILA_RUN).catch(() => {});
  instancia = boss;
  return boss;
}

export async function enfileirarRun(runId: string, opcoes: { retomar?: boolean } = {}): Promise<void> {
  const boss = await fila();
  // retryLimit 0: o retry e por no, dentro do motor, nao da fila.
  await boss.send(FILA_RUN, { runId, ...opcoes }, { retryLimit: 0 });
}
