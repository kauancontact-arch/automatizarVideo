#!/usr/bin/env bash
set -euo pipefail

# Migra o schema antes de subir. Idempotente: nos deploys seguintes nao faz nada.
# Sem FONTCONFIG_FILE o libass nao acha config nenhuma neste container.
export FONTCONFIG_FILE="${FONTCONFIG_FILE:-/app/assets/fontconfig/fonts.conf}"
mkdir -p /tmp/fontconfig

echo "[start] fontes visiveis ao ffmpeg:"
fc-list : family 2>/dev/null | sort -u | head -5 || echo "  (fc-list indisponivel)"

echo "[start] aplicando schema"
npx prisma db push --skip-generate

# Cria os dois templates e o fluxo de exemplo. E idempotente: nao duplica nada.
# Deixe SEED_ON_BOOT vazio depois que o fluxo estiver do seu jeito, senao o
# fluxo de exemplo volta a cada reinicio.
if [ "${SEED_ON_BOOT:-}" = "true" ]; then
  echo "[start] semeando templates e fluxo de exemplo"
  npm run db:seed || echo "[start] seed falhou, seguindo mesmo assim"
fi

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
