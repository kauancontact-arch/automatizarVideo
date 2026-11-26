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

/** Caracteres falados por segundo, em narracao de video curto em portugues. */
export const CHARS_POR_SEGUNDO = 15;

export function cenasAlvo(duracao: number): number {
  return Math.min(10, Math.max(3, Math.round(duracao / 6)));
}

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
  const cenas = cenasAlvo(p.duracao);
  const totalChars = Math.round(p.duracao * CHARS_POR_SEGUNDO);
  const porCena = Math.round((totalChars * 0.8) / cenas);

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
    `- Tudo o que esta em hook, scenes[].text e cta e NARRADO. Somados, devem dar`,
    `  cerca de ${totalChars} caracteres (${p.duracao} segundos de fala).`,
    `- Escreva exatamente ${cenas} cenas, de cerca de ${porCena} caracteres cada.`,
    '- O gancho e uma frase so e cabe em 3 segundos falados.',
    '- O campo segundos de cada cena e a estimativa de fala daquela cena.',
    '- Fala falada, nao escrita: frases curtas, sem subordinada longa.',
    '- O campo visual descreve UMA imagem concreta e estatica, em uma frase,',
    '  sem texto na imagem e sem pessoas reconheciveis.',
    '- Mantenha o mesmo sujeito visual entre as cenas para a serie ter unidade.',
    p.evitar.length ? `- Nunca escreva: ${p.evitar.join(', ')}` : '- Sem palavras proibidas.',
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

export function textoFalado(r: RoteiroGerado): string {
  return [r.hook, ...r.scenes.map((c) => c.text), r.cta].filter(Boolean).join(' ');
}

/**
 * O que importa e o tamanho do texto falado, porque e ele que determina a
 * duracao do audio. Os segundos declarados por cena sao so peso para repartir
 * as imagens, entao nao valem uma rejeicao.
 */
export function validar(r: RoteiroGerado, duracaoAlvo: number, evitar: string[]): Problema[] {
  const problemas: Problema[] = [];

  const chars = textoFalado(r).length;
  const alvo = duracaoAlvo * CHARS_POR_SEGUNDO;
  const desvio = Math.abs(chars - alvo) / alvo;

  if (desvio > 0.3) {
    const segundos = Math.round(chars / CHARS_POR_SEGUNDO);
    problemas.push({
      campo: 'tamanho',
      detalhe:
        `o texto falado tem ${chars} caracteres (~${segundos}s), e o alvo e ` +
        `${Math.round(alvo)} (~${duracaoAlvo}s): ${chars > alvo ? 'corte' : 'acrescente'} ` +
        `cerca de ${Math.abs(chars - Math.round(alvo))} caracteres`,
    });
  }

  const falado = textoFalado(r).toLowerCase();
  for (const palavra of evitar) {
    if (palavra && falado.includes(palavra.toLowerCase())) {
      problemas.push({ campo: 'evitar', detalhe: `a palavra proibida "${palavra}" aparece no texto falado` });
    }
  }

  return problemas;
}
