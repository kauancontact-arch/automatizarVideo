import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gerarImagem } from '@/lib/providers/openai';
import { pastaDoRun } from '@/lib/ffmpeg/paths';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  modelo: z.enum(['gpt-image-1-mini', 'gpt-image-1']).default('gpt-image-1-mini'),
  quality: z.enum(['low', 'medium', 'high']).default('low'),
  tamanho: z.enum(['1024x1536']).default('1024x1536'),
  estilo: z.string().default('fotografia editorial, luz suave, cores saturadas, sem texto'),
  porCena: z.boolean().default(true),
});

type Config = z.infer<typeof schema>;

const no: DefinicaoNo<Config> = {
  type: 'image.generate',
  rotulo: 'Gerar imagens',
  schema,

  estimar(config, { envelope }) {
    const n = envelope.script?.scenes.length ?? 6;
    const porImagem = config.quality === 'low' ? 0.003264 : config.quality === 'medium' ? 0.012672 : 0.04992;
    return n * porImagem;
  },

  async run({ envelope, config, runId, log }) {
    const cenas = envelope.script?.scenes ?? [];
    if (!cenas.length) throw new Error('nao ha cenas para ilustrar');

    const pasta = pastaDoRun(runId);
    await mkdir(pasta, { recursive: true });

    const caminhos: string[] = [];

    for (const [i, cena] of cenas.entries()) {
      const prompt = `${cena.visual}. ${config.estilo}. Enquadramento vertical 9:16.`;
      const bytes = await gerarImagem({
        modelo: config.modelo,
        prompt,
        tamanho: config.tamanho,
        quality: config.quality,
      });

      const caminho = join(pasta, `cena${i + 1}.png`);
      await writeFile(caminho, bytes);
      caminhos.push(caminho);
      log(`cena ${i + 1}/${cenas.length} gerada`);
    }

    return {
      envelope: { ...envelope, assets: { ...envelope.assets, images: caminhos } },
      uso: {
        provider: 'openai',
        unidade: 'imagens',
        quantidade: caminhos.length,
        modelo: config.modelo,
        quality: config.quality,
      } as any,
    };
  },
};

export default no;
