import { z } from 'zod';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  cron: z.string().min(9).describe('Ex: 0 9,18 * * * — minuto hora dia mes diaDaSemana'),
  tz: z.string().default('America/Sao_Paulo'),
});

const no: DefinicaoNo<z.infer<typeof schema>> = {
  type: 'trigger.schedule',
  rotulo: 'Agendamento (cron)',
  schema,
  async run({ envelope }) {
    return { envelope };
  },
};

export default no;
