export const TEMPLATES_ROTEIRO = [
  {
    nome: 'Narracao com gancho de 3s',
    estrutura: [
      '1. Gancho: uma afirmacao que contraria o senso comum do nicho, em ate 12 palavras.',
      '2. Tensao: por que isso importa para quem assiste, em uma cena.',
      '3. Desenvolvimento: 3 a 5 cenas, uma ideia cada, da mais simples para a mais surpreendente.',
      '4. Virada: a informacao que o espectador nao esperava.',
      '5. CTA: uma pergunta que convida a comentar, nunca "siga para mais".',
    ].join('\n'),
  },
  {
    nome: 'Lista com contagem na tela',
    estrutura: [
      '1. Gancho: "N coisas que..." com o numero dito em voz alta.',
      '2. Itens: uma cena por item, do menos para o mais forte.',
      '3. O ultimo item e o melhor e vem anunciado como tal.',
      '4. CTA: peca para salvar, nao para seguir.',
    ].join('\n'),
  },
];

export const TEMPLATES_VIDEO = [
  {
    nome: 'Legenda amarela centro',
    definicao: {
      nome: 'Legenda amarela centro',
      legenda: {
        fonte: 'Anton',
        tamanho: 86,
        posicao: 'centro',
        destaque: '#FFD400',
        contorno: 6,
        maiusculas: true,
        palavrasPorVez: 3,
      },
      camera: { movimento: 'zoom-in', intensidade: 0.12 },
      corte: { tipo: 'seco', segundosPorCena: 3.5 },
      audio: { trilha: null, db: -18, ducking: true },
    },
  },
  {
    nome: 'Legenda branca embaixo',
    definicao: {
      nome: 'Legenda branca embaixo',
      legenda: {
        fonte: 'Montserrat',
        tamanho: 64,
        posicao: 'baixo',
        destaque: '#4F8CFF',
        contorno: 4,
        maiusculas: false,
        palavrasPorVez: 4,
      },
      camera: { movimento: 'zoom-out', intensidade: 0.08 },
      corte: { tipo: 'seco', segundosPorCena: 4 },
      audio: { trilha: null, db: -20, ducking: true },
    },
  },
];
