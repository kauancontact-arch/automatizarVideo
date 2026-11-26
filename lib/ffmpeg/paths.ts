import { join } from 'node:path';

export const RAIZ_TRABALHO = process.env.WORK_DIR ?? '/data';

export function pastaDoRun(runId: string): string {
  return join(RAIZ_TRABALHO, 'runs', runId);
}

export const PASTA_FONTES = join(process.cwd(), 'assets', 'fonts');
