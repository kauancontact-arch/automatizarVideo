import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { db } from '@/lib/db';
import { pastaDoRun } from '@/lib/ffmpeg/paths';

export const dynamic = 'force-dynamic';

/**
 * Serve o mp4 direto do volume. Sem bucket configurado o video existe so em
 * disco, e sem esta rota nao haveria como assisti-lo pela interface.
 * Suporta Range, senao o seek do player nao funciona.
 */
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
    const fim = ate ? Number(ate) : info.size - 1;

    const stream = createReadStream(caminho, { start: inicio, end: fim });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fim - inicio + 1),
        'Content-Range': `bytes ${inicio}-${fim}/${info.size}`,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  return new Response(Readable.toWeb(createReadStream(caminho)) as ReadableStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(info.size),
      'Accept-Ranges': 'bytes',
    },
  });
}
