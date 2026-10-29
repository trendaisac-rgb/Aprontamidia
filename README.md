# Aprontamidia

Imagens públicas dos posts do Apronta (@aprontaapp) no Instagram e no TikTok.

- `base/folhas/` são as folhas reais do Apronta (as mesmas de apronta.tech/exemplos), em JPEG.
  O gerador de slides do Apronta (função `slides`) busca a folha aqui quando o slide mostra uma.
- `P-004/` e as outras pastas de peça são carrosséis montados à mão, publicados pelo Metricool.

## Maná (@mana.biblia.app)

- `mana/` guarda os carrosséis do Maná, publicados pelo Metricool no Instagram, no Facebook e no TikTok.
- Cada peça tem os slides 4:5 (`M-00N-1.jpg`...) e os mesmos em 9:16 para o TikTok (`M-00N-1-tiktok.jpg`...).
- Os slides saem do gerador do app (`mobile/supabase/functions/_shared/slides.ts`). O texto do versículo vem
  da tabela `versiculos` (Bíblia Livre), nunca digitado à mão.
