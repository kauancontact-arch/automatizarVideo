import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';

const run = promisify(execFile);

export type Sonda = {
  duracao: number;
  largura: number;
  altura: number;
  codecVideo: string;
  codecAudio: string;
  pixFmt: string;
  bytes: number;
};

export async function sondar(caminho: string): Promise<Sonda> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_name,codec_type,width,height,pix_fmt',
    '-of', 'json',
    caminho,
  ]);

  const j = JSON.parse(stdout) as any;
  const video = j.streams?.find((s: any) => s.codec_type === 'video');
  const audio = j.streams?.find((s: any) => s.codec_type === 'audio');
  const info = await stat(caminho);

  return {
    duracao: Number(j.format?.duration ?? 0),
    largura: video?.width ?? 0,
    altura: video?.height ?? 0,
    codecVideo: video?.codec_name ?? '',
    codecAudio: audio?.codec_name ?? '',
    pixFmt: video?.pix_fmt ?? '',
    bytes: info.size,
  };
}

export type Exigencia = {
  larguraEsperada: number;
  alturaEsperada: number;
  duracaoAudio: number;
  bytesMax: number;
};

/**
 * Rejeitar localmente custa nada; descobrir pelo Buffer custa um ciclo inteiro
 * e um erro sem causa clara horas depois.
 */
export function conferir(s: Sonda, e: Exigencia): string[] {
  const problemas: string[] = [];

  if (s.duracao < 3 || s.duracao > 90) problemas.push(`duracao de ${s.duracao.toFixed(1)}s fora da faixa de 3 a 90s`);

  if (Math.abs(s.duracao - e.duracaoAudio) > 0.5) {
    problemas.push(`video (${s.duracao.toFixed(1)}s) e audio (${e.duracaoAudio.toFixed(1)}s) diferem em mais de 0,5s`);
  }

  if (s.largura !== e.larguraEsperada || s.altura !== e.alturaEsperada) {
    problemas.push(`resolucao ${s.largura}x${s.altura}, esperado ${e.larguraEsperada}x${e.alturaEsperada}`);
  }

  if (s.codecVideo !== 'h264') problemas.push(`codec de video ${s.codecVideo}, esperado h264`);
  if (s.pixFmt !== 'yuv420p') problemas.push(`pix_fmt ${s.pixFmt}, esperado yuv420p`);
  if (s.codecAudio !== 'aac') problemas.push(`codec de audio ${s.codecAudio}, esperado aac`);
  if (s.bytes > e.bytesMax) problemas.push(`arquivo de ${(s.bytes / 1e6).toFixed(1)} MB acima do limite da rede`);

  return problemas;
}
