"""Endereços 9:16 (TikTok) das peças de carrossel do teste de volume. uso: carrossel_tt.py <arquivo.json> -> imprime nome e URLs."""
import json, base64, sys
FINAL_S = "A Bíblia no seu feed. Grátis para ler na App Store e no Google Play."
TETOS = {'capa': (90, 110, 30), 'versiculo': (60, 0, 30), 'texto': (160, 140, 30), 'app': (70, 0, 0), 'final': (90, 110, 0)}
base = "https://zknabgosqnxqzattoncg.supabase.co/functions/v1/slides/v1/"
def url(s):
    c = base64.urlsafe_b64encode(json.dumps(s, ensure_ascii=False, separators=(",", ":")).encode()).decode().rstrip("=")
    assert 8 <= len(c) <= 1400
    return base + c + ".jpg"
out = {}
for p in json.load(open(sys.argv[1])):
    urls = []
    for s in p["slides"]:
        if s["m"] == "final":
            s["s"] = FINAL_S
        tt, ts, te = TETOS[s["m"]]
        for campo, teto in (("t", tt), ("s", ts), ("e", te)):
            v = s.get(campo, "").replace("*", "")
            assert len(v) <= teto, (p["nome"], s["m"], campo, len(v), teto)
            assert '"' not in v and '“' not in v and '”' not in v
        urls.append(url({**s, "r": "9:16"}))
    assert len(p["titulo"]) <= 90
    out[p["nome"]] = urls
json.dump(out, open(sys.argv[1].replace(".json", ".urls.json"), "w"), indent=1)
print(json.dumps(out))
