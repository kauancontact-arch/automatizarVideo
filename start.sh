#!/usr/bin/env bash
set -euo pipefail

# Migra o schema antes de subir. Idempotente: nos deploys seguintes nao faz nada.
echo "[start] aplicando schema"
npx prisma db push --skip-generate

if [ "${WORKER_IN_PROCESS:-}" = "true" ]; then
  echo "[start] modo combinado: interface + worker no mesmo servico"

  npm run worker & WORKER=$!
  npm run start:web & WEB=$!

  # Se qualquer um dos dois morrer, derruba o outro para o Railway reiniciar
  # o servico inteiro, em vez de ficar meio de pe.
  trap 'kill -TERM "$WORKER" "$WEB" 2>/dev/null || true' TERM INT
  wait -n
  echo "[start] um dos processos saiu, encerrando o outro"
  kill -TERM "$WORKER" "$WEB" 2>/dev/null || true
  exit 1
fi

echo "[start] so a interface"
exec npm run start:web
