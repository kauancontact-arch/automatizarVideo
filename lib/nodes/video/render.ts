import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '@/lib/db';
import { montarAss } from '@/lib/ffmpeg/ass';
import { montarPlano, type TemplateVideo } from '@/lib/ffmpeg/build';
import { conferir, sondar } from '@/lib/ffmpeg/probe';
import { pastaDoRun } from '@/lib/ffmpeg/paths';
import { subir } from '@/lib/providers/storage';
import type { DefinicaoNo } from '@/lib/engine/registry';

const run = promisify(execFile);

const schema = z.object({
  templateId: z.string().optional(),
  resolucao: z.enum(['1080x1920', '720x1280']).default('1080x1920'),
  fps: z.number().int().min(24).max(60).default(30),
  trilha: z.string().nullable().default(null),
});

type Config = z.infer<typeof schema>;

const PADRAO: TemplateVideo = {
  nome: 'Legenda amarela centro',
  legenda: {
    fonte: 'Anton',
    tamanho: 86,
    posicao: 'centro',
    destaque: '#FFD400',
    contorno: 6,
    maiusculas: true,
    palavrasPorVez: 3,
  },
  camera: { movimento: 'zoom-in', intensidade: 0.12 },
  corte: { tipo: 'seco', segundosPorCena: 3.5 },
  audio: { trilha: null, db: -18, ducking: true },
};

const no: DefinicaoNo<Config> = {
  type: 'video.render',
  rotulo: 'Renderizar video',
  schema,

  async run({ envelope, config, runId, log }) {
    const imagens = envelope.assets?.images ?? [];
    const audioPath = envelope.assets?.audioPath;
    const captions = envelope.assets?.captions ?? [];
    const cenas = envelope.script?.scenes ?? [];

    if (!imagens.length) throw new Error('nao ha imagens para renderizar');
    if (!audioPath) throw new Error('nao ha narracao para renderizar');

    const template = config.templateId
      ? ((await db.template.findUnique({ where: { id: config.templateId } }))?.definicao as TemplateVideo | undefined)
      : undefined;

    const t = { ...PADRAO, ...(template ?? {}) };

    const pasta = pastaDoRun(runId);
    await mkdir(pasta, { recursive: true });

    // A duracao de cada cena sai do audio real, nao da estimativa do roteiro:
    // e o que mantem imagem e narracao em sincronia.
    const duracaoAudio = captions.length ? captions.at(-1)!.fim : cenas.reduce((s, c) => s + c.segundos, 0);
    const duracoes = distribuir(duracaoAudio, imagens.length, cenas.map((c) => c.segundos));

    const assPath = join(pasta, 'legenda.ass');
    await writeFile(assPath, montarAss(captions, t.legenda, ...dimensoes(config.resolucao)), 'utf8');

    const saidaPath = join(pasta, 'saida.mp4');
    const [largura, altura] = dimensoes(config.resolucao);

    const plano = montarPlano(
      {
        imagens,
        duracoes,
        audioPath,
        trilhaPath: config.trilha ?? undefined,
        assPath,
        saidaPath,
        pasta,
        largura,
        altura,
        fps: config.fps,
      },
      t,
    );

    log(`renderizando ${imagens.length} cenas, ${duracaoAudio.toFixed(1)}s`);
    const comecou = Date.now();

    // Passada 1: um clipe por cena, sequencial. Oito zoompan ao mesmo tempo
    // estouravam a memoria do container e o ffmpeg morria sem escrever erro.
    for (const cena of plano.cenas) {
      await rodarFfmpeg(cena.args, cena.rotulo);
      log(`${cena.rotulo} pronta`);
    }

    // Passada 2: concatena sem re-escalar, queima a legenda e mixa o audio.
    await writeFile(plano.listaPath, plano.listaConteudo, 'utf8');
    await writeFile(plano.filtroFinalPath, plano.filtroFinal, 'utf8');
    await rodarFfmpeg(plano.finalArgs, 'montagem final');

    const segundosCpu = (Date.now() - comecou) / 1000;
    log(`render em ${segundosCpu.toFixed(0)}s`);

    const sonda = await sondar(saidaPath);
    const problemas = conferir(sonda, {
      larguraEsperada: largura,
      alturaEsperada: altura,
      duracaoAudio,
      bytesMax: 280 * 1024 * 1024,
    });

    if (problemas.length) throw new Error(`video reprovado na validacao: ${problemas.join('; ')}`);

    const url = await subir(saidaPath, `videos/${runId}.mp4`, 'video/mp4');

    return {
      envelope: {
        ...envelope,
        video: { url, path: saidaPath, duracao: sonda.duracao, formato: config.resolucao },
        meta: { ...envelope.meta, templateVideoId: config.templateId },
      },
      uso: { provider: 'railway', unidade: 'segundos', quantidade: segundosCpu, modelo: 'render' } as any,
      comando: plano.textoDoComando,
    };
  },
};

/**
 * O ffmpeg morto por falta de memoria sai sem escrever erro nenhum: o stderr
 * para no meio e o sinal e SIGKILL. Sem traduzir isso, o erro que chega na
 * interface nao diz nada.
 */
async function rodarFfmpeg(args: string[], rotulo: string): Promise<void> {
  try {
    await run('ffmpeg', args, { maxBuffer: 1024 * 1024 * 64 });
  } catch (e) {
    const erro = e as { stderr?: string; signal?: string; code?: number };
    const stderr = String(erro.stderr ?? '');
    const fim = stderr.trim().split('\n').slice(-12).join('\n');

    if (erro.signal === 'SIGKILL' || erro.code === 137) {
      throw new Error(
        `${rotulo}: o ffmpeg foi morto pelo sistema, quase sempre falta de memoria. ` +
          `Baixe FFMPEG_THREADS (esta em ${process.env.FFMPEG_THREADS ?? 2}), ` +
          `reduza a resolucao para 720x1280 no no de render, ou de mais RAM ao servico.\n${fim}`,
      );
    }

    throw new Error(`${rotulo}: ffmpeg falhou (sinal ${erro.signal ?? 'nenhum'}, codigo ${erro.code ?? '?'})\n${fim}`);
  }
}

function dimensoes(r: Config['resolucao']): [number, number] {
  const [w, h] = r.split('x').map(Number);
  return [w, h];
}

/** Reparte a duracao real do audio entre as imagens, na proporcao do roteiro. */
function distribuir(total: number, quantas: number, pesos: number[]): number[] {
  const base = pesos.length === quantas && pesos.every((p) => p > 0) ? pesos : Array(quantas).fill(1);
  const soma = base.reduce((s, p) => s + p, 0);
  return base.map((p) => (p / soma) * total);
}

export default no;
