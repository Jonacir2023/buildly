#!/usr/bin/env python3
"""Confere o que o olho não pega: id usado sem existir, módulo pronto sem
tela, tela sem carregador. Roda antes de qualquer push."""
import re, sys
J = open('/home/user/buildly/app.js').read()
H = open('/home/user/buildly/index.html').read()
falhas = []

usados = set(re.findall(r"\$\('([^']+)'\)", J))
existem = set(re.findall(r'id="([^"]+)"', H))
for i in sorted(usados - existem):
    falhas.append('o JS usa o id "%s" que não existe no HTML' % i)

bloco = J[J.index('const MODULOS'):J.index('];', J.index('const MODULOS'))]
for linha in bloco.split('\n'):
    if 'nome:' not in linha: continue
    nome = re.search(r"nome: '([^']+)'", linha).group(1)
    pronto = 'pronto: true' in linha
    tela = re.search(r"tela: '([^']+)'", linha)
    if pronto and not tela:
        falhas.append('módulo "%s" está pronto mas não diz qual tela abre' % nome)
    elif pronto:
        t = tela.group(1)
        if 'id="tela-%s"' % t not in H:
            falhas.append('módulo "%s" aponta para tela-%s, que não existe' % (nome, t))
        if "$('tela-%s').hidden" % t not in J:
            falhas.append('tela-%s não é escondida pelo roteador' % t)
        if "if (tela === '%s')" % t not in J:
            falhas.append('tela-%s não tem carregador no roteador' % t)
    elif tela:
        falhas.append('módulo "%s" tem tela mas está marcado em construção' % nome)

# Colisão de nome de classe: um modificador aplicado no JS que também é
# um componente no CSS herda fundo, borda e espaçamento dele. Aconteceu
# com .num (quadro do painel) e .aviso (caixa de mensagem).
C = open('/home/user/buildly/estilo.css').read()
COMPONENTES = {m for m in re.findall(r'^\.([a-z][a-z0-9-]*)\s*\{', C, re.M)}
for classe, modificador in re.findall(r"className\s*=\s*'([a-z-]+)'\s*\+\s*\([^)]*'\s+([a-z-]+)'", J):
    if modificador in COMPONENTES and modificador not in ('lido','atrasada','baixada','encerrada','apagado'):
        falhas.append('a classe "%s" é usada como modificador de "%s" e também é um componente no CSS'
                      % (modificador, classe))

if falhas:
    print('FALHOU:')
    for f in falhas: print('  -', f)
    sys.exit(1)
print('verificação: tudo certo (%d ids, %d módulos)' % (len(usados), bloco.count('nome:')))
