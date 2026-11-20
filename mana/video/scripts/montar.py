"""Monta o props de uma oração a partir do alinhamento.
uso: montar.py chave pasta etiqueta referencia 'texto exato do banco' clipes(sep vírgula, banco/id) [quebras i:palavra,...] [filtros i:css;...]"""
import sys, json, re, subprocess, importlib.util
chave, pasta, etiqueta, refer, banco, clipes = sys.argv[1:7]
quebras = sys.argv[7] if len(sys.argv) > 7 else ''
filtros_arg = sys.argv[8] if len(sys.argv) > 8 else ''
a = json.load(open(f'.tmp/{chave}/alinhado.json')); P = a['palavras']
bw = banco.split()
norm = lambda w: re.sub(r'[^\wáàâãéêíóôõúüç]', '', w.lower())
de = None
for i in range(len(P) - len(bw) + 1):
    if all(norm(P[i + k]['p']) == norm(bw[k]) for k in range(len(bw))): de = i; break
assert de is not None, 'versículo não achado na fala'
ate = de + len(bw)
for k, w in enumerate(bw):
    if P[de + k]['p'] != w: P[de + k]['t'] = w   # mostra na tela exatamente o texto do banco
assert ' '.join(P[de + k].get('t', P[de + k]['p']) for k in range(len(bw))) == banco
for q in [x for x in quebras.split('|') if x]:
    i, w = q.split(':'); marca = 'q'
    if i.startswith('+'): i, marca = i[1:], 'j'   # +i:palavra cola no bloco anterior
    i = int(i); assert P[i]['p'] == w, (i, P[i]['p'], w); P[i][marca] = True
fecho = round(P[-1]['f'] + 0.62, 2); total = round(fecho + 3.4, 2)
cl = [f'oracao/banco-{c}.mp4' for c in clipes.split(',')]
L = [float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'public/' + c])) for c in cl]
p = {'abertura': {'ate': 0}, 'palavras': P, 'versiculo': {'de': de, 'ate': ate}}
spec = importlib.util.spec_from_file_location('g', '.tmp/grupos_mod.py'); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
cand = sorted(set([round(P[a_]['i'] - 0.15, 2) for a_, b_, v_ in g.agrupar(p) if P[a_]['i'] > 1.5] + [round(P[k]['i'] - 0.1, 2) for k in range(de + 1, ate) if re.search(r'[,;:.]$', P[k - 1]['p'])]))
import os
if os.environ.get('SO_GRUPOS'):
    for a_, b_, v_ in g.agrupar(p):
        print(('V ' if v_ else '  ') + f"{a_:3d} {P[a_]['i']:5.1f}  " + ' '.join(w.get('t', w['p']) for w in P[a_:b_]))
    print('total', total, 'clipes', [round(x,2) for x in L]); sys.exit(0)
n = len(cl); trocas = [0.0]
manual = [float(x) for x in sys.argv[9].split(',')] if len(sys.argv) > 9 and sys.argv[9] else None
if manual: trocas = manual
for k in (range(1, n) if not manual else []):
    ideal = trocas[-1] + (total - trocas[-1]) / (n - k + 1)
    ok = [c for c in cand if c > trocas[-1] + 2.5 and c - trocas[-1] <= L[k - 1] - (0.8 if k > 1 else 0.1)]
    assert ok, f'sem ponto de troca para o clipe {k}'
    trocas.append(min(ok, key=lambda c: abs(c - ideal)))
for k in range(n):
    passo = (trocas[k + 1] if k + 1 < n else total) - trocas[k]
    assert L[k] >= passo + (0.8 if k else 0.1), f'clipe {cl[k]} curto: {L[k]:.2f} < {passo:.2f}'
filtros = [None] * n
for f in [x for x in filtros_arg.split(';') if x]:
    i, css = f.split(':', 1); filtros[int(i)] = css
d = {'voz': f'oracao/{pasta}/voz.wav', 'trilha': 'oracao/trilhas/148.mp3', 'volumeTrilha': 0.16, 'trilhaInicio': 20,
     'duracao': total, 'clipes': cl, 'trocas': trocas, 'filtros': filtros,
     'abertura': {'titulo': '', 'dia': '', 'ate': 0}, 'etiqueta': etiqueta, 'palavras': P,
     'versiculo': {'de': de, 'ate': ate, 'referencia': refer},
     'fecho': {'inicio': fecho, 'sub': 'A Bíblia no seu feed. Grátis para ler na App Store e no Google Play.', 'arroba': '@mana.biblia.app'},
     'conferir': [{'cita': banco, 'referencia': refer}], 'roteiro': open(f'.tmp/{chave}/roteiro.txt', encoding='utf-8').read().strip()}
json.dump(d, open(f'oracao/{pasta}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('total', total, 'trocas', trocas)
for a_, b_, v_ in g.agrupar(d):
    print(('V ' if v_ else '  ') + f"{a_:3d} {P[a_]['i']:5.1f}  " + ' '.join(w.get('t', w['p']) for w in P[a_:b_]))
