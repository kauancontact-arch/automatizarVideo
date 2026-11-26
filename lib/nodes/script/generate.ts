import { z } from 'zod';
import { db } from '@/lib/db';
import { gerarJson } from '@/lib/providers/openai';
import type { DefinicaoNo } from '@/lib/engine/registry';
import { SCHEMA_ROTEIRO, montarSistema, validar, type RoteiroGerado } from './prompt';

const schema = z.object({
  templateId: z.string().optional(),
  nicho: z.string().min(2),
  publico: z.string().default('publico geral'),
  tom: z.string().default('direto e energico'),
  idioma: z.string().default('portugues do Brasil'),
  duracao: z.number().int().min(15).max(180).default(45),
  tema: z.string().default(''),
  evitar: z.array(z.string()).default([]),
  exemplos: z.array(z.string()).default([]),
  modelo: z.string().default('gpt-4.1-mini'),
});

type Config = z.infer<typeof schema>;

const TENTATIVAS = 3;

const no: DefinicaoNo<Config> = {
  type: 'script.generate',
  rotulo: 'Gerar roteiro',
  schema,
  estimar: () => 0.01,

  async run({ envelope, config, log }) {
    const template = config.templateId
      ? await db.template.findUnique({ where: { id: config.templateId } })
      : null;

    const definicao = (template?.definicao ?? {}) as { estrutura?: string };

    const sistema = montarSistema({
      idioma: config.idioma,
      nicho: config.nicho,
      publico: config.publico,
      tom: config.tom,
      duracao: config.duracao,
      estrutura: definicao.estrutura ?? 'Gancho, desenvolvimento em cenas, CTA final.',
      nomeTemplate: template?.nome ?? 'livre',
      evitar: config.evitar,
      exemplos: config.exemplos,
    });

    const tema = config.tema || (envelope.meta.tema as string) || 'escolha um tema relevante do nicho';

    let roteiro: RoteiroGerado | null = null;
    let tokens = 0;
    let correcao = '';

    for (let n = 0; n < TENTATIVAS; n++) {
      const r = await gerarJson<RoteiroGerado>({
        modelo: config.modelo,
        sistema,
        usuario: `Tema: ${tema}${correcao}`,
        schema: SCHEMA_ROTEIRO as unknown as Record<string, unknown>,
        nomeSchema: 'roteiro',
      });

      tokens += r.tokensSaida;
      const problemas = validar(r.dados, config.duracao, config.evitar);

      if (problemas.length === 0) {
        roteiro = r.dados;
        break;
      }

      log(`tentativa ${n + 1}: ${problemas.map((p) => p.detalhe).join('; ')}`);
      correcao = `\n\nCorrija na proxima versao: ${problemas.map((p) => p.detalhe).join('; ')}`;
    }

    // Roteiro ruim que segue adiante vira narracao paga e render pago.
    if (!roteiro) throw new Error(`roteiro nao passou na validacao em ${TENTATIVAS} tentativas`);

    return {
      envelope: {
        ...envelope,
        script: { hook: roteiro.hook, scenes: roteiro.scenes, cta: roteiro.cta },
        meta: {
          ...envelope.meta,
          nicho: config.nicho,
          templateId: config.templateId,
          legenda: roteiro.legenda,
          hashtags: roteiro.hashtags,
          titulo: roteiro.titulo,
        },
      },
      uso: { provider: 'openai', unidade: 'tokens', quantidade: tokens, modelo: config.modelo } as any,
    };
  },
};

export default no;
