#!/usr/bin/env python3
"""Corrige um alinhamento: mantém os trechos de fala medidos e redistribui as palavras pela contagem dada.
Uso: realinhar.py alinhado.json roteiro.txt 5,2,3,...  (palavras por trecho, na ordem)"""
import sys, json, re
ali, txt, cont = sys.argv[1:4]
a = json.load(open(ali, encoding='utf-8')); texto = open(txt, encoding='utf-8').read().split()
n = [int(x) for x in cont.split(',')]
tr = a['trechos']
assert len(n) == len(tr), f'{len(n)} contagens para {len(tr)} trechos'
assert sum(n) == len(texto), f'soma {sum(n)} != {len(texto)} palavras'
def silabas(p):
    p = re.sub(r'[^a-záàâãéêíóôõúüç]', '', p.lower())
    return max(1, len(re.findall(r'[aeiouáàâãéêíóôõúü]+', p)))
P, k, novos = [], 0, []
for (t0, t1, _), c in zip(tr, n):
    ws = texto[k:k + c]; peso = [silabas(w) + 0.35 for w in ws]; tot = sum(peso); t = t0
    for w, pw in zip(ws, peso):
        dt = (t1 - t0) * pw / tot; P.append({'p': w, 'i': round(t, 3), 'f': round(t + dt, 3)}); t += dt
    novos.append([t0, t1, ' '.join(ws)]); k += c
a['palavras'] = P; a['trechos'] = novos
json.dump(a, open(ali, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for t0, t1, s in novos: print(f'{t0:6.2f}-{t1:6.2f} {s}')
