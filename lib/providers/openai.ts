import { pedir, exigirChave } from './http';

const BASE = 'https://api.openai.com/v1';

export type SaidaEstruturada<T> = { dados: T; tokensSaida: number };

export async function gerarJson<T>(opcoes: {
  modelo: string;
  sistema: string;
  usuario: string;
  schema: Record<string, unknown>;
  nomeSchema: string;
  temperature?: number;
}): Promise<SaidaEstruturada<T>> {
  const r = await pedir(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${exigirChave('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opcoes.modelo,
      temperature: opcoes.temperature ?? 1,
      messages: [
        { role: 'system', content: opcoes.sistema },
        { role: 'user', content: opcoes.usuario },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: opcoes.nomeSchema, strict: true, schema: opcoes.schema },
      },
    }),
  });

  const j = (await r.json()) as any;
  const texto = j.choices?.[0]?.message?.content;
  if (!texto) throw new Error('OpenAI devolveu resposta sem conteudo');

  return { dados: JSON.parse(texto) as T, tokensSaida: j.usage?.completion_tokens ?? 0 };
}

export async function gerarImagem(opcoes: {
  modelo: string;
  prompt: string;
  tamanho: string;
  quality: string;
}): Promise<Buffer> {
  const r = await pedir(`${BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${exigirChave('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opcoes.modelo,
      prompt: opcoes.prompt,
      size: opcoes.tamanho,
      quality: opcoes.quality,
      n: 1,
    }),
  });

  const j = (await r.json()) as any;
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI devolveu resposta sem imagem');
  return Buffer.from(b64, 'base64');
}
