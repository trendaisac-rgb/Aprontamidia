#!/bin/bash
cd /home/claude/aprontamidia/mana/video
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
mkdir -p .tmp/curto ../videos/curtos
for k in "$@"; do
  echo "inicio $k $(date +%H:%M:%S)"
  npx remotion render src/index.ts Versiculo .tmp/curto/$k-bruto.mp4 --props=curtos/$k.json --browser-executable=$REMOTION_BROWSER --log=error --crf=20 --concurrency=2 --offthreadvideo-cache-size-in-bytes=600000000 > .tmp/curto/$k-render.log 2>&1
  r=$?; echo "render $k saida=$r"
  [ $r -eq 0 ] && .tmp/finalizar_curto.sh .tmp/curto/$k-bruto.mp4 ../videos/curtos/$k && echo "pronto $k $(date +%H:%M:%S)"
done
echo FIM
