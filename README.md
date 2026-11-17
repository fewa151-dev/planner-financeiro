# Planner Financeiro

App pessoal de finanças: orçamento do mês, contas a pagar, dívidas e cartões, reserva de contingência,
investimentos, patrimônio e orçamento anual. Funciona no PC e no celular e pode ser instalado como app.

**Abrir o app:** https://fewa151-dev.github.io/planner-financeiro/

## Seus dados
Os dados ficam salvos no próprio aparelho (no navegador). Nada é enviado para este repositório.
Use **Ajustes → Exportar backup** para guardar uma cópia e **Importar backup** para levar a outro aparelho.

## Estrutura
- `app/`: o app publicado (página, manifesto, service worker e ícones).
- `cotacoes-apps-script.gs`: serviço gratuito de cotações (Google Apps Script). O passo a passo está no topo do arquivo.
- `server.py` e `Abrir Planner.bat`: servidor local opcional para usar no PC com cotações sem o Apps Script.
- `.github/workflows/pages.yml`: publica a pasta `app/` no GitHub Pages a cada atualização.
