import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { PRECOS } from '@/config/pricing';
import type { Uso } from './envelope';

export function calcularUsd(chave: string, quantidade: number): number {
  const preco = PRECOS[chave];
  if (!preco) return 0;
  return preco.usdPorUnidade * quantidade;
}

export function chaveDePreco(uso: Uso & { modelo?: string; quality?: string }): string {
  const partes = [uso.provider, uso.modelo, uso.quality].filter(Boolean);
  return partes.join(':');
}

/** Gasto total do dia corrente, em USD. */
export async function gastoDoDia(): Promise<number> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const r = await db.run.aggregate({
    _sum: { custoUsd: true },
    where: { iniciadoEm: { gte: inicio } },
  });
  return Number(r._sum.custoUsd ?? 0);
}

export type Veredito = { pode: true } | { pode: false; motivo: string };

/**
 * Checado antes de cada no que gasta. O teto rigido e a unica protecao que
 * nao depende de alguem estar olhando a tela.
 */
export async function podeGastar(estimativaUsd = 0): Promise<Veredito> {
  const limiteDia = Number(process.env.COST_DAILY_LIMIT_USD ?? 5);
  const tetoRigido = Number(process.env.COST_HARD_CAP_USD ?? 50);
  const gasto = await gastoDoDia();

  if (gasto + estimativaUsd > tetoRigido) {
    return { pode: false, motivo: `teto rigido de US$ ${tetoRigido} atingido (gasto hoje: US$ ${gasto.toFixed(4)})` };
  }
  if (gasto + estimativaUsd > limiteDia) {
    return { pode: false, motivo: `limite diario de US$ ${limiteDia} atingido (gasto hoje: US$ ${gasto.toFixed(4)})` };
  }
  return { pode: true };
}

export function decimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(6));
}
