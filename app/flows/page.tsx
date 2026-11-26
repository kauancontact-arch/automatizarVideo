import { db } from '@/lib/db';
import { BotaoRodar } from './BotaoRodar';

export const dynamic = 'force-dynamic';

export default async function Flows() {
  const flows = await db.flow.findMany({
    orderBy: { criadoEm: 'desc' },
    include: { _count: { select: { runs: true } } },
  });

  return (
    <>
      <h1>Fluxos</h1>
      <p className="sub">Cada fluxo e um grafo de nos. Dispare a mao ou deixe o cron disparar.</p>

      {flows.length === 0 ? (
        <p className="vazio">
          Nenhum fluxo ainda. Rode <code>npm run db:seed</code> para criar o fluxo de exemplo.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Estado</th>
              <th>Execucoes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id}>
                <td>{f.nome}</td>
                <td>
                  <span className={`marca ${f.ativo ? 'publicado' : ''}`}>{f.ativo ? 'ativo' : 'pausado'}</span>
                </td>
                <td>{f._count.runs}</td>
                <td style={{ textAlign: 'right' }}>
                  <BotaoRodar flowId={f.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
