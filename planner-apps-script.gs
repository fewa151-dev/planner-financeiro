/**
 * Planner Financeiro: script da sua conta Google (gratuito). Faz duas coisas:
 *   1. Sincronização: guarda os dados do planner num arquivo do seu Google Drive (pasta "Planner Financeiro")
 *      para todos os seus aparelhos usarem os mesmos dados, com uma cópia por dia na subpasta "Versões".
 *   2. Cotações: busca preços de ações, câmbio e índices no Yahoo Finance (que não aceita chamadas diretas do app).
 *
 * Como publicar (uma vez só, ~5 minutos, no computador):
 *   1. Abra https://script.google.com e clique em "Novo projeto".
 *   2. Apague o conteúdo do editor, cole TODO este arquivo e salve (ícone de disquete). Dê um nome, ex.: "Planner".
 *   3. Clique em "Implantar" → "Nova implantação". Na engrenagem de "Selecionar tipo", escolha "App da Web".
 *   4. Em "Executar como", deixe "Eu". Em "Quem pode acessar", escolha "Qualquer pessoa".
 *   5. Clique em "Implantar". O Google pede autorização: escolha sua conta. Se aparecer "O Google não verificou
 *      este app", clique em "Avançado" → "Acessar Planner (não seguro)": o app é este script, seu, na sua conta.
 *   6. Copie a "URL do app da Web" (termina em /exec).
 *   7. No planner: Ajustes → Sincronização → cole o endereço → Conectar.
 *      Nos outros aparelhos, use o link de "Conectar outro aparelho" (não precisa repetir estes passos).
 *
 * Atualizar o código depois: cole o código novo, salve e vá em "Implantar" → "Gerenciar implantações" → lápis →
 * "Versão: Nova versão" → "Implantar". Assim o endereço continua o mesmo.
 *
 * Segurança: o primeiro aparelho que conecta registra uma chave secreta; sem ela, ninguém lê nem grava os dados,
 * mesmo com o endereço. Se perder todos os aparelhos conectados, rode a função "redefinirChave" aqui no editor
 * (menu de funções ao lado de "Executar") e conecte de novo: os dados do Drive continuam lá.
 */
const NOME_PASTA = 'Planner Financeiro';
const NOME_ARQUIVO = 'planner-dados.json';
const FUSO = 'America/Sao_Paulo';
const DIAS_GUARDADOS = 120;      // cópias diárias mantidas na pasta Versões
const OUTRAS_GUARDADAS = 40;     // cópias de segurança (antes de substituir, restaurar, apagar)

/* ---------------- cotações (GET) ---------------- */
const RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'];
const INTERVALOS = ['1d', '1wk', '1mo'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.symbol) return json_({ ok: true, servico: 'planner', sincronizacao: true });
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

/* ---------------- sincronização (POST) ---------------- */
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ erro: 'Pedido inválido.' }); }
  if (!req || typeof req.chave !== 'string' || req.chave.length < 24) return json_({ erro: 'Pedido sem chave.' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ erro: 'O Drive está ocupado. Tente de novo em instantes.' });
  try {
    const props = PropertiesService.getScriptProperties();
    const chave = props.getProperty('CHAVE');
    if (req.acao === 'registrar') {
      if (!chave) props.setProperty('CHAVE', req.chave);
      else if (chave !== req.chave) {
        return json_({ erro: 'Este script já está ligado a outro aparelho. Use o link de "Conectar outro aparelho", ' +
                             'gerado no aparelho já conectado (Ajustes → Sincronização).' });
      }
      return json_(info_(props));
    }
    if (!chave) return json_({ erro: 'Este script ainda não foi conectado. Use Ajustes → Sincronização → Conectar.' });
    if (chave !== req.chave) { Utilities.sleep(1000); return json_({ erro: 'Chave inválida. Conecte este aparelho de novo.' }); }

    switch (req.acao) {
      case 'info': return json_(info_(props));
      case 'baixar': {
        const r = info_(props);
        const atual = lerAtual_();
        r.dados = atual ? JSON.parse(atual) : null;
        return json_(r);
      }
      case 'enviar': {
        const dados = req.dados;
        if (!dados || typeof dados !== 'object' || !Array.isArray(dados.parcelas) || !Array.isArray(dados.ganhos)) {
          return json_({ erro: 'Os dados enviados não parecem do planner.' });
        }
        const rev = Number(props.getProperty('REV') || 0);
        if (!req.forcar && Number(req.baseRev || 0) !== rev) {
          const r = info_(props); r.conflito = true; return json_(r);
        }
        const anterior = lerAtual_();
        if (anterior) {
          if (req.forcar) guardarCopia_(anterior, 'antes de substituir');
          guardarDia_(anterior);   // como estava no início do dia (só na 1ª gravação de cada dia)
        }
        escreverAtual_(JSON.stringify(dados));
        const agora = new Date().toISOString();
        props.setProperties({
          REV: String(rev + 1), ATUALIZADO: agora,
          DISPOSITIVO: String(req.dispositivo || '').slice(0, 40), HASH: String(req.hash || '').slice(0, 40),
        });
        return json_({ ok: true, rev: rev + 1, atualizado: agora });
      }
      case 'guardarVersao': {
        if (!req.dados || typeof req.dados !== 'object') return json_({ erro: 'Nada para guardar.' });
        guardarCopia_(JSON.stringify(req.dados), String(req.motivo || 'cópia').slice(0, 40) + ' - ' + String(req.dispositivo || '').slice(0, 30));
        return json_({ ok: true });
      }
      case 'versoes': {
        const lista = [];
        const it = pastaVersoes_().getFiles();
        while (it.hasNext()) {
          const f = it.next();
          lista.push({ id: f.getId(), nome: f.getName().replace(/\.json$/, ''), data: f.getLastUpdated().toISOString(), tamanho: f.getSize() });
        }
        lista.sort(function (a, b) { return a.data < b.data ? 1 : -1; });
        return json_({ ok: true, versoes: lista.slice(0, 80) });
      }
      case 'versao': {
        const f = DriveApp.getFileById(String(req.id || ''));
        const pai = f.getParents();
        if (!pai.hasNext() || pai.next().getId() !== pastaVersoes_().getId()) return json_({ erro: 'Versão não encontrada.' });
        return json_({ ok: true, nome: f.getName(), dados: JSON.parse(f.getBlob().getDataAsString('UTF-8')) });
      }
    }
    return json_({ erro: 'Ação desconhecida: ' + req.acao });
  } catch (err) {
    return json_({ erro: 'Erro no script: ' + err });
  } finally {
    lock.releaseLock();
  }
}

/* rode aqui no editor só se perder todos os aparelhos conectados: o próximo que conectar registra uma chave nova */
function redefinirChave() {
  PropertiesService.getScriptProperties().deleteProperty('CHAVE');
  Logger.log('Chave apagada. Conecte o planner de novo em Ajustes → Sincronização. Os dados do Drive continuam guardados.');
}

function info_(props) {
  return {
    ok: true,
    conta: Session.getEffectiveUser().getEmail(),
    rev: Number(props.getProperty('REV') || 0),
    atualizado: props.getProperty('ATUALIZADO') || '',
    dispositivo: props.getProperty('DISPOSITIVO') || '',
    hash: props.getProperty('HASH') || '',
  };
}

function pasta_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA');
  if (id) { try { const p = DriveApp.getFolderById(id); if (!p.isTrashed()) return p; } catch (e) {} }
  const p = DriveApp.createFolder(NOME_PASTA);
  props.setProperty('PASTA', p.getId());
  return p;
}
function pastaVersoes_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('VERSOES');
  if (id) { try { const p = DriveApp.getFolderById(id); if (!p.isTrashed()) return p; } catch (e) {} }
  const p = pasta_().createFolder('Versões');
  props.setProperty('VERSOES', p.getId());
  return p;
}
function arquivo_(criar) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ARQUIVO');
  if (id) { try { const f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  if (!criar) return null;
  const f = pasta_().createFile(NOME_ARQUIVO, '{}', 'application/json');
  props.setProperty('ARQUIVO', f.getId());
  return f;
}
function lerAtual_() {
  const f = arquivo_(false);
  if (!f) return null;
  const t = f.getBlob().getDataAsString('UTF-8');
  return t && t !== '{}' ? t : null;
}
function escreverAtual_(texto) { arquivo_(true).setContent(texto); }

function hoje_(formato) { return Utilities.formatDate(new Date(), FUSO, formato); }
function guardarDia_(texto) {
  const nome = hoje_('yyyy-MM-dd') + '.json';
  const pasta = pastaVersoes_();
  if (pasta.getFilesByName(nome).hasNext()) return;
  pasta.createFile(nome, texto, 'application/json');
  limpar_(pasta, /^\d{4}-\d{2}-\d{2}\.json$/, DIAS_GUARDADOS);
}
function guardarCopia_(texto, motivo) {
  const pasta = pastaVersoes_();
  pasta.createFile(hoje_('yyyy-MM-dd HH-mm') + ' ' + motivo.replace(/[\\/:*?"<>|]/g, '') + '.json', texto, 'application/json');
  limpar_(pasta, /^\d{4}-\d{2}-\d{2} \d{2}-\d{2} /, OUTRAS_GUARDADAS);
}
/* manda para a lixeira do Drive as cópias mais antigas além do limite */
function limpar_(pasta, padrao, manter) {
  const arquivos = [];
  const it = pasta.getFiles();
  while (it.hasNext()) { const f = it.next(); if (padrao.test(f.getName())) arquivos.push(f); }
  arquivos.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  arquivos.slice(manter).forEach(function (f) { f.setTrashed(true); });
}

function texto_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON); }
function json_(o) { return texto_(JSON.stringify(o)); }
