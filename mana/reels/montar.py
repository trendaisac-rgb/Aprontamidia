#!/usr/bin/env python3
"""
Reel do Maná a partir dos slides 9:16 do carrossel (nov/2026).

Uso: python3 montar.py peca.json pasta_de_saida [trilha.mp3]

peca.json:
  {"nome": "R-20261104", "slides": ["https://.../1.jpg", ...], "trilha": 148, "duracoes": [3.5, 6, 4.5, 5.5, 4]}
  - slides: os endereços dos slides 9:16 (os mesmos do TikTok), na ordem.
  - trilha: id da música no Mixkit (licença livre para redes, sem crédito). Opcional: sem ela, sai um padrão calmo.
  - duracoes: opcional. Sem ela, capa e final ficam menos tempo e os do meio mais (dá tempo de ler o versículo).

Sai <nome>.mp4 (1080x1920, 30 fps, H.264 + AAC, -14 LUFS) e <nome>-capa.jpg (o primeiro slide).
Movimento calmo: zoom lento em cada slide e transição de fade entre eles. Nada agitado.
"""
import json, os, subprocess, sys, urllib.request, shutil

FPS = 30
TRANSICAO = 0.7  # segundos de fade entre slides
TRILHAS_CALMAS = [148, 749, 22]  # Forest Mist Whispers, Relaxation 05, Piano Reflections


def baixar(url: str, destino: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "mana-reels"})
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, "wb") as f:
        shutil.copyfileobj(r, f)


def duracoes_padrao(n: int) -> list[float]:
    if n == 1:
        return [6.0]
    meio = [5.5] * (n - 2)
    if n >= 3:
        meio[0] = 6.0  # o slide 2 costuma ser o versículo
    return [3.5] + meio + [4.0]


def main() -> None:
    peca_arq, saida = sys.argv[1], sys.argv[2]
    trilha_local = sys.argv[3] if len(sys.argv) > 3 else None
    peca = json.load(open(peca_arq, encoding="utf-8"))
    nome = peca["nome"]
    os.makedirs(saida, exist_ok=True)
    tmp = os.path.join(saida, f".{nome}")
    os.makedirs(tmp, exist_ok=True)

    imagens = []
    for i, s in enumerate(peca["slides"], 1):
        destino = os.path.join(tmp, f"s{i}.jpg")
        if s.startswith("http"):
            baixar(s, destino)
        else:
            shutil.copy(s, destino)
        imagens.append(destino)

    dur = peca.get("duracoes") or duracoes_padrao(len(imagens))
    assert len(dur) == len(imagens), "uma duração por slide"

    if not trilha_local:
        tid = peca.get("trilha") or TRILHAS_CALMAS[int(nome[-2:]) % len(TRILHAS_CALMAS) if nome[-2:].isdigit() else 0]
        trilha_local = os.path.join(tmp, "trilha.mp3")
        baixar(f"https://assets.mixkit.co/music/{tid}/{tid}.mp3", trilha_local)

    # cada slide vira um trecho com zoom lento (1.00 -> 1.04), na mesma moldura 1080x1920
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for img in imagens:
        cmd += ["-i", img]
    cmd += ["-i", trilha_local]
    filtros = []
    for i, d in enumerate(dur):
        frames = int(round(d * FPS))
        passo = 0.04 / max(frames, 1)
        filtros.append(
            f"[{i}:v]scale=2160:3840,setsar=1,"
            f"zoompan=z='min(1+{passo:.6f}*on,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps={FPS},"
            f"format=yuv420p[v{i}]"
        )
    atual = "v0"
    acumulado = dur[0]
    for i in range(1, len(dur)):
        offset = acumulado - TRANSICAO
        filtros.append(f"[{atual}][v{i}]xfade=transition=fade:duration={TRANSICAO}:offset={offset:.3f}[x{i}]")
        atual = f"x{i}"
        acumulado = offset + dur[i]
    total = acumulado
    filtros.append(f"[{atual}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.8:.3f}:d=0.8[vout]")
    ia = len(imagens)
    filtros.append(
        f"[{ia}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.5,"
        f"afade=t=out:st={total - 2.5:.3f}:d=2.5,loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
    )
    mp4 = os.path.join(saida, f"{nome}.mp4")
    cmd += [
        "-filter_complex", ";".join(filtros),
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart", "-t", f"{total:.3f}", mp4,
    ]
    subprocess.run(cmd, check=True)
    shutil.copy(imagens[0], os.path.join(saida, f"{nome}-capa.jpg"))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{mp4} {total:.1f}s")


if __name__ == "__main__":
    main()
