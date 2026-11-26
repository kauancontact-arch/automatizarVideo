'use client';

import { Fragment, useEffect, useState } from 'react';

type Step = {
  nodeId: string;
  nodeType: string;
  status: string;
  custoUsd: number;
  unidade: string | null;
  quantidade: number | null;
  duracaoMs: number | null;
  erro: string | null;
  logs: string | null;
};

const FINAIS = new Set(['publicado', 'falhou', 'bloqueado_por_custo', 'aguardando_aprovacao', 'agendado']);

export function PainelRun({
  runId,
  statusInicial,
  erroInicial,
  steps,
}: {
  runId: string;
  statusInicial: string;
  erroInicial: string | null;
  steps: Step[];
}) {
  const [status, setStatus] = useState(statusInicial);
  const [erro, setErro] = useState(erroInicial);

  // Acompanha o progresso sem consultar em laco: o servidor empurra so quando muda.
  useEffect(() => {
    if (FINAIS.has(status)) return;

    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setStatus(d.status);
      setErro(d.erro);
      if (FINAIS.has(d.status)) {
        es.close();
        window.location.reload();
      }
    };
    es.onerror = () => es.close();

    // Os logs de cada passo so chegam numa carga nova da pagina; enquanto o
    // run anda, recarrega de tempos em tempos para o progresso aparecer.
    const recarga = setInterval(() => window.location.reload(), 20000);

    return () => {
      es.close();
      clearInterval(recarga);
    };
  }, [runId, status]);

  async function acao(caminho: string, corpo?: unknown) {
    await fetch(`/api/runs/${runId}/${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    window.location.reload();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <span className={`marca ${status}`}>{status.replace(/_/g, ' ')}</span>

        {status === 'aguardando_aprovacao' && (
          <>
            <button onClick={() => acao('approve', { aprovado: true })}>Aprovar roteiro</button>
            <button className="fraco" onClick={() => acao('approve', { aprovado: false })}>
              Rejeitar
            </button>
          </>
        )}

        {(status === 'falhou' || status === 'bloqueado_por_custo') && (
          <button onClick={() => acao('retry')}>Retomar do no que falhou</button>
        )}
      </div>

      {erro && (
        <p className="aviso" style={{ borderLeftColor: 'var(--erro)', color: 'var(--erro)' }}>
          {erro}
        </p>
      )}

      <h2>Passos</h2>
      {steps.length === 0 ? (
        <p className="vazio">Ainda nenhum passo gravado.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Estado</th>
              <th>Uso</th>
              <th>Custo</th>
              <th>Tempo</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <Fragment key={s.nodeId}>
                <tr>
                  <td>
                    {s.nodeId} <span style={{ color: 'var(--fraco)' }}>{s.nodeType}</span>
                  </td>
                  <td>
                    <span className={`marca ${s.status === 'ok' ? 'publicado' : 'falhou'}`}>{s.status}</span>
                  </td>
                  <td>{s.quantidade != null ? `${s.quantidade.toFixed(0)} ${s.unidade}` : '—'}</td>
                  <td>US$ {s.custoUsd.toFixed(4)}</td>
                  <td>{s.duracaoMs != null ? `${(s.duracaoMs / 1000).toFixed(1)}s` : '—'}</td>
                </tr>
                {(s.logs || s.erro) && (
                  <tr>
                    <td colSpan={5} style={{ paddingTop: 0 }}>
                      {s.erro && (
                        <div style={{ color: 'var(--erro)', fontSize: 13, marginBottom: 6 }}>{s.erro}</div>
                      )}
                      {s.logs && (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.logs}</pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
