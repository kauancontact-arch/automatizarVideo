import { z } from 'zod';
import { schedule } from '@/lib/providers/buffer';
import { storageConfigurado, urlAssinada } from '@/lib/providers/storage';
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
    const chave = envelope.video?.chave;

    if (!chave || !storageConfigurado()) {
      throw new Error(
        'o Buffer busca o video por URL, entao ele precisa estar num bucket. ' +
          'Configure STORAGE_BUCKET e rode o render de novo.',
      );
    }

    // URL temporaria em vez de bucket publico: so quem recebe o link acessa,
    // e ele caduca.
    const url = urlAssinada(chave);

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
