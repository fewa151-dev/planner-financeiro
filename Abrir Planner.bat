@echo off
rem Abre o Planner Financeiro: inicia o servidor local (cotacoes) e o navegador.
cd /d "%~dp0"
start "Planner Financeiro" /min python server.py --abrir
