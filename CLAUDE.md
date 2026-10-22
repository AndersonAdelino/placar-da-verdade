# CLAUDE.md — Placar da Verdade

Robô que checa ao vivo os fatos ditos num debate político e publica o placar num site estático.
Código aberto (AGPL-3.0). Tudo em português: código, comentários, commits, textos do site.
Visão geral para humanos: `README.md`. Regras do juiz explicadas ao público: `site/metodologia.html`.

## Mapa

| Arquivo | O que é |
|---|---|
| `robo.mjs` | O robô (roda no PC do operador). Um arquivo só, de propósito. Modelos e flags no topo |
| `voz.mjs` | Reconhecimento de voz local (CAM++ via sherpa-onnx, `modelos/voz.onnx`). `npm run voz` cadastra |
| `site/` | Site estático: `index.html` (CSS inline), `app.js`, `metodologia.html/.js`, `_headers` (CSP) |
| `worker.js` | Cloudflare Worker: contador ao vivo (Durable Object, `/ao-vivo`) e `/contestar` (KV `CONTESTACOES`) |
| `contestacoes.mjs` | Lista os avisos "Achou erro nesta checagem?" (`npm run contestacoes`) |
| `fonte.mjs` | Valida a fonte citada pelo juiz: só vale URL que veio da busca/Perplexity; sem ela, `em_revisao` |
| `teste.mjs`, `testes/` | Testes do filtro de datas e da validação de fonte (`npm test` roda os dois) |
| `tmp/` | **Ignorado pelo git, mas guarda os dados dos debates** (ver abaixo). Não apagar |

## Fluxo do robô

Áudio em pedaços de 10s (yt-dlp → ffmpeg, ou `--entrada` com dispositivo dshow) → **gpt-audio-mini** transcreve
(Whisper de reserva) → voz rotula quem fala → **Jev** mede o tom e peneira → **Claude Haiku** extrai afirmações,
propostas e ataques → **busca Parallel + Perplexity Sonar** em paralelo → **Gemini 3.8 Flash** julga →
falso/impreciso passam pela **conferência do áudio** (gpt-audio-mini + Gemini Flash Lite; desempate gpt-audio;
sem maioria, Claude Sonnet decide publicar/corrigir/"em revisão") → `placar.json` no R2 (bucket `placar-debate`).
Tudo via OpenRouter (`OPENROUTER_API_KEY` no `.env`).

- Fala repetida de debate anterior: o robô carrega `placar-<data>.json` de `ANTERIORES` e reaproveita o veredito revisado.
- Vídeo gravado vira simulação: "agora" é a hora em que o trecho passou ao vivo; a busca descarta o que saiu depois
  (`depoisDe`) e o Perplexity recebe `search_before_date_filter`.
- Gasto por etapa em `tmp/gasto.json`; `--limite` corta checagem em 80% e tudo em 100%.
- Log de tudo em `tmp/robo.log` (é o que se monitora durante o debate).

## Dados e publicação

- R2 público em `https://placar-dados.zenithonacademy.com.br/`: `placar.json` (atual) e arquivos de debates
  `placar-2026-10-18.json` (revisado) e `placar-2026-10-18-ao-vivo.json` (como ficou ao vivo).
- O site lê `?d=<data>` para abrir um arquivo. Campos opcionais que o site entende: `encerrado` (tela de próximo
  debate com contagem regressiva), `revisao` (card de correções), `aviso` (no lugar do vídeo), e por declaração
  `literal`, `corrigido`, `ja_checado`, veredito `em_revisao`.
- Subir dado à mão: `node node_modules/wrangler/bin/wrangler.js r2 object put placar-debate/<arq>.json --file <arq> --content-type application/json --remote`
- Site: `npx wrangler deploy` (publica `site/`; `site/placar.json` é local e fica de fora).
- Domínios: `placardaverdade.com.br` (principal) e `placar.zenithonacademy.com.br`. Domínio novo precisa entrar em
  `wrangler.jsonc` (routes), `worker.js` (`ORIGENS`) e `site/_headers` (CSP `connect-src`).

## `tmp/` (dados que não estão no git)

- `tmp/debate1/`: cópia de segurança do debate de 18/10 (placar, `historico.jsonl`, gasto, log).
- `tmp/auditoria/`: auditoria pós-debate. `decl.json` (93 checagens ao vivo), `transcricao.txt` (referência, Gemini),
  `montar.mjs` (aplica as correções e gera os `placar-2026-10-18*.json`), `RELATORIO.md`, testes de juiz e busca
  (`jev-teste.mjs`, `busca-teste.mjs`, `perplexity-teste.mjs`) e o gabarito.
- Rodar o robô (mesmo `--local`) **sobrescreve** `tmp/placar.json`, `tmp/gasto.json` e acrescenta em
  `tmp/historico.jsonl`. Antes de testar, faça cópia; depois, restaure.

## Regras de operação (dia de debate)

- Debate novo: **sem** `--continuar` (placar começa do zero e a tela de contagem regressiva some sozinha).
  `--continuar` só se o robô cair no meio do mesmo debate. Nomes `--a/--b` iguais aos arquivos em `vozes/`.
- Live que acaba vira gravação: o robô detecta e para (antes baixava o debate inteiro de novo).
- Depois do debate: pôr `encerrado` no placar e fazer a auditoria (transcrição completa + fontes primárias).
- Saldo da OpenRouter: chamadas de áudio exigem pelo menos US$ 0,50 de saldo na conta. Conferir antes.

## Lições já medidas (não refazer sem motivo)

- Transcrição foi a maior causa de erro em 18/10 ("sete e meio" → "10,5%"). gpt-audio-mini e Gemini 3.5 Flash Lite
  acertaram 5/5 trechos difíceis; Gemini 3.1 Pro inventou texto.
- Juiz no gabarito de 78 casos: Gemini 3.8 Flash 60%, **Jev 50%** (puxa para "impreciso"), Gemini + Perplexity **68%**.
  2ª busca só em fontes oficiais: 64%. O gargalo é prova, não juiz.
- A busca Parallel devolve no máximo ~1.500 caracteres por página; o filtro de data corta só ~6%.
- Auditoria se baseia na transcrição e em fontes primárias (IBGE, BC, TSE, leis), **não** em agências de checagem.
- O Gemini 2.5 Flash Lite (que carrega a busca) dá 429 às vezes: `openrouter()` tenta de novo em 429/5xx.

## Convenções

- Sem build, sem framework. Dependências mínimas (`sherpa-onnx-node`, `wrangler`); não adicionar outras.
- CSP restrita (`script-src 'self'`): nada de CDN; imagem gerada no navegador precisa de `blob:` em `img-src`.
- Imparcialidade é requisito: mesmas regras para os dois candidatos; fontes partidárias dos dois lados excluídas
  (`PARTIDARIOS` em `robo.mjs`). Texto do site não toma partido.
- Commits no estilo do histórico (frase em português dizendo o que mudou e por quê).
- Prints de verificação: Edge headless com `--window-size=390` dá viewport de ~496px; para celular, use uma
  página com `<iframe>` de 375px.
- No Git Bash do Windows, heredoc com `\n` dentro de template JS costuma virar quebra de linha real: prefira
  escrever o script com a ferramenta de arquivo.
