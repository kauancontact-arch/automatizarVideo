import { pedir, exigirChave } from './http';
import type { Caption } from '@/lib/engine/envelope';

const BASE = 'https://api.elevenlabs.io/v1';

export type Voz = { voice_id: string; name: string; labels?: Record<string, string> };

export async function listarVozes(): Promise<Voz[]> {
  const r = await pedir(`${BASE}/voices`, { headers: { 'xi-api-key': exigirChave('ELEVENLABS_API_KEY') } });
  const j = (await r.json()) as { voices: Voz[] };
  return j.voices ?? [];
}

export async function assinatura(): Promise<{
  tier: string;
  character_count: number;
  character_limit: number;
}> {
  const r = await pedir(`${BASE}/user/subscription`, {
    headers: { 'xi-api-key': exigirChave('ELEVENLABS_API_KEY') },
  });
  return (await r.json()) as any;
}

export type Narracao = { audio: Buffer; captions: Caption[]; caracteres: number };

/**
 * Usa o endpoint with-timestamps: o alinhamento vem junto com o audio, pelo
 * mesmo preco. E o que da legenda palavra a palavra sem pagar transcricao.
 */
export async function narrar(opcoes: {
  texto: string;
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}): Promise<Narracao> {
  const r = await pedir(`${BASE}/text-to-speech/${opcoes.voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': exigirChave('ELEVENLABS_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opcoes.texto,
      model_id: opcoes.modelId,
      voice_settings: {
        stability: opcoes.stability,
        similarity_boost: opcoes.similarityBoost,
        style: opcoes.style,
        speed: opcoes.speed,
      },
    }),
    timeoutMs: 180_000,
  });

  const j = (await r.json()) as {
    audio_base64: string;
    alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
  };

  return {
    audio: Buffer.from(j.audio_base64, 'base64'),
    captions: juntarEmPalavras(j.alignment),
    caracteres: opcoes.texto.length,
  };
}

/** O alinhamento vem por caractere; a legenda precisa de palavras. */
function juntarEmPalavras(a?: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): Caption[] {
  if (!a) return [];
  const palavras: Caption[] = [];
  let atual = '';
  let inicio = 0;

  for (let i = 0; i < a.characters.length; i++) {
    const c = a.characters[i];
    if (atual === '') inicio = a.character_start_times_seconds[i];

    if (/\s/.test(c)) {
      if (atual.trim()) palavras.push({ t: inicio, fim: a.character_end_times_seconds[i - 1] ?? inicio, w: atual.trim() });
      atual = '';
    } else {
      atual += c;
    }
  }

  if (atual.trim()) {
    palavras.push({
      t: inicio,
      fim: a.character_end_times_seconds.at(-1) ?? inicio,
      w: atual.trim(),
    });
  }

  return palavras;
}
