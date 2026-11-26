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

  const stream = new ReadableStream({
    async start(controller) {
      let anterior = '';
      let voltas = 0;

      const timer = setInterval(async () => {
        voltas++;
        try {
          const run = await db.run.findUnique({
            where: { id },
            include: { steps: { orderBy: { ordem: 'asc' } } },
          });

          if (!run) {
            clearInterval(timer);
            controller.close();
            return;
          }

          const atual = JSON.stringify({
            status: run.status,
            custoUsd: run.custoUsd,
            erro: run.erro,
            steps: run.steps.map((s) => ({ nodeId: s.nodeId, status: s.status, custoUsd: s.custoUsd })),
          });

          if (atual !== anterior) {
            anterior = atual;
            controller.enqueue(encoder.encode(`data: ${atual}\n\n`));
          }

          // 10 minutos cobrem o run mais lento com folga.
          if (FINAIS.has(run.status) || voltas > 300) {
            clearInterval(timer);
            controller.close();
          }
        } catch {
          clearInterval(timer);
          controller.close();
        }
      }, 2000);
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
