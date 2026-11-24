# Voz das orações do Maná (Gemini TTS no AI Studio)

Conta: trendaisac@gmail.com, aistudio.google.com/generate-speech, "Create new dialog", Speaker 1 = Lumi.

Estilo da manhã:
Voz feminina brasileira, calma e acolhedora, como quem ora junto com uma amiga logo cedo. Ritmo tranquilo, pausas naturais nas reticências e entre as frases, tom de carinho e esperança, sem dramatizar. Articulação clara, pronunciando todas as sílabas de cada palavra até o fim.

Estilo da noite:
Voz feminina brasileira, calma e acolhedora, mais baixa e mais lenta, como quem fala com alguém antes de dormir. Pausas naturais nas reticências e entre as frases, tom de paz e carinho, sem dramatizar. Articulação clara, pronunciando todas as sílabas de cada palavra até o fim.

No roteiro da voz, escrever "Senhor" (a tela mostra SENHOR, do banco).

Conferência do versículo falado: o whisper erra de forma sistemática futuro em -ei ("ficarei" vira "ficaria"), final -o antes de consoante ("levanto" vira "levanta") e insere "a" entre palavras ("ouça tua" vira "ouça a tua"). Quando os dois modelos discordam, medir os formantes da vogal em dúvida com Praat (pip install praat-parselmouth): [u] tem F1 perto de 250 e F2 perto de 1000; [a] tem F1 acima de 900 nessa voz.
