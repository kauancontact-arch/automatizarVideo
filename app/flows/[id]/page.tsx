import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { lerGrafo, ordenar } from '@/lib/engine/graph';
import { EditorDeFluxo } from './EditorDeFluxo';

export const dynamic = 'force-dynamic';

const ROTULOS: Record<string, string> = {
  'trigger.manual': 'Disparo manual',
  'trigger.schedule': 'Agendamento (cron)',
  'trigger.webhook': 'Webhook',
  'gate.approval': 'Aprovacao do roteiro',
  'script.generate': 'Gerar roteiro',
  'voice.elevenlabs': 'Narracao (ElevenLabs)',
  'image.generate': 'Gerar imagens',
  'video.render': 'Renderizar video',
  'publish.buffer': 'Publicar (Buffer)',
};

export default async function Fluxo(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const flow = await db.flow.findUnique({ where: { id } });
  if (!flow) notFound();

  const grafo = lerGrafo(flow.graph);
  let ordem = grafo.nodes;
  try {
    ordem = ordenar(grafo);
  } catch {
    // Grafo com ciclo: mostra na ordem crua para o erro ficar visivel.
  }

  const templates = await db.template.findMany();

  return (
    <>
      <h1>{flow.nome}</h1>
      <p className="sub">
        {ordem.length} nos · {flow.ativo ? 'ativo' : 'pausado'}
      </p>

      <EditorDeFluxo
        flowId={flow.id}
        ativo={flow.ativo}
        nos={ordem.map((n) => ({
          id: n.id,
          type: n.type,
          rotulo: ROTULOS[n.type] ?? n.type,
          config: (n.config ?? {}) as Record<string, unknown>,
        }))}
        edges={grafo.edges}
        templates={templates.map((t) => ({ id: t.id, nome: t.nome, tipo: t.tipo }))}
      />
    </>
  );
}
