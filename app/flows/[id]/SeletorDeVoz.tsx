'use client';

import { useEffect, useState } from 'react';

type Voz = {
  voiceId: string;
  nome: string;
  idioma: string;
  sotaque: string;
  genero: string;
  descricao: string;
  amostra: string | null;
};

export function SeletorDeVoz({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (voiceId: string) => void;
}) {
  const [vozes, setVozes] = useState<Voz[] | null>(null);
  const [erro, setErro] = useState('');
  const [tocando, setTocando] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voices')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro ?? 'falhou');
        setVozes(j);
      })
      .catch((e) => setErro(e.message));
  }, []);

  function ouvir(v: Voz) {
    if (!v.amostra) return;
    const audio = new Audio(v.amostra);
    setTocando(v.voiceId);
    audio.onended = () => setTocando(null);
    audio.play().catch(() => setTocando(null));
  }

  if (erro) {
    return (
      <p className="aviso">
        Nao consegui listar as vozes: {erro}. Confira ELEVENLABS_API_KEY nas variaveis do servico.
      </p>
    );
  }

  if (!vozes) return <p style={{ color: 'var(--fraco)', fontSize: 13 }}>Carregando vozes...</p>;

  return (
    <div>
      <label className="rotulo">Voz</label>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {vozes.map((v) => (
          <div
            key={v.voiceId}
            onClick={() => aoMudar(v.voiceId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              border: `1px solid ${v.voiceId === valor ? 'var(--acento)' : 'var(--borda)'}`,
              background: v.voiceId === valor ? 'rgba(79,140,255,.08)' : 'transparent',
            }}
          >
            <input type="radio" checked={v.voiceId === valor} onChange={() => aoMudar(v.voiceId)} style={{ width: 'auto' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{v.nome}</div>
              <div style={{ color: 'var(--fraco)', fontSize: 12 }}>
                {[v.idioma, v.sotaque, v.genero, v.descricao].filter(Boolean).join(' · ') || v.voiceId}
              </div>
            </div>
            {v.amostra && (
              <button
                type="button"
                className="fraco"
                onClick={(e) => {
                  e.stopPropagation();
                  ouvir(v);
                }}
                style={{ padding: '5px 11px', fontSize: 12 }}
              >
                {tocando === v.voiceId ? 'tocando' : 'ouvir'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
