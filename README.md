# automatizarVideo

Gera roteiro, narracao, imagens e video vertical, e publica nas redes pelo Buffer.
Fluxos sao grafos de nos, no estilo Zapier, guardados como JSON no banco.

A documentacao de arquitetura e a especificacao de implementacao estao no doc do projeto.

## Rodar local

```bash
npm install
cp .env.example .env     # preencha as chaves
npm run db:push
npm run db:seed          # cria os dois templates e um fluxo de exemplo
npm run dev              # interface em http://localhost:3000
npm run worker           # em outro terminal: fila, cron e render
```

Precisa de `ffmpeg` e `ffprobe` no PATH.

## Deploy no Railway

Tres servicos no mesmo projeto, a partir deste repositorio:

| Servico  | Start command            | Dominio |
| -------- | ------------------------ | ------- |
| web      | `npm run start`          | sim     |
| worker   | `npm run worker:start`   | nao     |

Em um slot so (plano gratuito), suba apenas `web` com `WORKER_IN_PROCESS=true`:
`start.sh` sobe a interface e o worker como dois processos no mesmo container,
e derruba os dois se qualquer um cair. Um render pesado ocupa a CPU que serve as
telas, o que e aceitavel ate uns poucos videos por dia.
| postgres | plugin do Railway        | -       |

O `worker` precisa de um volume montado em `/data` e de 2 GB de RAM.

A voz da narracao e escolhida na interface, em Fluxos > o fluxo > no de
narracao: a lista vem da sua conta do ElevenLabs, com previa de audio.
As variaveis de ambiente estao em `.env.example` — preencha as duas primeiras
secoes em ambos os servicos.

## Estrutura

```
app/      interface e rotas HTTP
lib/
  engine/   motor de fluxo: ordenacao, execucao, custo
  nodes/    um arquivo por tipo de no
  providers/ unico lugar que fala HTTP com terceiros
  ffmpeg/   template -> comando de render
worker/   consumidor da fila e cron
config/   precos e templates iniciais
```

Tres regras que mantem isso coerente:

1. Nada em `app/` chama um provedor. A interface fala com o banco e com a fila.
2. Nada em `lib/nodes/` monta HTTP na mao. Tudo passa por `lib/providers/`.
3. `lib/engine/registry.ts` e o unico lugar que conhece todos os nos.

## Seguranca

Nenhuma chave entra no repositorio. Elas vivem nas variaveis de ambiente do
Railway. `lib/crypto.ts` cifra credenciais gravadas no banco pela interface.
