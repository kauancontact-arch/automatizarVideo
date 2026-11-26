'use client';

import { useState } from 'react';
import { SeletorDeVoz } from './SeletorDeVoz';

type No = { id: string; type: string; rotulo: string; config: Record<string, unknown> };
type Template = { id: string; nome: string; tipo: string };

export function EditorDeFluxo({
  flowId,
  ativo,
  nos,
  edges,
  templates,
}: {
  flowId: string;
  ativo: boolean;
  nos: No[];
  edges: [string, string][];
  templates: Template[];
}) {
  const [estado, setEstado] = useState(nos);
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState('');

  function mudarConfig(nodeId: string, chave: string, valor: unknown) {
    setEstado((atual) =>
      atual.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, [chave]: valor } } : n)),
    );
    setSujo(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro('');

    const r = await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: { nodes: estado.map((n) => ({ id: n.id, type: n.type, config: n.config })), edges },
      }),
    });

    if (r.ok) setSujo(false);
    else setErro((await r.json()).erro ?? 'falhou ao salvar');
    setSalvando(false);
  }

  async function alternarAtivo() {
    await fetch(`/api/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    });
    window.location.reload();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={salvar} disabled={!sujo || salvando}>
          {salvando ? 'Salvando...' : sujo ? 'Salvar alteracoes' : 'Salvo'}
        </button>
        <button className="fraco" onClick={alternarAtivo}>
          {ativo ? 'Pausar fluxo' : 'Ativar fluxo'}
        </button>
      </div>

      {erro && <p className="aviso" style={{ borderLeftColor: 'var(--erro)', color: 'var(--erro)' }}>{erro}</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        {estado.map((no, i) => (
          <div key={no.id} className="cartao" style={{ padding: 0 }}>
            <div
              onClick={() => setAberto(aberto === no.id ? null : no.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer' }}
            >
              <span style={{ color: 'var(--fraco)', fontSize: 12, minWidth: 18 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{no.rotulo}</div>
                <div style={{ color: 'var(--fraco)', fontSize: 12 }}>
                  {no.id} · {no.type}
                  {no.type === 'voice.elevenlabs' && !no.config.voiceId && (
                    <span style={{ color: 'var(--aviso)' }}> · escolha uma voz</span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--fraco)' }}>{aberto === no.id ? '−' : '+'}</span>
            </div>

            {aberto === no.id && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--borda)' }}>
                <div style={{ marginTop: 14 }}>
                  {no.type === 'voice.elevenlabs' ? (
                    <CamposDeVoz no={no} mudar={(k, v) => mudarConfig(no.id, k, v)} />
                  ) : (
                    <CamposGenericos
                      no={no}
                      templates={templates}
                      mudar={(k, v) => mudarConfig(no.id, k, v)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CamposDeVoz({ no, mudar }: { no: No; mudar: (k: string, v: unknown) => void }) {
  const c = no.config as Record<string, any>;

  return (
    <>
      <SeletorDeVoz valor={(c.voiceId as string) ?? ''} aoMudar={(v) => mudar('voiceId', v)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 16 }}>
        <Campo rotulo="Modelo">
          <select
            value={c.modelId ?? 'eleven_turbo_v2_5'}
            onChange={(e) => mudar('modelId', e.target.value)}
            style={select}
          >
            <option value="eleven_turbo_v2_5">Turbo v2.5 — metade do preco</option>
            <option value="eleven_multilingual_v2">Multilingual v2 — melhor qualidade</option>
          </select>
        </Campo>
        <Deslizante rotulo="Velocidade" valor={c.speed ?? 1.06} min={0.7} max={1.2} passo={0.01} mudar={(v) => mudar('speed', v)} />
        <Deslizante rotulo="Estabilidade" valor={c.stability ?? 0.4} min={0} max={1} passo={0.05} mudar={(v) => mudar('stability', v)} />
        <Deslizante rotulo="Semelhanca" valor={c.similarityBoost ?? 0.75} min={0} max={1} passo={0.05} mudar={(v) => mudar('similarityBoost', v)} />
        <Deslizante rotulo="Entonacao" valor={c.style ?? 0.3} min={0} max={1} passo={0.05} mudar={(v) => mudar('style', v)} />
      </div>

      <p style={{ color: 'var(--fraco)', fontSize: 12, marginTop: 12 }}>
        Estabilidade entre 0,3 e 0,5 soa natural em narracao com emocao. Entonacao acima de 0,5 comeca a soar
        artistica demais para video curto.
      </p>
    </>
  );
}

function CamposGenericos({
  no,
  templates,
  mudar,
}: {
  no: No;
  templates: Template[];
  mudar: (k: string, v: unknown) => void;
}) {
  const c = no.config as Record<string, any>;
  const tipoTemplate = no.type === 'script.generate' ? 'roteiro' : no.type === 'video.render' ? 'video' : null;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {tipoTemplate && (
        <Campo rotulo="Template">
          <select value={c.templateId ?? ''} onChange={(e) => mudar('templateId', e.target.value)} style={select}>
            <option value="">— nenhum —</option>
            {templates
              .filter((t) => t.tipo === tipoTemplate)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
          </select>
        </Campo>
      )}

      {Object.entries(c)
        .filter(([k]) => k !== 'templateId')
        .map(([chave, valor]) => (
          <Campo key={chave} rotulo={chave}>
            {typeof valor === 'boolean' ? (
              <input
                type="checkbox"
                checked={valor}
                onChange={(e) => mudar(chave, e.target.checked)}
                style={{ width: 'auto' }}
              />
            ) : typeof valor === 'number' ? (
              <input type="number" value={valor} onChange={(e) => mudar(chave, Number(e.target.value))} />
            ) : Array.isArray(valor) ? (
              <input
                value={valor.join(', ')}
                onChange={(e) => mudar(chave, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder="separado por virgula"
              />
            ) : (
              <input value={String(valor ?? '')} onChange={(e) => mudar(chave, e.target.value)} />
            )}
          </Campo>
        ))}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <div style={{ marginTop: 5 }}>{children}</div>
    </div>
  );
}

function Deslizante({
  rotulo,
  valor,
  min,
  max,
  passo,
  mudar,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  mudar: (v: number) => void;
}) {
  return (
    <Campo rotulo={`${rotulo}: ${Number(valor).toFixed(2)}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => mudar(Number(e.target.value))}
        style={{ padding: 0 }}
      />
    </Campo>
  );
}

const select: React.CSSProperties = {
  background: 'var(--fundo)',
  border: '1px solid var(--borda)',
  color: 'var(--texto)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  width: '100%',
};
