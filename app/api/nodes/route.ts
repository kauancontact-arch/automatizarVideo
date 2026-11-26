import { NextResponse } from 'next/server';
import { NOS } from '@/lib/engine/registry';
import { descreverCampos } from '@/lib/engine/campos';

export const dynamic = 'force-dynamic';

/** O que existe para adicionar num fluxo, com a config inicial de cada tipo. */
export async function GET() {
  return NextResponse.json(
    NOS.map((n) => {
      // O zod devolve os defaults quando recebe um objeto vazio; onde houver
      // campo obrigatorio, cai para {} e o usuario preenche na interface.
      const r = n.schema.safeParse({});
      return {
        type: n.type,
        rotulo: n.rotulo,
        padrao: r.success ? (r.data as Record<string, unknown>) : {},
        campos: descreverCampos(n.schema as never),
      };
    }),
  );
}
