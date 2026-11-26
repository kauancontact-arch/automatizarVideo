import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { narrar } from '@/lib/providers/elevenlabs';
import { pastaDoRun } from '@/lib/ffmpeg/paths';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  voiceId: z.string().min(8),
  modelId: z.enum(['eleven_turbo_v2_5', 'eleven_multilingual_v2']).default('eleven_turbo_v2_5'),
  stability: z.number().min(0).max(1).default(0.4),
  similarityBoost: z.number().min(0).max(1).default(0.75),
  style: z.number().min(0).max(1).default(0.3),
  speed: z.number().min(0.7).max(1.2).default(1.06),
});

type Config = z.infer<typeof schema>;

const no: DefinicaoNo<Config> = {
  type: 'voice.elevenlabs',
  rotulo: 'Narracao (ElevenLabs)',
  schema,

  estimar(config, { envelope }) {
    const texto = textoDoRoteiro(envelope);
    const porMil = config.modelId === 'eleven_turbo_v2_5' ? 0.05 : 0.1;
    return (texto.length / 1000) * porMil;
  },

  async run({ envelope, config, runId, log }) {
    const texto = textoDoRoteiro(envelope);
    if (!texto) throw new Error('nao ha roteiro para narrar');

    const r = await narrar({ texto, ...config });
    log(`${r.caracteres} caracteres, ${r.captions.length} palavras alinhadas`);

    const pasta = pastaDoRun(runId);
    await mkdir(pasta, { recursive: true });
    const caminho = join(pasta, 'narracao.mp3');
    await writeFile(caminho, r.audio);

    return {
      envelope: {
        ...envelope,
        assets: { ...envelope.assets, audioPath: caminho, captions: r.captions },
      },
      uso: {
        provider: 'elevenlabs',
        unidade: 'caracteres',
        quantidade: r.caracteres,
        modelo: config.modelId,
      } as any,
    };
  },
};

function textoDoRoteiro(envelope: { script?: { hook: string; scenes: { text: string }[]; cta: string } }): string {
  const s = envelope.script;
  if (!s) return '';
  return [s.hook, ...s.scenes.map((c) => c.text), s.cta].filter(Boolean).join(' ');
}

export default no;
