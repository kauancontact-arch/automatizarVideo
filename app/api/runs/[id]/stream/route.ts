import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FINAIS = new Set(['publicado', 'falhou', 'bloqueado_por_custo', 'aguardando_aprovacao', 'agendado']);

/**
 * SSE do progresso. Consulta a cada 2s do lado do servidor e empurra so
 * quando muda — mais barato que a tela consultar em laco.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  let timer: ReturnType<typeof setInterval> | undefined;
  let fechado = false;

  const stream = new ReadableStream({
    start(controller) {
      let anterior = '';
      let voltas = 0;

      // Fechar e idempotente: o navegador pode sumir no meio de uma volta, e
      // enfileirar num controller ja fechado derruba o processo inteiro com
      // unhandledRejection.
      const encerrar = () => {
        if (fechado) return;
        fechado = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // ja estava fechado
        }
      };

      timer = setInterval(async () => {
        if (fechado) return;
        voltas++;

        try {
          const run = await db.run.findUnique({
            where: { id },
            include: { steps: { orderBy: { ordem: 'asc' } } },
          });

          if (!run) return encerrar();

          const atual = JSON.stringify({
            status: run.status,
            custoUsd: run.custoUsd,
            erro: run.erro,
            steps: run.steps.map((s) => ({ nodeId: s.nodeId, status: s.status, custoUsd: s.custoUsd })),
          });

          if (atual !== anterior) {
            anterior = atual;
            try {
              controller.enqueue(encoder.encode(`data: ${atual}\n\n`));
            } catch {
              return encerrar();
            }
          }

          // 10 minutos cobrem o run mais lento com folga.
          if (FINAIS.has(run.status) || voltas > 300) encerrar();
        } catch {
          encerrar();
        }
      }, 2000);
    },

    // Chamado quando o navegador desconecta.
    cancel() {
      fechado = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
