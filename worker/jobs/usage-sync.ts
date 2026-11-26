import { db } from '@/lib/db';
import { assinatura } from '@/lib/providers/elevenlabs';

/** Le o consumo real dos provedores que expoem saldo. */
export async function sincronizarUso(): Promise<void> {
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const a = await assinatura();
      await db.providerUsage.create({
        data: {
          provedor: 'elevenlabs',
          saldo: a.character_limit - a.character_count,
          limite: a.character_limit,
        },
      });
    } catch (e) {
      console.error('[usage-sync] elevenlabs:', e);
    }
  }
}
