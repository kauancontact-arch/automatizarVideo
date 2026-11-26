export const SCHEMA_ROTEIRO = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'scenes', 'cta', 'legenda', 'hashtags', 'titulo'],
  properties: {
    hook: { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 3,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'visual', 'segundos'],
        properties: {
          text: { type: 'string' },
          visual: { type: 'string' },
          segundos: { type: 'number' },
        },
      },
    },
    cta: { type: 'string' },
    legenda: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    titulo: { type: 'string' },
  },
} as const;

export function montarSistema(p: {
  idioma: string;
  nicho: string;
  publico: string;
  tom: string;
  duracao: number;
  estrutura: string;
  nomeTemplate: string;
  evitar: string[];
  exemplos: string[];
}): string {
  return [
    `Voce escreve roteiros para video vertical curto em ${p.idioma}.`,
    '',
    `Nicho: ${p.nicho}`,
    `Publico: ${p.publico}`,
    `Tom: ${p.tom}`,
    `Duracao alvo: ${p.duracao} segundos`,
    '',
    `Estrutura exigida (template "${p.nomeTemplate}"):`,
    p.estrutura,
    '',
    'Regras:',
    '- O gancho e a primeira frase e cabe em 3 segundos falados.',
    '- Cada cena tem UMA ideia e de 3 a 5 segundos de fala.',
    '- Fala falada, nao escrita: frases curtas, sem subordinada longa.',
    '- O campo visual descreve UMA imagem concreta e estatica, em uma frase,',
    '  sem texto na imagem e sem pessoas reconheciveis.',
    '- Mantenha o mesmo sujeito visual entre as cenas para a serie ter unidade.',
    p.evitar.length ? `- Nunca escreva: ${p.evitar.join(', ')}` : '- Sem palavras proibidas.',
    `- Total de fala: cerca de ${Math.round(p.duracao * 15)} caracteres.`,
    '',
    p.exemplos.length
      ? ['Exemplos aprovados, imite o ritmo e o vocabulario, nunca o tema:', ...p.exemplos].join('\n')
      : '',
  ].join('\n');
}

export type RoteiroGerado = {
  hook: string;
  scenes: { text: string; visual: string; segundos: number }[];
  cta: string;
  legenda: string;
  hashtags: string[];
  titulo: string;
};

export type Problema = { campo: string; detalhe: string };

/** O modelo respeita o schema e ignora a duracao. Estas checagens pegam isso. */
export function validar(r: RoteiroGerado, duracaoAlvo: number, evitar: string[]): Problema[] {
  const problemas: Problema[] = [];

  const soma = r.scenes.reduce((s, c) => s + c.segundos, 0);
  const desvio = Math.abs(soma - duracaoAlvo) / duracaoAlvo;
  if (desvio > 0.2) {
    problemas.push({
      campo: 'segundos',
      detalhe: `a soma das cenas deu ${soma.toFixed(1)}s, fora de 20% dos ${duracaoAlvo}s pedidos`,
    });
  }

  const falado = [r.hook, ...r.scenes.map((c) => c.text), r.cta].join(' ').toLowerCase();
  for (const palavra of evitar) {
    if (palavra && falado.includes(palavra.toLowerCase())) {
      problemas.push({ campo: 'evitar', detalhe: `a palavra proibida "${palavra}" aparece no texto falado` });
    }
  }

  return problemas;
}
