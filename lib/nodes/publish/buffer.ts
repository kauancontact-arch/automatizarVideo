import { z } from 'zod';
import { schedule } from '@/lib/providers/buffer';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  channels: z.array(z.string()).min(1),
  mode: z.enum(['agora', 'agendar', 'fila']).default('agendar'),
  quando: z.string().optional().describe('ISO 8601, usado quando mode = agendar'),
});

type Config = z.infer<typeof schema>;

const no: DefinicaoNo<Config> = {
  type: 'publish.buffer',
  rotulo: 'Publicar (Buffer)',
  schema,

  async run({ envelope, config, log }) {
    const url = envelope.video?.url;
    if (!url) throw new Error('nao ha video para publicar');
    if (url.startsWith('file://')) throw new Error('o video precisa estar no storage: configure STORAGE_BUCKET');

    const texto = [envelope.meta.legenda, (envelope.meta.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n');

    const agendamentos = await schedule({
      channelIds: config.channels,
      videoUrl: url,
      texto,
      quando: config.mode === 'agendar' ? config.quando : undefined,
    });

    log(`${agendamentos.length} posts criados`);

    // Agendar devolve sucesso do agendamento, nao da publicacao: o run fica
    // em "agendado" e o job de verificacao fecha depois do horario marcado.
    return {
      envelope: {
        ...envelope,
        meta: { ...envelope.meta, postIds: agendamentos.map((a) => a.postId) },
      },
      uso: { provider: 'buffer', unidade: 'posts', quantidade: agendamentos.length, modelo: 'post' } as any,
      pausar: config.mode === 'agora' ? undefined : 'agendado',
    };
  },
};

export default no;
