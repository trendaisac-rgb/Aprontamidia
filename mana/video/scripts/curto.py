"""Vídeo curto de versículo do Maná, sem voz (teste de volume no TikTok, nov/2026).

uso: python3 scripts/curto.py curtos/<semana>.json   -> escreve curtos/<chave>.json (props da composição Versiculo)

Cada item da semana: chave, db (ref do banco), ref (escrita), texto (o versículo EXATO do banco, conferido por hash
antes), gancho (com *destaque*), imagem (clipe do banco, 10 s), trilhaInicio.

O tempo segue leitura, não voz: o gancho já está na tela no quadro 0, cada frase do versículo acende no ritmo de
leitura (16 caracteres por segundo), o versículo inteiro fica parado um tempo para ler de novo, e fecha com a marca.
"""
import json, re, sys

FECHO = 'A Bíblia no seu feed. *Grátis para ler* na App Store e no Google Play.'
CPS = 16.0


def frases(texto):
    partes = [p for p in re.split(r'(?<=[,;:.?!])\s+', texto) if p]
    out = []
    for p in partes:
        if out and (len(p) < 14 or len(out[-1]) < 14):
            out[-1] = out[-1] + ' ' + p
        else:
            out.append(p)
    assert ' '.join(out) == texto, 'a divisão mudou o texto'
    return out


def props(x):
    g_fim = max(1.8, len(x['gancho'].replace('*', '')) / 15)
    t = round(g_fim + 1.0, 2)
    lista = []
    for f in frases(x['texto']):
        lista.append({'texto': f, 'inicio': round(t, 2)})
        t += max(1.3, len(f) / CPS)
    fim_leitura = t
    ref_inicio = round(fim_leitura + 0.2, 2)
    fecho = round(fim_leitura + max(2.2, len(x['texto']) / 45) + 0.8, 2)
    dur = round(fecho + 3.8, 2)
    return {
        'imagem': x['imagem'],
        'ritmo': round(min(1.0, 9.8 / dur), 3),
        'voz': None,
        'trilha': 'oracao/trilhas/148.mp3',
        'trilhaInicio': x.get('trilhaInicio', 0),
        'duracao': dur,
        'gancho': {'tela': x['gancho'], 'inicio': -1.0, 'fim': round(g_fim, 2)},
        'versiculo': {'frases': lista, 'inicio': lista[0]['inicio'], 'referencia': x['ref'], 'refInicio': ref_inicio},
        'fecho': {'tela': FECHO, 'inicio': fecho},
        'arroba': '@mana.biblia.app',
    }


if __name__ == '__main__':
    semana = json.load(open(sys.argv[1]))
    for x in semana:
        p = props(x)
        json.dump(p, open(f"curtos/{x['chave']}.json", 'w'), ensure_ascii=False, indent=1)
        print(x['chave'], p['duracao'], 's', len(p['versiculo']['frases']), 'frases', 'ritmo', p['ritmo'])
