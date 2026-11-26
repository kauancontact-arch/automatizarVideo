import { iniciarWorker } from './boot';

iniciarWorker()
  .then(() => console.log('[worker] rodando como servico proprio'))
  .catch((e) => {
    console.error('[worker] falhou ao iniciar:', e);
    process.exit(1);
  });
