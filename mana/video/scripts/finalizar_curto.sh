#!/bin/bash
# uso: finalizar.sh <bruto.mp4> <saida-sem-extensao>  (gera .mp4 normalizado em -16 LUFS e -capa.jpg)
set -e
B=$1; S=$2
M=$(ffmpeg -hide_banner -nostats -i $B -af "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
read II ITP ILRA ITH OFF < <(echo "$M" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")
ffmpeg -v error -y -i $B -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$II:measured_TP=$ITP:measured_LRA=$ILRA:measured_thresh=$ITH:offset=$OFF:linear=true" -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart $S.mp4
ffmpeg -v error -y -ss 0 -i $S.mp4 -frames:v 1 -q:v 2 $S-capa.jpg
echo "$(ffmpeg -hide_banner -nostats -i $S.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E 'I:' | tail -1 | xargs) | $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 $S.mp4)"
