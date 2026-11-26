export type NoDoGrafo = { id: string; type: string; config?: Record<string, unknown> };
export type Aresta = [string, string];
export type Grafo = { nodes: NoDoGrafo[]; edges: Aresta[] };

export function lerGrafo(bruto: unknown): Grafo {
  const g = bruto as Grafo;
  if (!g || !Array.isArray(g.nodes)) throw new Error('grafo invalido: nodes ausente');
  return { nodes: g.nodes, edges: Array.isArray(g.edges) ? g.edges : [] };
}

/**
 * Ordenacao topologica (Kahn). Devolve os nos na ordem de execucao.
 * Ciclo no grafo e erro de montagem, nao de execucao: falha cedo e alto.
 */
export function ordenar(g: Grafo): NoDoGrafo[] {
  const grau = new Map<string, number>(g.nodes.map((n) => [n.id, 0]));
  const saindo = new Map<string, string[]>(g.nodes.map((n) => [n.id, []]));

  for (const [de, para] of g.edges) {
    if (!grau.has(de) || !grau.has(para)) throw new Error(`aresta aponta para no inexistente: ${de} -> ${para}`);
    grau.set(para, (grau.get(para) ?? 0) + 1);
    saindo.get(de)!.push(para);
  }

  const fila = g.nodes.filter((n) => (grau.get(n.id) ?? 0) === 0).map((n) => n.id);
  const ordem: string[] = [];

  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const vizinho of saindo.get(id) ?? []) {
      const novo = (grau.get(vizinho) ?? 0) - 1;
      grau.set(vizinho, novo);
      if (novo === 0) fila.push(vizinho);
    }
  }

  if (ordem.length !== g.nodes.length) throw new Error('o grafo tem ciclo');

  const porId = new Map(g.nodes.map((n) => [n.id, n]));
  return ordem.map((id) => porId.get(id)!);
}
