import { db } from '@/lib/db';
import { lerGrafo, ordenar } from './graph';
import { buscarNo, ehGatilho } from './registry';
import { envelopeVazio, type Envelope } from './envelope';
import { calcularUsd, chaveDePreco, decimal, podeGastar } from './cost';

export type OpcoesExecucao = {
  /** Reenfileiramento: pula nos ja concluidos e aproveita a saida gravada. */
  retomar?: boolean;
  gatilho?: Record<string, unknown>;
};

/**
 * Executa um run do inicio ao fim, um no por vez, gravando cada passo antes
 * de comecar o proximo. E isso que torna a retomada barata: a narracao ja
 * paga nunca e refeita.
 */
export async function executarRun(runId: string, opcoes: OpcoesExecucao = {}): Promise<void> {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId }, include: { flow: true, steps: true } });
  const grafo = lerGrafo(run.flow.graph);
  const ordem = ordenar(grafo);

  let envelope: Envelope = (run.envelope as Envelope | null) ?? envelopeVazio({ ...(opcoes.gatilho ?? {}) });

  await db.run.update({ where: { id: runId }, data: { status: 'rodando', erro: null } });

  const concluidos = new Map(run.steps.filter((s) => s.status === 'ok').map((s) => [s.nodeId, s]));

  for (const [i, no] of ordem.entries()) {
    if (ehGatilho(no.type)) continue;

    // Idempotencia: no ja concluido devolve a saida gravada, sem gastar de novo.
    const anterior = opcoes.retomar ? concluidos.get(no.id) : undefined;
    if (anterior?.saida) {
      envelope = anterior.saida as Envelope;
      continue;
    }

    const def = buscarNo(no.type);
    const config = def.schema.parse(no.config ?? {});

    const estimativa = def.estimar?.(config, { envelope, config, runId, nodeId: no.id, log: () => {} }) ?? 0;
    const veredito = await podeGastar(estimativa);
    if (!veredito.pode) {
      await db.run.update({
        where: { id: runId },
        data: { status: 'bloqueado_por_custo', erro: veredito.motivo, terminadoEm: new Date() },
      });
      return;
    }

    const comecou = Date.now();
    const linhas: string[] = [];

    // O passo nasce como "rodando" e os logs sao gravados a cada linha. Antes
    // tudo so aparecia quando o no terminava, o que deixava um render de
    // varios minutos sem sinal nenhum de vida na interface.
    await db.runStep.upsert({
      where: { runId_nodeId: { runId, nodeId: no.id } },
      create: { runId, nodeId: no.id, nodeType: no.type, ordem: i, status: 'rodando' },
      update: { status: 'rodando', erro: null, logs: null },
    });

    const anotar = (m: string) => {
      linhas.push(m);
      // Sem await: um log lento nao pode segurar o render.
      db.runStep
        .update({
          where: { runId_nodeId: { runId, nodeId: no.id } },
          data: { logs: linhas.join('\n') },
        })
        .catch(() => {});
    };

    try {
      const resultado = await def.run({
        envelope,
        config,
        runId,
        nodeId: no.id,
        log: anotar,
      });

      envelope = resultado.envelope;

      let usd = 0;
      if (resultado.uso) {
        const extra = resultado.uso as any;
        usd = calcularUsd(chaveDePreco(extra), resultado.uso.quantidade);
        envelope.cost.push({
          provider: resultado.uso.provider,
          unidade: resultado.uso.unidade,
          qtd: resultado.uso.quantidade,
          usd,
        });
      }

      // Custo e saida gravados na mesma transacao em que o passo vira "ok":
      // gravar depois abre uma janela em que o dinheiro saiu e o painel nao sabe.
      await db.$transaction([
        db.runStep.upsert({
          where: { runId_nodeId: { runId, nodeId: no.id } },
          create: {
            runId,
            nodeId: no.id,
            nodeType: no.type,
            ordem: i,
            status: 'ok',
            saida: envelope as any,
            unidade: resultado.uso?.unidade,
            quantidade: resultado.uso ? decimal(resultado.uso.quantidade) : undefined,
            custoUsd: decimal(usd),
            comando: resultado.comando,
            logs: linhas.join('\n') || null,
            duracaoMs: Date.now() - comecou,
          },
          update: {
            status: 'ok',
            saida: envelope as any,
            custoUsd: decimal(usd),
            comando: resultado.comando,
            logs: linhas.join('\n') || null,
            erro: null,
            duracaoMs: Date.now() - comecou,
          },
        }),
        db.run.update({
          where: { id: runId },
          data: {
            envelope: envelope as any,
            custoUsd: { increment: decimal(usd) },
            templateId: (envelope.meta.templateId as string) ?? undefined,
          },
        }),
      ]);

      if (resultado.pausar) {
        await db.run.update({ where: { id: runId }, data: { status: resultado.pausar } });
        return;
      }
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      await db.$transaction([
        db.runStep.upsert({
          where: { runId_nodeId: { runId, nodeId: no.id } },
          create: {
            runId,
            nodeId: no.id,
            nodeType: no.type,
            ordem: i,
            status: 'falhou',
            erro: msg,
            logs: linhas.join('\n') || null,
            duracaoMs: Date.now() - comecou,
          },
          update: {
            status: 'falhou',
            erro: msg,
            logs: linhas.join('\n') || null,
            duracaoMs: Date.now() - comecou,
          },
        }),
        db.run.update({ where: { id: runId }, data: { status: 'falhou', erro: msg, terminadoEm: new Date() } }),
      ]);
      return;
    }
  }

  const temPublicacao = ordem.some((n) => n.type.startsWith('publish.'));
  await db.run.update({
    where: { id: runId },
    data: {
      status: temPublicacao ? 'agendado' : 'publicado',
      terminadoEm: new Date(),
    },
  });
}
