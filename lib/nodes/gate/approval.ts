import { z } from 'zod';
import type { DefinicaoNo } from '@/lib/engine/registry';

const schema = z.object({
  timeoutHoras: z.number().int().min(1).max(168).default(24),
});

/**
 * Pausa o run antes da narracao. Enquanto voce calibra os prompts, evita
 * pagar voz e render de um roteiro ruim. Desligue quando confiar no resultado.
 */
const no: DefinicaoNo<z.infer<typeof schema>> = {
  type: 'gate.approval',
  rotulo: 'Aprovacao do roteiro',
  schema,
  async run({ envelope, log }) {
    if ((envelope.meta as any).aprovado === true) {
      log('roteiro aprovado, seguindo');
      return { envelope };
    }
    log('aguardando aprovacao na interface');
    return { envelope, pausar: 'aguardando_aprovacao' };
  },
};

export default no;
