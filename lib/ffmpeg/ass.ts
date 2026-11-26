import type { Caption } from '@/lib/engine/envelope';

export type EstiloLegenda = {
  fonte: string;
  tamanho: number;
  posicao: 'centro' | 'baixo' | 'alto';
  destaque: string; // hex da web, #RRGGBB
  contorno: number;
  maiusculas: boolean;
  palavrasPorVez: number;
};

/** ASS usa &HBBGGRR: invertido em relacao ao hex da web. */
export function hexParaAss(hex: string): string {
  const limpo = hex.replace('#', '').padStart(6, '0');
  const r = limpo.slice(0, 2);
  const g = limpo.slice(2, 4);
  const b = limpo.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function tempo(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const ALINHAMENTO = { baixo: 2, centro: 5, alto: 8 } as const;

/**
 * Um arquivo .ass em vez de um drawtext por palavra: um video de 45s tem umas
 * 120 palavras, e 120 filtros encadeados ficam lentos e ilegiveis.
 */
/**
 * Se a fonte do template nao estiver instalada, o libass cai numa fonte
 * qualquer e o video sai com tipografia errada sem avisar. Declarar a reserva
 * aqui deixa o resultado previsivel ate os .ttf serem commitados.
 */
const FONTE_RESERVA = 'DejaVu Sans';

export function montarAss(
  captions: Caption[],
  estilo: EstiloLegenda,
  largura = 1080,
  altura = 1920,
  fontesDisponiveis?: string[],
): string {
  const destaque = hexParaAss(estilo.destaque);
  const branco = '&H00FFFFFF';
  const fonte =
    !fontesDisponiveis || fontesDisponiveis.includes(estilo.fonte) ? estilo.fonte : FONTE_RESERVA;

  const cabecalho = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${largura}`,
    `PlayResY: ${altura}`,
    'WrapStyle: 2',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Viral,${fonte},${estilo.tamanho},${branco},&H00000000,&H00000000,-1,0,1,${estilo.contorno},0,${ALINHAMENTO[estilo.posicao]},80,80,${estilo.posicao === 'baixo' ? 220 : 0},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const linhas: string[] = [];
  const porVez = Math.max(1, estilo.palavrasPorVez);

  for (let i = 0; i < captions.length; i += porVez) {
    const grupo = captions.slice(i, i + porVez);
    const inicio = grupo[0].t;
    const fim = grupo.at(-1)!.fim;

    // Uma linha por palavra ativa: o grupo inteiro aparece, a palavra do
    // momento fica na cor de destaque.
    for (const [j, palavra] of grupo.entries()) {
      const texto = grupo
        .map((p, k) => {
          const w = estilo.maiusculas ? p.w.toUpperCase() : p.w;
          return k === j ? `{\\c${destaque}}${w}{\\c${branco}}` : w;
        })
        .join(' ');

      linhas.push(
        `Dialogue: 0,${tempo(palavra.t)},${tempo(j === grupo.length - 1 ? fim : grupo[j + 1].t)},Viral,,0,0,0,,${texto}`,
      );
    }
  }

  return [...cabecalho, ...linhas].join('\n');
}
