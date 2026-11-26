import { z } from 'zod';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  descricao: z.string().optional(),
});

const no: DefinicaoNo<z.infer<typeof schema>> = {
  type: 'trigger.webhook',
  rotulo: 'Webhook',
  schema,
  async run({ envelope }) {
    // O corpo do POST ja entra em envelope.meta quando o run e criado.
    return { envelope };
  },
};

export default no;
