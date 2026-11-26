import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '@/lib/db';
import { pastaDoRun } from '@/lib/ffmpeg/paths';

export const dynamic = 'force-dynamic';

/**
 * Serve o mp4 do volume, com suporte a Range para o seek do player funcionar.
 *
 * O stream e montado a mao em vez de Readable.toWeb: quando o navegador
 * aborta no meio — o que acontece a cada seek num video — a ponte do Node
 * lanca "Controller is already closed" como uncaughtException, e no modo
 * combinado isso derruba o worker junto.
 */
function corpoDoArquivo(caminho: string, inicio?: number, fim?: number): ReadableStream {
  const arquivo = createReadStream(caminho, { start: inicio, end: fim });
  let fechado = false;

  return new ReadableStream({
    start(controller) {
      const encerrar = () => {
        if (fechado) return;
        fechado = true;
        try {
          controller.close();
        } catch {
          // ja fechado pelo lado do cliente
        }
      };

      arquivo.on('data', (pedaco) => {
        if (fechado) return;
        try {
          controller.enqueue(new Uint8Array(pedaco as Buffer));
        } catch {
          fechado = true;
          arquivo.destroy();
        }
      });

      arquivo.on('end', encerrar);
      arquivo.on('close', encerrar);
      arquivo.on('error', () => {
        fechado = true;
        arquivo.destroy();
      });
    },

    cancel() {
      fechado = true;
      arquivo.destroy();
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const run = await db.run.findUnique({ where: { id }, select: { id: true } });
  if (!run) return new Response('run nao encontrado', { status: 404 });

  const caminho = join(pastaDoRun(id), 'saida.mp4');

  let info;
  try {
    info = await stat(caminho);
  } catch {
    return new Response('video ainda nao existe', { status: 404 });
  }

  const range = req.headers.get('range');

  if (range) {
    const [de, ate] = range.replace('bytes=', '').split('-');
    const inicio = Number(de) || 0;
    const fim = ate ? Math.min(Number(ate), info.size - 1) : info.size - 1;

    return new Response(corpoDoArquivo(caminho, inicio, fim), {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fim - inicio + 1),
        'Content-Range': `bytes ${inicio}-${fim}/${info.size}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  return new Response(corpoDoArquivo(caminho), {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(info.size),
      'Accept-Ranges': 'bytes',
    },
  });
}
