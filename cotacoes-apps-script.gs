/**
 * Serviço de cotações do Planner Financeiro (Google Apps Script, gratuito).
 *
 * Para que serve: o Yahoo Finance não aceita chamadas diretas do navegador. Este script fica na sua
 * conta Google e faz esse pedido no lugar do app, em qualquer aparelho (substitui o server.py do PC).
 *
 * Como publicar (uma vez só, ~3 minutos):
 *   1. Abra https://script.google.com e clique em "Novo projeto".
 *   2. Apague o conteúdo do editor, cole TODO este arquivo e salve (ícone de disquete). Dê um nome, ex.: "Cotações Planner".
 *   3. Clique em "Implantar" → "Nova implantação". Na engrenagem de "Selecionar tipo", escolha "App da Web".
 *   4. Em "Executar como", deixe "Eu". Em "Quem pode acessar", escolha "Qualquer pessoa".
 *   5. Clique em "Implantar" e autorize o acesso quando o Google pedir (é o seu próprio script).
 *   6. Copie a "URL do app da Web" (termina em /exec) e cole no planner em Ajustes → Serviço de cotações.
 *      Clique em "Testar": deve aparecer o preço da PETR4.
 *
 * O script só repassa pedidos de cotação (ticker, período e intervalo) e não recebe nem guarda dados seus.
 */
const RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'];
const INTERVALOS = ['1d', '1wk', '1mo'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const simbolo = String(p.symbol || '');
  const faixa = p.range || '1y';
  const intervalo = p.interval || '1d';
  if (!/^[A-Za-z0-9.^=\-]{1,24}$/.test(simbolo) || RANGES.indexOf(faixa) < 0 || INTERVALOS.indexOf(intervalo) < 0) {
    return json_({ erro: 'parametros invalidos' });
  }
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(simbolo) +
              '?range=' + faixa + '&interval=' + intervalo + '&includePrePost=false';
  const cache = CacheService.getScriptCache();
  const chave = [simbolo, faixa, intervalo].join('|');
  const guardado = cache.get(chave);
  if (guardado) return texto_(guardado);
  try {
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const corpo = r.getContentText();
    if (r.getResponseCode() === 200 && corpo.length < 95000) cache.put(chave, corpo, 300);   // guarda 5 minutos
    return texto_(corpo);
  } catch (err) {
    return json_({ erro: 'Sem conexão com o provedor de cotações: ' + err });
  }
}

function texto_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON); }
function json_(o) { return texto_(JSON.stringify(o)); }
