import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { PainelRun } from './PainelRun';

export const dynamic = 'force-dynamic';

export default async function Run(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const run = await db.run.findUnique({
    where: { id },
    include: { flow: { select: { nome: true } }, steps: { orderBy: { ordem: 'asc' } } },
  });

  if (!run) notFound();

  const envelope = run.envelope as any;

  return (
    <>
      <h1>{run.flow.nome}</h1>
      <p className="sub">
        {run.iniciadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · US${' '}
        {Number(run.custoUsd).toFixed(4)}
      </p>

      <PainelRun
        runId={run.id}
        statusInicial={run.status}
        erroInicial={run.erro}
        steps={run.steps.map((s) => ({
          nodeId: s.nodeId,
          nodeType: s.nodeType,
          status: s.status,
          custoUsd: Number(s.custoUsd),
          unidade: s.unidade,
          quantidade: s.quantidade ? Number(s.quantidade) : null,
          duracaoMs: s.duracaoMs,
          erro: s.erro,
          logs: s.logs,
        }))}
      />

      {envelope?.video && (
        <>
          <h2>Video</h2>
          <video
            src={
              String(envelope.video.url ?? '').startsWith('http')
                ? envelope.video.url
                : `/api/runs/${run.id}/video`
            }
            controls
            style={{ width: 300, borderRadius: 10 }}
          />
          <p style={{ color: 'var(--fraco)', fontSize: 12 }}>
            <a href={`/api/runs/${run.id}/video`} download={`${run.id}.mp4`}>
              baixar mp4
            </a>
          </p>
        </>
      )}

      {envelope?.script && (
        <>
          <h2>Roteiro</h2>
          <div className="cartao">
            <p style={{ marginTop: 0, fontWeight: 600 }}>{envelope.script.hook}</p>
            {envelope.script.scenes?.map((c: any, i: number) => (
              <p key={i} style={{ fontSize: 14 }}>
                <span style={{ color: 'var(--fraco)' }}>{c.segundos}s · </span>
                {c.text}
              </p>
            ))}
            <p style={{ fontStyle: 'italic', color: 'var(--fraco)' }}>{envelope.script.cta}</p>
          </div>
        </>
      )}

      {run.steps.some((s) => s.comando) && (
        <>
          <h2>Comando de render</h2>
          <pre>{run.steps.find((s) => s.comando)?.comando}</pre>
        </>
      )}
    </>
  );
}
