'use client';

import { useEffect, useState } from 'react';

type Canal = { id: string; bufferId: string; rede: string; nome: string };

export function SeletorDeCanais({
  valor,
  aoMudar,
}: {
  valor: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const [canais, setCanais] = useState<Canal[] | null>(null);
  const [erro, setErro] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  async function carregar() {
    const r = await fetch('/api/channels');
    setCanais(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function sincronizar() {
    setSincronizando(true);
    setErro('');

    const r = await fetch('/api/channels/sync');
    const j = await r.json();

    if (!r.ok) setErro(j.erro ?? 'falhou');
    else await carregar();

    setSincronizando(false);
  }

  function alternar(bufferId: string) {
    aoMudar(valor.includes(bufferId) ? valor.filter((v) => v !== bufferId) : [...valor, bufferId]);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="rotulo">Canais</label>
        <button type="button" className="fraco" onClick={sincronizar} disabled={sincronizando} style={{ padding: '4px 10px', fontSize: 12 }}>
          {sincronizando ? 'buscando...' : 'buscar do Buffer'}
        </button>
      </div>

      {erro && <p className="aviso" style={{ marginTop: 8 }}>{erro}</p>}

      {canais === null ? (
        <p style={{ color: 'var(--fraco)', fontSize: 13 }}>Carregando...</p>
      ) : canais.length === 0 ? (
        <p style={{ color: 'var(--fraco)', fontSize: 13, marginTop: 8 }}>
          Nenhum canal ainda. Conecte Instagram, TikTok e YouTube na sua conta do Buffer e clique em
          "buscar do Buffer".
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {canais.map((c) => (
            <label
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${valor.includes(c.bufferId) ? 'var(--acento)' : 'var(--borda)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={valor.includes(c.bufferId)}
                onChange={() => alternar(c.bufferId)}
                style={{ width: 'auto' }}
              />
              <span>
                {c.nome} <span style={{ color: 'var(--fraco)', fontSize: 12 }}>{c.rede}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
