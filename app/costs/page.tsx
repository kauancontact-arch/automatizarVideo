import { db } from '@/lib/db';
import { PRECOS, precoVelho } from '@/config/pricing';
import { gastoDoDia } from '@/lib/engine/cost';

export const dynamic = 'force-dynamic';

export default async function Custos() {
  const trintaDias = new Date(Date.now() - 30 * 86_400_000);

  const runs = await db.run.findMany({
    where: { iniciadoEm: { gte: trintaDias } },
    select: { iniciadoEm: true, custoUsd: true, status: true },
  });

  const totalMes = runs.reduce((s, r) => s + Number(r.custoUsd), 0);
  const publicados = runs.filter((r) => r.status === 'publicado').length;
  const hoje = await gastoDoDia();
  const limite = Number(process.env.COST_DAILY_LIMIT_USD ?? 5);
  const teto = Number(process.env.COST_HARD_CAP_USD ?? 50);

  const porNo = await db.runStep.groupBy({
    by: ['nodeType'],
    where: { run: { iniciadoEm: { gte: trintaDias } } },
    _sum: { custoUsd: true },
    _count: true,
  });

  const uso = await db.providerUsage.findMany({
    orderBy: { lidoEm: 'desc' },
    take: 5,
    distinct: ['provedor'],
  });

  const velhos = Object.entries(PRECOS).filter(([, p]) => precoVelho(p));
  const custoMedio = publicados ? totalMes / publicados : 0;

  return (
    <>
      <h1>Custos</h1>
      <p className="sub">Calculado a partir do consumo gravado em cada passo.</p>

      <div className="grade">
        <div className="cartao">
          <div className="rotulo">Custo medio por video</div>
          <div className="numero">US$ {custoMedio.toFixed(3)}</div>
        </div>
        <div className="cartao">
          <div className="rotulo">Hoje</div>
          <div className="numero" style={{ color: hoje > limite ? 'var(--erro)' : undefined }}>
            US$ {hoje.toFixed(3)}
          </div>
          <div style={{ color: 'var(--fraco)', fontSize: 12 }}>
            limite US$ {limite} · teto US$ {teto}
          </div>
        </div>
        <div className="cartao">
          <div className="rotulo">30 dias</div>
          <div className="numero">US$ {totalMes.toFixed(2)}</div>
          <div style={{ color: 'var(--fraco)', fontSize: 12 }}>
            {runs.length} execucoes · {publicados} publicadas
          </div>
        </div>
      </div>

      {velhos.length > 0 && (
        <p className="aviso">
          {velhos.length} preco(s) na tabela sem conferencia ha mais de 90 dias: {velhos.map(([k]) => k).join(', ')}.
          Um painel com preco velho e pior que nenhum.
        </p>
      )}

      <h2>Gasto por no, 30 dias</h2>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Execucoes</th>
            <th>Custo</th>
          </tr>
        </thead>
        <tbody>
          {porNo.map((n) => (
            <tr key={n.nodeType}>
              <td>{n.nodeType}</td>
              <td>{n._count}</td>
              <td>US$ {Number(n._sum.custoUsd ?? 0).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {uso.length > 0 && (
        <>
          <h2>Saldo nos provedores</h2>
          <table>
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Saldo</th>
                <th>Limite</th>
                <th>Lido em</th>
              </tr>
            </thead>
            <tbody>
              {uso.map((u) => (
                <tr key={u.id}>
                  <td>{u.provedor}</td>
                  <td>{u.saldo != null ? Number(u.saldo).toLocaleString('pt-BR') : '—'}</td>
                  <td>{u.limite != null ? Number(u.limite).toLocaleString('pt-BR') : '—'}</td>
                  <td>{u.lidoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
