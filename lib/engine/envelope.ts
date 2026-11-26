export type Cena = { text: string; visual: string; segundos: number };

export type Roteiro = {
  hook: string;
  scenes: Cena[];
  cta: string;
};

export type Caption = { t: number; fim: number; w: string };

export type Envelope = {
  script?: Roteiro;
  assets?: {
    audioUrl?: string;
    audioPath?: string;
    images?: string[];
    captions?: Caption[];
  };
  /** chave = caminho do objeto no bucket; a URL assinada e gerada ao publicar. */
  video?: { chave?: string; url?: string; path?: string; duracao?: number; formato?: string };
  meta: {
    nicho?: string;
    templateId?: string;
    templateVideoId?: string;
    legenda?: string;
    hashtags?: string[];
    titulo?: string;
    postIds?: string[];
    [k: string]: unknown;
  };
  cost: Lancamento[];
};

export type Lancamento = {
  provider: string;
  unidade: string;
  qtd: number;
  usd: number;
};

export function envelopeVazio(meta: Envelope['meta'] = {}): Envelope {
  return { meta, cost: [] };
}

/** Uso devolvido por um no, convertido em custo pelo motor. */
export type Uso = { provider: string; unidade: string; quantidade: number };

export type ContextoNo<C = unknown> = {
  envelope: Envelope;
  config: C;
  runId: string;
  nodeId: string;
  log: (msg: string) => void;
};

export type ResultadoNo = {
  envelope: Envelope;
  uso?: Uso;
  comando?: string;
  /** Pausa o run neste no (gate de aprovacao). */
  pausar?: 'aguardando_aprovacao' | 'agendado';
};
