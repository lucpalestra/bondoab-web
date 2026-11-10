# BondOAB · V0.1 (Projeto 52 · BondLabs)

Site de estudo para a 1ª fase do Exame de Ordem: **oab.bondlabs.com.br**

## O que tem
- 880 questões oficiais do 37º ao 47º Exame (Caderno Tipo 1 + gabarito definitivo); 13 anuladas sinalizadas
- 20 disciplinas na distribuição oficial da FGV
- Treino por disciplina/prova com correção na hora
- Simulados de 80 questões / 5h: 11 provas completas + simulado misto
- Revisão de erros com repetição espaçada (1, 3, 7, 15, 30 dias)
- Desempenho por disciplina e plano semanal até o 48º Exame (20/12/2026, data prevista)
- 2ª fase: "Em breve"

Progresso salvo no navegador (localStorage). Sem servidor, sem login.

## Publicar (GitHub Pages)
1. Crie o repo `lucpalestra/bondoab-web` e suba o conteúdo desta pasta (com o arquivo `CNAME`).
2. Settings → Pages → Deploy from branch → `main` / root.
3. No DNS do bondlabs.com.br: CNAME `oab` → `lucpalestra.github.io`.
4. Quando o certificado sair, marque "Enforce HTTPS".

## Estrutura
- `index.html`, `assets/app.css`, `assets/app.js`
- `data/banco.json`: `{provas:[{ex,data}], q:[{id,ex,n,d,e[],a[4],g,anulada}]}` (`g` = índice 0–3 da correta)
