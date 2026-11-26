import { db } from '../lib/db';
import { TEMPLATES_ROTEIRO, TEMPLATES_VIDEO } from './templates.seed';

async function main() {
  const roteiros = [];
  for (const t of TEMPLATES_ROTEIRO) {
    const existente = await db.template.findFirst({ where: { nome: t.nome, tipo: 'roteiro' } });
    roteiros.push(
      existente ??
        (await db.template.create({
          data: { nome: t.nome, tipo: 'roteiro', definicao: { estrutura: t.estrutura } },
        })),
    );
  }

  const videos = [];
  for (const t of TEMPLATES_VIDEO) {
    const existente = await db.template.findFirst({ where: { nome: t.nome, tipo: 'video' } });
    videos.push(
      existente ??
        (await db.template.create({ data: { nome: t.nome, tipo: 'video', definicao: t.definicao } })),
    );
  }

  console.log(`templates: ${roteiros.length} de roteiro, ${videos.length} de video`);

  const jaTem = await db.flow.findFirst({ where: { nome: 'Exemplo — video diario' } });
  if (jaTem) {
    console.log('fluxo de exemplo ja existe');
    return;
  }

  // Fluxo de exemplo: tudo menos a publicacao, que depende dos canais do Buffer.
  const flow = await db.flow.create({
    data: {
      nome: 'Exemplo — video diario',
      ativo: false,
      graph: {
        nodes: [
          { id: 'n1', type: 'trigger.manual', config: {} },
          {
            id: 'n2',
            type: 'script.generate',
            config: {
              templateId: roteiros[0].id,
              nicho: 'curiosidades de ciencia',
              publico: 'adultos curiosos, 25 a 45 anos',
              tom: 'direto e energico',
              duracao: 45,
              tema: '',
              evitar: ['garantido', 'milagre'],
              modelo: 'gpt-4.1-mini',
            },
          },
          { id: 'n3', type: 'gate.approval', config: { timeoutHoras: 24 } },
          {
            id: 'n4',
            type: 'voice.elevenlabs',
            config: { voiceId: '', modelId: 'eleven_turbo_v2_5', speed: 1.06 },
          },
          { id: 'n5', type: 'image.generate', config: { modelo: 'gpt-image-1-mini', quality: 'low' } },
          { id: 'n6', type: 'video.render', config: { templateId: videos[0].id, resolucao: '1080x1920', fps: 30 } },
        ],
        edges: [
          ['n1', 'n2'],
          ['n2', 'n3'],
          ['n3', 'n4'],
          ['n3', 'n5'],
          ['n4', 'n6'],
          ['n5', 'n6'],
        ],
      },
    },
  });

  console.log(`fluxo de exemplo criado: ${flow.id}`);
  console.log('abra o fluxo na interface e escolha a voz antes de rodar');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
