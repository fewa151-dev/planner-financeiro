# Planner Financeiro

App pessoal de finanças: orçamento do mês, contas a pagar, dívidas e cartões, reserva de contingência,
investimentos, patrimônio e orçamento anual. Funciona no PC e no celular e pode ser instalado como app.

**Abrir o app:** https://fewa151-dev.github.io/planner-financeiro/

## Seus dados
Os dados ficam salvos no próprio aparelho (no navegador). Nada é enviado para este repositório.
Para usar os mesmos dados em vários aparelhos, ligue **Ajustes → Sincronização · Google Drive**: os dados vão para
um arquivo no seu próprio Google Drive, por um script que roda na sua conta (`planner-apps-script.gs`).
O backup em arquivo (**Ajustes → Exportar / Importar backup**) continua disponível.

## Estrutura
- `app/`: o app publicado (página, manifesto, service worker e ícones).
- `planner-apps-script.gs`: script gratuito (Google Apps Script) que sincroniza os dados pelo Google Drive e busca as cotações. O passo a passo está no topo do arquivo.
- `server.py` e `Abrir Planner.bat`: servidor local opcional para usar no PC com cotações sem o Apps Script.
- `.github/workflows/pages.yml`: publica a pasta `app/` no GitHub Pages a cada atualização.
- `desktop/`: instalador para Windows (um .exe que instala atalhos e abre o app numa janela do Edge).
  `compilar.bat` gera o .exe com o compilador C# que já vem no Windows.
