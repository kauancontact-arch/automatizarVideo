/**
 * Precos unitarios em USD. Cada linha traz a data em que foi conferida.
 * O painel avisa quando uma linha passa de 90 dias.
 */
export type Preco = {
  unidade: string;
  usdPorUnidade: number;
  conferidoEm: string; // YYYY-MM-DD
  fonte: string;
};

export const PRECOS: Record<string, Preco> = {
  // ElevenLabs: USD por caractere.
  'elevenlabs:eleven_turbo_v2_5': {
    unidade: 'caracteres',
    usdPorUnidade: 0.05 / 1000,
    conferidoEm: '2026-09-23',
    fonte: 'https://elevenlabs.io/pricing/api',
  },
  'elevenlabs:eleven_multilingual_v2': {
    unidade: 'caracteres',
    usdPorUnidade: 0.1 / 1000,
    conferidoEm: '2026-09-23',
    fonte: 'https://elevenlabs.io/pricing/api',
  },

  // OpenAI imagens: USD por imagem, 1024x1536.
  'openai:gpt-image-1-mini:low': {
    unidade: 'imagens',
    usdPorUnidade: 0.003264,
    conferidoEm: '2026-11-25',
    fonte: 'https://developers.openai.com/api/docs/models/gpt-image-1-mini',
  },
  'openai:gpt-image-1-mini:medium': {
    unidade: 'imagens',
    usdPorUnidade: 0.012672,
    conferidoEm: '2026-11-25',
    fonte: 'https://developers.openai.com/api/docs/models/gpt-image-1-mini',
  },

  // LLM de roteiro: USD por token de saida (entrada e desprezivel aqui).
  'openai:gpt-4.1-mini': {
    unidade: 'tokens',
    usdPorUnidade: 1.6 / 1_000_000,
    conferidoEm: '2026-11-25',
    fonte: 'https://developers.openai.com/api/docs/pricing',
  },

  // Render: CPU propria, custo marginal.
  'railway:render': {
    unidade: 'segundos',
    usdPorUnidade: 0,
    conferidoEm: '2026-11-25',
    fonte: 'CPU ja paga pelo plano',
  },

  'buffer:post': {
    unidade: 'posts',
    usdPorUnidade: 0,
    conferidoEm: '2026-11-25',
    fonte: 'incluso no plano Buffer',
  },
};

export const DIAS_ATE_PRECO_VELHO = 90;

export function precoVelho(p: Preco, agora = new Date()): boolean {
  const dias = (agora.getTime() - Date.parse(p.conferidoEm)) / 86_400_000;
  return dias > DIAS_ATE_PRECO_VELHO;
}
