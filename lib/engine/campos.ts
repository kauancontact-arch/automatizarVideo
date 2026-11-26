import { z } from 'zod';

export type Campo = {
  nome: string;
  tipo: 'texto' | 'numero' | 'booleano' | 'lista' | 'escolha';
  opcoes?: string[];
  padrao?: unknown;
  obrigatorio: boolean;
  min?: number;
  max?: number;
  descricao?: string;
};

/**
 * Descreve os campos de um schema zod para a interface montar o formulario.
 *
 * Sem isto o painel so conseguia desenhar campos que ja tivessem valor, entao
 * um no recem-adicionado aparecia vazio e nao havia como configura-lo.
 */
export function descreverCampos(schema: z.ZodTypeAny): Campo[] {
  const obj = desembrulhar(schema);
  if (!(obj instanceof z.ZodObject)) return [];

  const shape = obj.shape as Record<string, z.ZodTypeAny>;

  return Object.entries(shape).map(([nome, bruto]) => {
    const { tipo, opcoes, min, max, padrao, obrigatorio, descricao } = inspecionar(bruto);
    return { nome, tipo, opcoes, min, max, padrao, obrigatorio, descricao };
  });
}

function desembrulhar(s: z.ZodTypeAny): z.ZodTypeAny {
  let atual = s;
  for (let i = 0; i < 10; i++) {
    const def = (atual as any)._def;
    if (def?.innerType) atual = def.innerType;
    else if (def?.schema) atual = def.schema;
    else break;
  }
  return atual;
}

function inspecionar(bruto: z.ZodTypeAny): Omit<Campo, 'nome'> {
  const def = (bruto as any)._def;
  const descricao = def?.description as string | undefined;

  let padrao: unknown;
  let obrigatorio = true;
  let atual: z.ZodTypeAny = bruto;

  // .default() e .optional() embrulham o tipo real; destrava os dois.
  for (let i = 0; i < 10; i++) {
    const d = (atual as any)._def;
    if (d?.typeName === 'ZodDefault') {
      padrao = d.defaultValue();
      obrigatorio = false;
      atual = d.innerType;
    } else if (d?.typeName === 'ZodOptional' || d?.typeName === 'ZodNullable') {
      obrigatorio = false;
      atual = d.innerType;
    } else break;
  }

  const d = (atual as any)._def;
  const nome = d?.typeName as string;

  if (nome === 'ZodEnum') {
    return { tipo: 'escolha', opcoes: d.values as string[], padrao, obrigatorio, descricao };
  }
  if (nome === 'ZodBoolean') return { tipo: 'booleano', padrao, obrigatorio, descricao };
  if (nome === 'ZodArray') return { tipo: 'lista', padrao, obrigatorio, descricao };
  if (nome === 'ZodNumber') {
    const checks = (d.checks ?? []) as { kind: string; value: number }[];
    return {
      tipo: 'numero',
      padrao,
      obrigatorio,
      descricao,
      min: checks.find((c) => c.kind === 'min')?.value,
      max: checks.find((c) => c.kind === 'max')?.value,
    };
  }

  return { tipo: 'texto', padrao, obrigatorio, descricao };
}
