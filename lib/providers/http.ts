export type OpcoesPedido = RequestInit & { timeoutMs?: number; tentativas?: number };

const ERROS_QUE_VALE_RETENTAR = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Unico ponto de saida HTTP. Retry com recuo exponencial apenas em erro de
 * rede e em 429/5xx: um 4xx de validacao vai falhar igual e cada tentativa custa.
 */
export async function pedir(url: string, opcoes: OpcoesPedido = {}): Promise<Response> {
  const { timeoutMs = 120_000, tentativas = 3, ...resto } = opcoes;
  let ultimoErro: unknown;

  for (let n = 0; n < tentativas; n++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { ...resto, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return r;

      if (!ERROS_QUE_VALE_RETENTAR.has(r.status) || n === tentativas - 1) {
        const corpo = await r.text().catch(() => '');
        throw new Error(`${r.status} ${r.statusText} em ${url} :: ${corpo.slice(0, 500)}`);
      }
    } catch (e) {
      clearTimeout(t);
      ultimoErro = e;
      if (n === tentativas - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 2 ** n * 1000 + Math.random() * 400));
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

export function exigirChave(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`${nome} nao esta configurada`);
  return v;
}
