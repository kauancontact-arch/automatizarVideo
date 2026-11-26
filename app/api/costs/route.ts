import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PRECOS, precoVelho } from '@/config/pricing';
import { gastoDoDia } from '@/lib/engine/cost';

export const dynamic = 'force-dynamic';

export async function GET() {
  const trintaDias = new Date(Date.now() - 30 * 86_400_000);

  const runs = await db.run.findMany({
    where: { iniciadoEm: { gte: trintaDias } },
    select: { iniciadoEm: true, custoUsd: true, status: true, templateId: true },
  });

  // Gasto por dia
  const porDia = new Map<string, number>();
  for (const r of runs) {
    const dia = r.iniciadoEm.toISOString().slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + Number(r.custoUsd));
  }

  // Gasto por provedor, somado dos passos
  const steps = await db.runStep.groupBy({
    by: ['nodeType'],
    where: { run: { iniciadoEm: { gte: trintaDias } } },
    _sum: { custoUsd: true },
    _count: true,
  });

  const porTemplate = new Map<string, { runs: number; usd: number }>();
  for (const r of runs) {
    const k = r.templateId ?? 'sem template';
    const atual = porTemplate.get(k) ?? { runs: 0, usd: 0 };
    porTemplate.set(k, { runs: atual.runs + 1, usd: atual.usd + Number(r.custoUsd) });
  }

  const publicados = runs.filter((r) => r.status === 'publicado').length;
  const totalMes = runs.reduce((s, r) => s + Number(r.custoUsd), 0);

  const uso = await db.providerUsage.findMany({
    orderBy: { lidoEm: 'desc' },
    take: 10,
    distinct: ['provedor'],
  });

  const precosVelhos = Object.entries(PRECOS)
    .filter(([, p]) => precoVelho(p))
    .map(([k, p]) => ({ chave: k, conferidoEm: p.conferidoEm }));

  return NextResponse.json({
    gastoHoje: await gastoDoDia(),
    totalMes,
    runs: runs.length,
    publicados,
    custoMedio: publicados ? totalMes / publicados : 0,
    limiteDiario: Number(process.env.COST_DAILY_LIMIT_USD ?? 5),
    tetoRigido: Number(process.env.COST_HARD_CAP_USD ?? 50),
    porDia: [...porDia.entries()].sort().map(([dia, usd]) => ({ dia, usd })),
    porNo: steps.map((s) => ({ nodeType: s.nodeType, usd: Number(s._sum.custoUsd ?? 0), execucoes: s._count })),
    porTemplate: [...porTemplate.entries()].map(([id, v]) => ({ id, ...v })),
    uso,
    precosVelhos,
  });
}
