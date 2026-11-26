import type { z } from 'zod';
import type { ContextoNo, ResultadoNo } from './envelope';

export type DefinicaoNo<C = any> = {
  type: string;
  rotulo: string;
  // O terceiro parametro deixa a entrada livre: campos com .default() sao
  // opcionais na entrada e obrigatorios na saida, e ZodType<C> sozinho recusa isso.
  schema: z.ZodType<C, z.ZodTypeDef, any>;
  /** Estimativa em USD antes de rodar, para o teto de custo. */
  estimar?: (config: C, ctx: ContextoNo<C>) => number;
  run: (ctx: ContextoNo<C>) => Promise<ResultadoNo>;
};

import manual from '@/lib/nodes/trigger/manual';
import schedule from '@/lib/nodes/trigger/schedule';
import webhook from '@/lib/nodes/trigger/webhook';
import approval from '@/lib/nodes/gate/approval';
import scriptGenerate from '@/lib/nodes/script/generate';
import voiceElevenlabs from '@/lib/nodes/voice/elevenlabs';
import imageGenerate from '@/lib/nodes/image/generate';
import videoRender from '@/lib/nodes/video/render';
import publishBuffer from '@/lib/nodes/publish/buffer';

// Unico lugar que conhece todos os nos. Modulo novo = um arquivo + uma linha aqui.
export const NOS: DefinicaoNo[] = [
  manual,
  schedule,
  webhook,
  approval,
  scriptGenerate,
  voiceElevenlabs,
  imageGenerate,
  videoRender,
  publishBuffer,
];

export const POR_TIPO = new Map(NOS.map((n) => [n.type, n]));

export function buscarNo(type: string): DefinicaoNo {
  const n = POR_TIPO.get(type);
  if (!n) throw new Error(`no desconhecido: ${type}`);
  return n;
}

export function ehGatilho(type: string): boolean {
  return type.startsWith('trigger.');
}
