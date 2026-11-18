#!/usr/bin/env python3
"""Alinha um roteiro à narração sem reconhecimento de fala.
Mede os trechos de fala entre as pausas do áudio e reparte as palavras entre eles pelo número de sílabas
(programação dinâmica), preferindo quebrar onde há pontuação. Saída: tempo de início e fim de cada palavra.
Uso: alinhar.py voz.wav roteiro.txt saida.json"""
import sys, re, json, subprocess

def pausas(wav, db=-38, d=0.20):
    out = subprocess.run(['ffmpeg', '-nostats', '-i', wav, '-af', f'silencedetect=n={db}dB:d={d}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    ini = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    fim = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                               capture_output=True, text=True).stdout)
    if len(fim) < len(ini): fim.append(dur)
    sil = list(zip(ini, fim))
    fala, t = [], 0.0
    for a, b in sil:
        if a - t > 0.16: fala.append((t, a))  # menos que isso é respiro ou estalo, não palavra
        t = b
    if dur - t > 0.08: fala.append((t, dur))
    # respiro longo passa pelo filtro de duração: tira o trecho muito mais baixo que a fala (15 dB abaixo da mediana)
    try:
        import soundfile as sf, numpy as np
        x, sr = sf.read(wav)
        if x.ndim > 1: x = x.mean(axis=1)
        nivel = [10 * np.log10(np.mean(x[int(a * sr):int(b * sr)] ** 2) + 1e-12) for a, b in fala]
        med = float(np.median(nivel))
        fala = [ab for ab, n in zip(fala, nivel) if n > med - 15]
    except ImportError:
        pass
    return fala, dur

def silabas(p):
    p = re.sub(r'[^a-záàâãéêíóôõúüç]', '', p.lower())
    n = len(re.findall(r'[aeiouáàâãéêíóôõúü]+', p))
    n += len(re.findall(r'(?:ia|io|ua|uo|ea|eo|oa)(?=[^aeiou]|$)', p)) * 0  # ditongos contam como uma
    return max(1, n)

def main():
    wav, txt, sai = sys.argv[1:4]
    texto = open(txt, encoding='utf-8').read().split()
    peso = [silabas(w) + 0.35 for w in texto]
    # custo de quebrar depois da palavra i: barato se termina em pontuação
    def quebra(i):
        w = texto[i]
        if re.search(r'(\.\.\.|[.!?;:])$', w): return 0.0
        if w.endswith(','): return 0.15
        return 1.2
    fala, dur = pausas(wav)
    M, W = len(fala), len(texto)
    d = [b - a for a, b in fala]
    taxa = sum(d) / sum(peso)
    pre = [0.0]
    for x in peso: pre.append(pre[-1] + x)
    INF = 1e18
    custo = [[INF] * (W + 1) for _ in range(M + 1)]
    volta = [[0] * (W + 1) for _ in range(M + 1)]
    custo[0][0] = 0.0
    for j in range(1, M + 1):
        for w in range(j, W + 1):
            melhor, arg = INF, -1
            for k in range(max(j - 1, w - 40), w):
                if custo[j - 1][k] >= INF: continue
                esperado = (pre[w] - pre[k]) * taxa
                c = custo[j - 1][k] + (d[j - 1] - esperado) ** 2 + (quebra(w - 1) if w < W else 0.0) * 0.25
                if c < melhor: melhor, arg = c, k
            custo[j][w], volta[j][w] = melhor, arg
    cortes, w = [], W
    for j in range(M, 0, -1):
        k = volta[j][w]; cortes.append((k, w)); w = k
    cortes.reverse()
    palavras = []
    for (a, b), (t0, t1) in zip(cortes, fala):
        tot = sum(peso[a:b]); t = t0
        for i in range(a, b):
            dt = (t1 - t0) * peso[i] / tot
            palavras.append({'p': texto[i], 'i': round(t, 3), 'f': round(t + dt, 3)})
            t += dt
    json.dump({'duracao': dur, 'palavras': palavras, 'trechos': [[round(a, 2), round(b, 2), ' '.join(texto[x:y])] for (x, y), (a, b) in zip(cortes, fala)]},
              open(sai, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ruins = sum(1 for (x, y) in cortes[:-1] if quebra(y - 1) > 1)
    print(f'{W} palavras, {M} trechos de fala, {ruins} quebra(s) fora de pontuação, taxa {taxa:.3f} s/sílaba')
    for (x, y), (a, b) in zip(cortes, fala):
        print(f'{a:6.2f}-{b:6.2f} ({b-a:4.2f}s, esperado {(pre[y]-pre[x])*taxa:4.2f}) {" ".join(texto[x:y])}')

main()
