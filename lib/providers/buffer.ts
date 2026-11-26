import { pedir, exigirChave } from './http';

/**
 * API GraphQL do Buffer, com chave pessoal.
 * O Buffer nao registra apps de desenvolvedor novos desde 2019, entao nao ha
 * OAuth de terceiros: isto publica nas contas do dono da chave.
 * Trocar de provedor e trocar este arquivo — a interface abaixo e o contrato.
 */
const BASE = 'https://api.buffer.com';

export type Canal = { id: string; rede: string; nome: string };
export type Agendamento = { postId: string; quando?: string };
export type StatusPost = { estado: 'publicado' | 'pendente' | 'falhou'; link?: string; erro?: string };

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await pedir(`${BASE}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${exigirChave('BUFFER_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const j = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(`Buffer: ${j.errors.map((e) => e.message).join('; ')}`);
  if (!j.data) throw new Error('Buffer devolveu resposta sem dados');
  return j.data;
}

export async function listChannels(): Promise<Canal[]> {
  const d = await graphql<{ channels: { id: string; service: string; name: string }[] }>(
    `query { channels { id service name } }`,
  );
  return (d.channels ?? []).map((c) => ({ id: c.id, rede: c.service, nome: c.name }));
}

export async function schedule(opcoes: {
  channelIds: string[];
  videoUrl: string;
  texto: string;
  quando?: string;
}): Promise<Agendamento[]> {
  const d = await graphql<{ createPost: { id: string; dueAt?: string }[] }>(
    `mutation Criar($input: CreatePostInput!) { createPost(input: $input) { id dueAt } }`,
    {
      input: {
        channelIds: opcoes.channelIds,
        text: opcoes.texto,
        media: [{ type: 'video', url: opcoes.videoUrl }],
        ...(opcoes.quando ? { dueAt: opcoes.quando } : { now: true }),
      },
    },
  );
  return (d.createPost ?? []).map((p) => ({ postId: p.id, quando: p.dueAt }));
}

export async function getStatus(postId: string): Promise<StatusPost> {
  const d = await graphql<{ post: { status: string; permalink?: string; error?: string } }>(
    `query Status($id: ID!) { post(id: $id) { status permalink error } }`,
    { id: postId },
  );
  const s = d.post?.status;
  if (s === 'sent' || s === 'published') return { estado: 'publicado', link: d.post.permalink };
  if (s === 'failed' || s === 'error') return { estado: 'falhou', erro: d.post.error };
  return { estado: 'pendente' };
}
