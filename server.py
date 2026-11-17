"""Servidor local do Planner Financeiro.

Serve os arquivos desta pasta e repassa pedidos de cotação ao Yahoo Finance
(o navegador não consegue chamar o Yahoo direto por causa do CORS).
Só usa a biblioteca padrão do Python.

Uso:  python server.py            (só inicia)
      python server.py --abrir    (inicia e abre o index.html no navegador)

O planner é aberto como arquivo (file://) para os dados continuarem no mesmo
lugar do navegador de sempre; a página busca as cotações em localhost:5178.
"""
from pathlib import Path
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORTA = int(os.environ.get("PLANNER_PORTA", "5178"))
PASTA = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(PASTA, "app")          # o app instalável fica em app/
URL = Path(RAIZ, "index.html").as_uri()

RANGES = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"}
INTERVALOS = {"1d", "1wk", "1mo"}
SIMBOLO_OK = re.compile(r"^[A-Za-z0-9.^=\-]{1,24}$")
CACHE_SEG = 300
_cache = {}
_trava = threading.Lock()


def buscar(url):
    agora = time.time()
    with _trava:
        item = _cache.get(url)
        if item and agora - item[0] < CACHE_SEG:
            return 200, item[1]
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status, corpo = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, corpo = e.code, e.read()
    except Exception as e:  # sem internet, DNS, timeout...
        return 502, json.dumps({"erro": f"Sem conexão com o provedor de cotações: {e}"}).encode()
    if status == 200:
        with _trava:
            _cache[url] = (agora, corpo)
    return status, corpo


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/chart":
            return self.chart(urllib.parse.parse_qs(u.query))
        if u.path == "/api/ping":
            return self.json(200, b'{"ok":true}')
        return super().do_GET()

    def chart(self, q):
        simbolo = (q.get("symbol") or [""])[0]
        faixa = (q.get("range") or ["1y"])[0]
        intervalo = (q.get("interval") or ["1d"])[0]
        if not SIMBOLO_OK.match(simbolo) or faixa not in RANGES or intervalo not in INTERVALOS:
            return self.json(400, b'{"erro":"parametros invalidos"}')
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(simbolo)}"
               f"?range={faixa}&interval={intervalo}&includePrePost=false")
        status, corpo = buscar(url)
        self.json(status, corpo)

    def json(self, status, corpo):
        self.send_response(status)
        # liberado para a página aberta direto do disco (file://), que tem origem "null"
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, fmt, *args):  # silencioso
        pass


def main():
    abrir = "--abrir" in sys.argv
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORTA), Handler)
    except OSError:
        # já existe um servidor nessa porta (provavelmente o próprio planner): só abre o navegador
        if abrir:
            webbrowser.open(URL)
        print(f"O servidor de cotações já está rodando na porta {PORTA}.")
        return
    print(f"Servidor de cotações do Planner rodando em http://localhost:{PORTA}/  (feche esta janela para parar)")
    if abrir:
        threading.Timer(0.8, lambda: webbrowser.open(URL)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
