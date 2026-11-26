'use client';

import { useState } from 'react';

export function BotaoRodar({ flowId }: { flowId: string }) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState('');

  async function rodar() {
    setIndo(true);
    setErro('');

    const r = await fetch(`/api/flows/${flowId}/run`, { method: 'POST' });
    const j = await r.json();

    if (r.ok) window.location.href = `/runs/${j.id}`;
    else {
      setErro(j.erro ?? 'falhou');
      setIndo(false);
    }
  }

  return (
    <>
      {erro && <span style={{ color: 'var(--erro)', fontSize: 12, marginRight: 8 }}>{erro}</span>}
      <button onClick={rodar} disabled={indo}>
        {indo ? 'Enfileirando...' : 'Rodar'}
      </button>
    </>
  );
}
