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
  largura?: number;
  altura?: number;
  fps?: number;
};

export type ComandoRender = { args: string[]; filtro: string; textoDoComando: string };

/**
 * Monta o grafo de filtros e os argumentos. O grafo vai num arquivo via
 * -filter_complex_script: inline ele estoura o limite de argumento do shell
 * com seis cenas e vira impossivel de depurar.
 */
export function montarComando(e: EntradaRender, t: TemplateVideo): ComandoRender {
  const largura = e.largura ?? 1080;
  const altura = e.altura ?? 1920;
  const fps = e.fps ?? 30;

  // Escala intermediaria maior que a saida: e o espaco que o zoompan percorre.
  const escalaW = Math.round(largura * 1.25);
  const escalaH = Math.round(altura * 1.25);

  const args: string[] = ['-y'];

  for (const [i, img] of e.imagens.entries()) {
    args.push('-loop', '1', '-t', e.duracoes[i].toFixed(2), '-i', img);
  }

  const idxAudio = e.imagens.length;
  args.push('-i', e.audioPath);

  const temTrilha = Boolean(e.trilhaPath);
  const idxTrilha = idxAudio + 1;
  if (e.trilhaPath) args.push('-i', e.trilhaPath);

  const partes: string[] = [];

  for (const [i, dur] of e.duracoes.entries()) {
    // d do zoompan e em QUADROS, nao em segundos. Errar isso e a causa mais
    // comum de video que acaba antes do audio.
    const quadros = Math.max(1, Math.round(dur * fps));
    const mov =
      t.camera.movimento === 'nenhum'
        ? `scale=${largura}:${altura}`
        : t.camera.movimento === 'zoom-in'
          ? `zoompan=z='min(zoom+${(t.camera.intensidade / quadros).toFixed(6)},${(1 + t.camera.intensidade).toFixed(3)})':d=${quadros}:s=${largura}x${altura}:fps=${fps}`
          : `zoompan=z='max(${(1 + t.camera.intensidade).toFixed(3)}-on*${(t.camera.intensidade / quadros).toFixed(6)},1)':d=${quadros}:s=${largura}x${altura}:fps=${fps}`;

    partes.push(
      `[${i}:v]scale=${escalaW}:${escalaH}:force_original_aspect_ratio=increase,crop=${escalaW}:${escalaH},setsar=1,${mov}[v${i}]`,
    );
  }

  const rotulos = e.imagens.map((_, i) => `[v${i}]`).join('');
  partes.push(`${rotulos}concat=n=${e.imagens.length}:v=1:a=0[vc]`);

  const assEscapado = e.assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const fontesEscapado = PASTA_FONTES.replace(/\\/g, '/').replace(/:/g, '\\:');
  partes.push(`[vc]subtitles='${assEscapado}':fontsdir='${fontesEscapado}'[vt]`);

  if (temTrilha) {
    partes.push(`[${idxTrilha}:a]volume=${t.audio.db}dB[bg]`);
    partes.push(
      t.audio.ducking
        ? `[${idxAudio}:a][bg]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[mix]`
        : `[${idxAudio}:a][bg]amix=inputs=2:duration=first:dropout_transition=0[mix]`,
    );
  }

  const total = e.duracoes.reduce((s, d) => s + d, 0);

  args.push(
    '-map', '[vt]',
    '-map', temTrilha ? '[mix]' : `${idxAudio}:a`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '21',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-t', total.toFixed(2),
    e.saidaPath,
  );

  const filtro = partes.join(';\n');

  return {
    args,
    filtro,
    textoDoComando: `ffmpeg ${args.join(' ')}\n\n--- filtro ---\n${filtro}`,
  };
}
