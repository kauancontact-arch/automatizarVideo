import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ_TRABALHO } from './paths';

const PASTA_RUNS = join(RAIZ_TRABALHO, 'runs');

/**
 * Os clipes por cena sao intermediarios: existem so durante a montagem e sao
 * regerados numa retomada. Sao tambem o que mais ocupa disco. Apagar os de
 * todas as pastas no boot e seguro, porque nenhum render esta em curso quando
 * o processo acaba de subir.
 */
export async function limparIntermediarios(): Promise<number> {
  let apagados = 0;

  let pastas: string[];
  try {
    pastas = await readdir(PASTA_RUNS);
  } catch {
    return 0;
  }

  for (const pasta of pastas) {
    const caminho = join(PASTA_RUNS, pasta);
    let arquivos: string[];
    try {
      arquivos = await readdir(caminho);
    } catch {
      continue;
    }

    for (const arquivo of arquivos) {
      const intermediario =
        /^clipe\d+\.mp4$/.test(arquivo) || arquivo === 'clipes.txt' || arquivo === 'final.txt';
      if (!intermediario) continue;

      try {
        await rm(join(caminho, arquivo));
        apagados++;
      } catch {
        // arquivo ja sumiu
      }
    }
  }

  return apagados;
}

/** Apaga a pasta inteira de runs antigos. */
export async function limparRunsAntigos(horas = 48): Promise<number> {
  const limite = Date.now() - horas * 3600_000;
  let apagadas = 0;

  let pastas: string[];
  try {
    pastas = await readdir(PASTA_RUNS);
  } catch {
    return 0;
  }

  for (const pasta of pastas) {
    const caminho = join(PASTA_RUNS, pasta);
    try {
      const info = await stat(caminho);
      if (info.mtimeMs < limite) {
        await rm(caminho, { recursive: true, force: true });
        apagadas++;
      }
    } catch {
      // ja sumiu
    }
  }

  return apagadas;
}

/** Depois de um render bem-sucedido, so o mp4 final precisa ficar. */
export async function limparDepoisDoRender(pasta: string): Promise<void> {
  let arquivos: string[];
  try {
    arquivos = await readdir(pasta);
  } catch {
    return;
  }

  for (const arquivo of arquivos) {
    if (/^clipe\d+\.mp4$/.test(arquivo) || arquivo === 'clipes.txt' || arquivo === 'final.txt') {
      await rm(join(pasta, arquivo)).catch(() => {});
    }
  }
}
