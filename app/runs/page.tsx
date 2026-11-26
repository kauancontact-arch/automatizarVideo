import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Runs() {
  const runs = await db.run.findMany({
    orderBy: { iniciadoEm: 'desc' },
    take: 100,
    include: { flow: { select: { nome: true } } },
  });

  return (
    <>
      <h1>Execucoes</h1>
      <p className="sub">As 100 mais recentes.</p>

      {runs.length === 0 ? (
        <p className="vazio">Nenhuma execucao ainda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Fluxo</th>
              <th>Estado</th>
              <th>Custo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.iniciadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td>{r.flow.nome}</td>
                <td>
                  <span className={`marca ${r.status}`}>{r.status.replace(/_/g, ' ')}</span>
                </td>
                <td>US$ {Number(r.custoUsd).toFixed(4)}</td>
                <td style={{ textAlign: 'right' }}>
                  <a href={`/runs/${r.id}`}>abrir</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
