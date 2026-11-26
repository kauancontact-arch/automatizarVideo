import { PASTA_FONTES } from './paths';

export type TemplateVideo = {
  nome: string;
  legenda: {
    fonte: string;
    tamanho: number;
    posicao: 'centro' | 'baixo' | 'alto';
    destaque: string;
    contorno: number;
    maiusculas: boolean;
    palavrasPorVez: number;
  };
  camera: { movimento: 'zoom-in' | 'zoom-out' | 'nenhum'; intensidade: number };
  corte: { tipo: 'seco' | 'fade'; segundosPorCena: number };
  audio: { trilha: string | null; db: number; ducking: boolean };
};

export type EntradaRender = {
  imagens: string[];
  duracoes: number[];
  audioPath: string;
  trilhaPath?: string;
  assPath: string;
  saidaPath: string;
  pasta: string;
  largura?: number;
  altura?: number;
  fps?: number;
};

export type PlanoRender = {
  /** Uma cena por vez: e isso que mantem a memoria baixa. */
  cenas: { args: string[]; saida: string; rotulo: string }[];
  listaPath: string;
  listaConteudo: string;
  finalArgs: string[];
  filtroFinal: string;
  filtroFinalPath: string;
  textoDoComando: string;
};

/**
 * Render em duas passadas.
 *
 * A primeira versao montava um filter_complex unico com um zoompan por cena,
 * todos vivos ao mesmo tempo. Com oito cenas a 1350x2400 o ffmpeg era morto
 * pelo cgroup sem escrever erro nenhum — morte silenciosa, que e a assinatura
 * de OOM e nao de falha de filtro.
 *
 * Agora cada cena vira um clipe curto, uma de cada vez, e a segunda passada
 * concatena sem re-escalar, aplica a legenda e mixa o audio. A memoria passa
 * a ser a de uma cena so, nao a de todas.
 */
/**
 * O x264 le a contagem de CPUs da maquina hospedeira, nao o limite do cgroup
 * do container. Num host de 60 nucleos ele abre 60 threads de codificacao e
 * 15 de lookahead, cada uma com seus buffers de quadro, e estoura a memoria
 * antes de codificar o primeiro quadro.
 *
 * Travar o numero de threads e o que resolve de fato a morte por OOM; a
 * resolucao quase nao importa perto disso.
 */
const THREADS = Math.max(1, Number(process.env.FFMPEG_THREADS ?? 2));

const LIMITE_THREADS = [
  '-threads', String(THREADS),
  '-filter_threads', String(THREADS),
  '-filter_complex_threads', String(THREADS),
];

const X264_PARAMS = `threads=${THREADS}:lookahead_threads=1:sliced_threads=0`;

export function montarPlano(e: EntradaRender, t: TemplateVideo): PlanoRender {
  const largura = e.largura ?? 1080;
  const altura = e.altura ?? 1920;
  const fps = e.fps ?? 30;

  // 1.15x em vez de 1.25x: espaco suficiente para o movimento de camera, com
  // bem menos pixel por quadro intermediario.
  const escalaW = Math.round(largura * 1.15);
  const escalaH = Math.round(altura * 1.15);

  const cenas = e.imagens.map((img, i) => {
    const dur = e.duracoes[i];
    const quadros = Math.max(1, Math.round(dur * fps));

    // d=1 e obrigatorio aqui. O zoompan emite d quadros PARA CADA quadro de
    // entrada: com -loop e d=quadros, uma cena de 5s virava 20 mil quadros,
    // ou seja 12 minutos de video. Com -framerate na entrada e d=1, cada
    // quadro de entrada sai uma vez e o total bate exatamente com a duracao.
    //
    // O zoom e dirigido por on, o indice do quadro de saida, e x/y mantem o
    // enquadramento no centro — sem eles o zoompan puxa para o canto superior
    // esquerdo, que e o visual errado.
    const passo = (t.camera.intensidade / quadros).toFixed(8);
    const teto = (1 + t.camera.intensidade).toFixed(3);
    const centro = `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;

    const mov =
      t.camera.movimento === 'nenhum'
        ? `scale=${largura}:${altura}`
        : t.camera.movimento === 'zoom-in'
          ? `zoompan=z='min(1+${passo}*on,${teto})':${centro}:d=1:s=${largura}x${altura}:fps=${fps}`
          : `zoompan=z='max(${teto}-${passo}*on,1)':${centro}:d=1:s=${largura}x${altura}:fps=${fps}`;

    const saida = `${e.pasta}/clipe${i + 1}.mp4`;

    return {
      rotulo: `cena ${i + 1}/${e.imagens.length}`,
      saida,
      args: [
        '-y',
        ...LIMITE_THREADS,
        '-loop', '1',
        // Sem -framerate a entrada roda a 25 fps e o total de quadros nao
        // bate com o fps de saida.
        '-framerate', String(fps),
        '-t', dur.toFixed(3),
        '-i', img,
        '-vf',
        `scale=${escalaW}:${escalaH}:force_original_aspect_ratio=increase,crop=${escalaW}:${escalaH},setsar=1,${mov},format=yuv420p`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-x264-params', X264_PARAMS,
        '-r', String(fps),
        // Teto rigido: se alguma conta acima escapar, o clipe ainda para aqui.
        '-frames:v', String(quadros),
        '-an',
        saida,
      ],
    };
  });

  const listaPath = `${e.pasta}/clipes.txt`;
  const listaConteudo = cenas.map((c) => `file '${c.saida}'`).join('\n');

  const assEscapado = e.assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const fontesEscapado = PASTA_FONTES.replace(/\\/g, '/').replace(/:/g, '\\:');

  const partes = [`[0:v]subtitles='${assEscapado}':fontsdir='${fontesEscapado}'[vt]`];

  const temTrilha = Boolean(e.trilhaPath);
  if (temTrilha) {
    partes.push(`[2:a]volume=${t.audio.db}dB[bg]`);
    partes.push(
      t.audio.ducking
        ? `[1:a][bg]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[mix]`
        : `[1:a][bg]amix=inputs=2:duration=first:dropout_transition=0[mix]`,
    );
  }

  const total = e.duracoes.reduce((s, d) => s + d, 0);
  const filtroFinalPath = `${e.pasta}/final.txt`;

  const finalArgs = [
    '-y',
    ...LIMITE_THREADS,
    '-f', 'concat',
    '-safe', '0',
    '-i', listaPath,
    '-i', e.audioPath,
    ...(e.trilhaPath ? ['-i', e.trilhaPath] : []),
    '-filter_complex_script', filtroFinalPath,
    '-map', '[vt]',
    '-map', temTrilha ? '[mix]' : '1:a',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '21',
    '-x264-params', X264_PARAMS,
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-t', total.toFixed(2),
    e.saidaPath,
  ];

  const filtroFinal = partes.join(';\n');

  const textoDoComando = [
    `--- ${THREADS} threads por processo (x264 ignora o limite do cgroup) ---`,
    '--- passada 1: uma cena por vez ---',
    ...cenas.map((c) => `ffmpeg ${c.args.join(' ')}`),
    '',
    '--- lista de concatenacao ---',
    listaConteudo,
    '',
    '--- passada 2: concat + legenda + audio ---',
    `ffmpeg ${finalArgs.join(' ')}`,
    '',
    '--- filtro da passada 2 ---',
    filtroFinal,
  ].join('\n');

  return { cenas, listaPath, listaConteudo, finalArgs, filtroFinal, filtroFinalPath, textoDoComando };
}
