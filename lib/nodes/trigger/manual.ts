import { z } from 'zod';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({});

const no: DefinicaoNo<z.infer<typeof schema>> = {
  type: 'trigger.manual',
  rotulo: 'Disparo manual',
  schema,
  async run({ envelope }) {
    return { envelope };
  },
};

export default no;
