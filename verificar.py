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

if falhas:
    print('FALHOU:')
    for f in falhas: print('  -', f)
    sys.exit(1)
print('verificação: tudo certo (%d ids, %d módulos)' % (len(usados), bloco.count('nome:')))
