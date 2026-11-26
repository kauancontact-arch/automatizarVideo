import { NextResponse } from 'next/server';
import { listarVozes } from '@/lib/providers/elevenlabs';

export const dynamic = 'force-dynamic';

/** Lista as vozes da conta para o seletor da interface. */
export async function GET() {
  try {
    const vozes = await listarVozes();
    return NextResponse.json(
      vozes.map((v) => ({
        voiceId: v.voice_id,
        nome: v.name,
        idioma: v.labels?.language ?? '',
        sotaque: v.labels?.accent ?? '',
        genero: v.labels?.gender ?? '',
        descricao: v.labels?.description ?? '',
        amostra: (v as any).preview_url ?? null,
      })),
    );
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'falhou' }, { status: 502 });
  }
}
