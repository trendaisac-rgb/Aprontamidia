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

### Vídeo calmo do Maná (post do almoço)

- `mana/video/` é o projeto Remotion: foto de fundo com zoom lento, uma luz quente passando, poeira de luz,
  e o versículo acendendo frase por frase no ritmo da voz. Nada pisca nem pula.
- Uma peça é um JSON em `mana/video/pecas/V-00N.json` (gancho, referência do versículo, fecho, descrição da foto,
  trilha e voz). O texto do versículo vem da tabela `versiculos` (Bíblia Livre), nunca da peça.
- O workflow "Vídeo do Maná" roda sozinho quando uma peça nova entra, e grava `mana/videos/V-00N.mp4`.
- Voz e foto: OpenAI (segredo `OPENAI_API_KEY`). A leitura do versículo é conferida com o Whisper; se a voz
  pular ou trocar palavra, tenta de novo e, se ainda errar, o vídeo não sai.
- Trilhas: Mixkit, Stock Music Free License (liberada para vídeo em rede social, sem crédito). O número na peça
  é o id da faixa no Mixkit (ex.: 148 Forest Mist Whispers, 749 Relaxation 05, 587 Discover, 184 Vastness).
