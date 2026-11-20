"""Transcreve cada trecho de fala do alinhamento e mostra lado a lado com o texto atribuído."""
import sys, json, subprocess, soundfile as sf, sherpa_onnx
M='/home/claude/modelos/sherpa-onnx-whisper-small'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{M}/small-encoder.int8.onnx',decoder=f'{M}/small-decoder.int8.onnx',tokens=f'{M}/small-tokens.txt',language='pt',task='transcribe',num_threads=2)
wav, ali = sys.argv[1:3]
for a,b,t in json.load(open(ali,encoding='utf-8'))['trechos']:
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(max(0,a-0.05)),'-to',str(b+0.05),'-i',wav,'-ac','1','-ar','16000','/tmp/_c.wav'])
    x,sr=sf.read('/tmp/_c.wav',dtype='float32'); s=rec.create_stream(); s.accept_waveform(sr,x); rec.decode_stream(s)
    print(f'{a:6.2f}-{b:6.2f} | {t:<45} | {s.result.text.strip()}')
