// Gera o vídeo calmo do Maná a partir de uma peça (mana/video/pecas/V-00N.json).
//
// 1. Lê o versículo da tabela `versiculos` (Bíblia Livre) pela referência. O texto nunca é digitado à mão.
// 2. Narra cada parte com a OpenAI (gancho, ponte, versículo, referência, fecho), com pausas fixas entre elas.
// 3. Transcreve o versículo narrado (Whisper, com tempo de cada palavra): serve para acender cada frase na hora
//    em que é lida E para conferir que a voz leu o versículo certo. Se a leitura não bater, tenta de novo e,
//    se ainda não bater, o vídeo NÃO sai.
// 4. Gera a foto de fundo (OpenAI imagem), baixa a trilha (Mixkit, licença livre para rede social),
//    monta tudo no Remotion e normaliza o som em -14 LUFS.
//
// Uso: node scripts/gerar.mjs pecas/V-001.json   (precisa de OPENAI_API_KEY no ambiente)
// Saída: ../videos/<nome>.mp4 e ../videos/<nome>-capa.jpg (relativo a mana/video)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLICO = path.join(RAIZ, 'public');
const SAIDA = path.resolve(RAIZ, '..', 'videos');
const SUPABASE_URL = 'https://zknabgosqnxqzattoncg.supabase.co';
// chave pública (anon) do app: só lê o que o app já lê, como o texto da Bíblia
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const OPENAI = process.env.OPENAI_API_KEY;
const MODELO_VOZ = process.env.MANA_MODELO_VOZ || 'gpt-4o-mini-tts';
const MODELOS_IMAGEM = (process.env.MANA_MODELO_IMAGEM || 'gpt-image-2,gpt-image-1.5,gpt-image-1').split(',');
const FPS = 30;

const INSTRUCOES_VOZ =
  'Fale em português do Brasil, com sotaque brasileiro natural, de quem nasceu e cresceu no Brasil. ' +
  'Voz calma, acolhedora e serena, como alguém lendo a Bíblia em voz baixa para um amigo querido. ' +
  'Ritmo lento e pausado, respeitando vírgulas e pontos. Sem dramatizar e sem tom de locutor de rádio. ' +
  'Leia cada palavra exatamente como está escrita, sem trocar, pular ou acrescentar nada.';

const PAUSAS = { aposGancho: 0.55, aposPonte: 0.9, aposVersiculo: 0.9, aposReferencia: 0.6, cauda: 1.6, inicio: 0.35 };

if (!OPENAI) throw new Error('falta OPENAI_API_KEY');
if (!SUPABASE_ANON) throw new Error('falta SUPABASE_ANON_KEY');

const arqPeca = process.argv[2];
if (!arqPeca) throw new Error('uso: node scripts/gerar.mjs pecas/V-00N.json');
const peca = JSON.parse(readFileSync(path.resolve(RAIZ, arqPeca), 'utf8'));
const nome = peca.nome;
if (!/^V-\d{3}$/.test(nome)) throw new Error(`nome da peça: ${nome}`);
const TMP = path.join(RAIZ, '.tmp', nome);
mkdirSync(TMP, { recursive: true });
mkdirSync(SAIDA, { recursive: true });
mkdirSync(PUBLICO, { recursive: true });

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString();
const duracao = (arq) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).trim());

// ------------------------------------------------------------------ versículo

/** "PSA.23.1-3" -> ["PSA.23.1", "PSA.23.2", "PSA.23.3"] */
function refs(ref) {
  const m = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`referência inválida: ${ref}`);
  const [, livro, cap, de, ate] = m;
  const fim = ate ? Number(ate) : Number(de);
  if (fim < Number(de) || fim - Number(de) > 5) throw new Error(`trecho inválido: ${ref}`);
  return Array.from({ length: fim - Number(de) + 1 }, (_, i) => `${livro}.${cap}.${Number(de) + i}`);
}

async function lerVersiculo(ref) {
  const lista = refs(ref);
  const url = `${SUPABASE_URL}/rest/v1/versiculos?select=ref,texto&traducao=eq.blivre&ref=in.(${lista.join(',')})`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  if (!r.ok) throw new Error(`versiculos: ${r.status} ${await r.text()}`);
  const linhas = await r.json();
  const porRef = new Map(linhas.map((l) => [l.ref, l.texto]));
  const faltando = lista.filter((x) => !porRef.has(x));
  if (faltando.length) throw new Error(`versículo não encontrado: ${faltando.join(', ')}`);
  return lista.map((x) => porRef.get(x).trim()).join(' ');
}

/** Frases de tela: corta em ; : . ? ! e, se a frase ficar longa, também na vírgula. */
function frases(texto) {
  const partes = texto.match(/[^;:.?!]+[;:.?!]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [texto];
  const saida = [];
  for (const p of partes) {
    if (p.length <= 70) { saida.push(p); continue; }
    const pedacos = p.split(/(?<=,)\s+/);
    let atual = '';
    for (const q of pedacos) {
      if ((atual + ' ' + q).trim().length > 60 && atual) { saida.push(atual.trim()); atual = q; } else atual = (atual + ' ' + q).trim();
    }
    if (atual) saida.push(atual);
  }
  return saida;
}

// ------------------------------------------------------------------ OpenAI

async function openai(rota, corpo, tipo = 'json') {
  const ehForm = corpo instanceof FormData;
  const r = await fetch(`https://api.openai.com/v1/${rota}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, ...(ehForm ? {} : { 'Content-Type': 'application/json' }) },
    body: ehForm ? corpo : JSON.stringify(corpo),
  });
  if (!r.ok) {
    const err = new Error(`OpenAI ${rota}: ${r.status} ${(await r.text()).slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
  return tipo === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
}

/** Texto para a voz: "SENHOR" em caixa alta vira "Senhor" (a tela mantém o original). */
const paraFala = (s) => s.replace(/\bSENHOR\b/g, 'Senhor').replace(/\bDEUS\b/g, 'Deus');

async function narrar(texto, voz, arq) {
  const audio = await openai('audio/speech', {
    model: MODELO_VOZ, voice: voz, input: paraFala(texto), instructions: INSTRUCOES_VOZ, response_format: 'wav',
  }, 'bin');
  writeFileSync(arq, audio);
  return arq;
}

async function transcrever(arq) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(arq)], { type: 'audio/wav' }), path.basename(arq));
  form.append('model', 'whisper-1');
  form.append('language', 'pt');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  return openai('audio/transcriptions', form);
}

const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/** Distância de edição entre listas de palavras. */
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

async function imagem(prompt, arq) {
  const texto =
    `${prompt}. Fotografia real, vertical, feita com câmera, luz natural suave, tons calmos e quentes, ` +
    'sem pessoas, sem rostos, sem mãos, sem texto, sem letras, sem logotipos, sem molduras. Parece uma foto de verdade, não uma ilustração.';
  let ultimoErro;
  for (const model of MODELOS_IMAGEM) {
    try {
      const r = await openai('images/generations', { model: model.trim(), prompt: texto, size: '1024x1536', quality: 'high', n: 1 });
      const b64 = r.data?.[0]?.b64_json;
      if (b64) { writeFileSync(arq, Buffer.from(b64, 'base64')); console.log(`imagem: ${model}`); return arq; }
      if (r.data?.[0]?.url) { writeFileSync(arq, Buffer.from(await (await fetch(r.data[0].url)).arrayBuffer())); console.log(`imagem: ${model}`); return arq; }
    } catch (e) {
      ultimoErro = e;
      if (e.status && e.status !== 400 && e.status !== 404) throw e;
      console.log(`imagem: ${model} indisponível, tentando o próximo`);
    }
  }
  throw ultimoErro ?? new Error('nenhum modelo de imagem respondeu');
}

// ------------------------------------------------------------------ montagem

const silencio = (seg, arq) => sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(seg), '-c:a', 'pcm_s16le', arq]);
const padronizar = (ent, sai) => sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', ent, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', sai]);

async function principal() {
  const voz = peca.voz || 'cedar';
  const textoVersiculo = await lerVersiculo(peca.ref);
  console.log(`versículo ${peca.ref}: ${textoVersiculo}`);

  // vozes de teste (opcional): só o gancho e o versículo, para comparar de ouvido
  for (const v of (process.env.MANA_VOZES_TESTE || peca.vozesTeste || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const arq = path.join(TMP, `teste-${v}.wav`);
      await narrar(`${peca.gancho.fala} ${peca.ponte?.fala ?? ''}\n\n${textoVersiculo}`, v, arq);
      mkdirSync(path.join(SAIDA, 'vozes'), { recursive: true });
      sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', arq, '-c:a', 'libmp3lame', '-b:a', '128k', path.join(SAIDA, 'vozes', `${nome}-${v}.mp3`)]);
      console.log(`voz de teste: ${v}`);
    } catch (e) {
      console.log(`voz de teste ${v} falhou: ${e.message}`);
    }
  }

  if (process.env.MANA_SO_VOZES === 'true') { console.log('só as vozes de teste, pronto'); return; }

  // narração em partes, com pausas fixas entre elas
  const partes = [
    ['gancho', peca.gancho.fala, PAUSAS.aposGancho],
    ...(peca.ponte?.fala ? [['ponte', peca.ponte.fala, PAUSAS.aposPonte]] : []),
    ['versiculo', textoVersiculo, PAUSAS.aposVersiculo],
    ['referencia', peca.referencia.fala, PAUSAS.aposReferencia],
    ['fecho', peca.fecho.fala, 0],
  ];

  let leituraOk = false;
  let palavrasVerso = [];
  for (let tentativa = 1; tentativa <= 2 && !leituraOk; tentativa++) {
    const arq = path.join(TMP, 'versiculo-bruto.wav');
    await narrar(textoVersiculo, voz, arq);
    const tr = await transcrever(arq);
    const ouvido = normal(tr.text);
    const escrito = normal(paraFala(textoVersiculo));
    const erro = distancia(ouvido, escrito) / escrito.length;
    console.log(`conferência da leitura (tentativa ${tentativa}): ${(erro * 100).toFixed(1)}% de diferença\n  ouvido: ${tr.text}`);
    // o Whisper também erra (acento, palavra parecida); acima de 8% é a voz que leu errado
    if (erro <= 0.08) { leituraOk = true; palavrasVerso = tr.words ?? []; }
  }
  if (!leituraOk) throw new Error('a voz não leu o versículo certo em duas tentativas; vídeo não gerado');

  const pedacos = [];
  const tempos = {};
  let t = PAUSAS.inicio;
  silencio(PAUSAS.inicio, path.join(TMP, 'p0.wav'));
  pedacos.push(path.join(TMP, 'p0.wav'));
  for (const [id, texto, pausa] of partes) {
    const bruto = id === 'versiculo' ? path.join(TMP, 'versiculo-bruto.wav') : await narrar(texto, voz, path.join(TMP, `${id}-bruto.wav`));
    const limpo = path.join(TMP, `${id}.wav`);
    padronizar(bruto, limpo);
    const d = duracao(limpo);
    tempos[id] = { inicio: t, fim: t + d };
    pedacos.push(limpo);
    t += d;
    if (pausa) { const s = path.join(TMP, `${id}-pausa.wav`); silencio(pausa, s); pedacos.push(s); t += pausa; }
  }
  const lista = path.join(TMP, 'lista.txt');
  writeFileSync(lista, pedacos.map((p) => `file '${p}'`).join('\n'));
  const vozFinal = path.join(PUBLICO, `${nome}-voz.wav`);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c:a', 'pcm_s16le', vozFinal]);
  const total = duracao(vozFinal) + PAUSAS.cauda;

  // cada frase do versículo acende na palavra em que começa (proporção de palavras, ancorada no Whisper)
  const fr = frases(textoVersiculo);
  const totalPalavras = fr.reduce((n, f) => n + normal(f).length, 0);
  let acumulado = 0;
  const frasesComTempo = fr.map((f) => {
    const idx = Math.min(palavrasVerso.length - 1, Math.round((acumulado / totalPalavras) * palavrasVerso.length));
    const inicio = tempos.versiculo.inicio + (palavrasVerso[idx]?.start ?? (acumulado / totalPalavras) * (tempos.versiculo.fim - tempos.versiculo.inicio));
    acumulado += normal(f).length;
    return { texto: f, inicio: Number(inicio.toFixed(2)) };
  });

  // fundo
  const arqImagem = path.join(PUBLICO, `${nome}-fundo.jpg`);
  if (peca.imagemArquivo && existsSync(path.join(RAIZ, peca.imagemArquivo))) copyFileSync(path.join(RAIZ, peca.imagemArquivo), arqImagem);
  else {
    const png = path.join(TMP, 'fundo.png');
    await imagem(peca.imagem, png);
    sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', arqImagem]);
    copyFileSync(arqImagem, path.join(SAIDA, `${nome}-fundo.jpg`));
  }

  // trilha (Mixkit, Stock Music Free License: liberada para vídeo em rede social)
  let trilha = null;
  if (peca.trilha) {
    const arq = path.join(PUBLICO, `trilha-${peca.trilha}.mp3`);
    if (!existsSync(arq)) {
      const r = await fetch(`https://assets.mixkit.co/music/${peca.trilha}/${peca.trilha}.mp3`);
      if (!r.ok) throw new Error(`trilha ${peca.trilha}: ${r.status}`);
      writeFileSync(arq, Buffer.from(await r.arrayBuffer()));
    }
    trilha = path.basename(arq);
  }

  const props = {
    imagem: path.basename(arqImagem),
    voz: path.basename(vozFinal),
    trilha,
    duracao: Number(total.toFixed(2)),
    gancho: { tela: peca.gancho.tela, inicio: tempos.gancho.inicio, fim: (tempos.ponte ?? tempos.gancho).fim },
    versiculo: { frases: frasesComTempo, inicio: frasesComTempo[0].inicio, referencia: peca.referencia.tela, refInicio: tempos.referencia.inicio },
    fecho: { tela: peca.fecho.tela, inicio: tempos.fecho.inicio },
    arroba: '@mana.biblia.app',
  };
  const arqProps = path.join(TMP, 'props.json');
  writeFileSync(arqProps, JSON.stringify(props, null, 2));
  console.log(JSON.stringify(props, null, 2));

  const bruto = path.join(TMP, 'bruto.mp4');
  const argsRender = ['remotion', 'render', 'src/index.ts', 'Versiculo', bruto, `--props=${arqProps}`, '--codec=h264', '--crf=18', '--log=warn'];
  if (process.env.REMOTION_BROWSER) argsRender.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
  execFileSync('npx', argsRender, { cwd: RAIZ, stdio: 'inherit' });

  // som no padrão das redes: -14 LUFS, pico em -1.5 dBTP
  const final = path.join(SAIDA, `${nome}.mp4`);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final]);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0.5, frasesComTempo.at(-1).inicio + 1)), '-i', final, '-frames:v', '1', '-q:v', '3', path.join(SAIDA, `${nome}-capa.jpg`)]);
  console.log(`pronto: ${final} (${duracao(final).toFixed(1)} s)`);
}

principal().catch((e) => { console.error(e); process.exit(1); });
