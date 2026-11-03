// Gera o vídeo de HISTÓRIA do Maná: uma passagem da Bíblia contada em ~30 s, no visual claro dos carrosséis
// (mana/video/historias/H-00N.json -> mana/videos/H-00N.mp4).
//
// Regra de ouro, a mesma de tudo no Maná: zero erro no texto bíblico.
// - Toda fala entre aspas na tela (o campo `cita` de cada cena) é conferida, palavra por palavra, contra o
//   versículo da Bíblia Livre no banco. Se não estiver lá exatamente assim, o vídeo NÃO sai.
// - O cartão de versículo nunca é digitado: o texto vem do banco pela referência.
// Imagens: OpenAI (sem pessoas, sem rostos, sem mãos), com um estilo fixo para todas as cenas combinarem.
// Trilha: Mixkit (Stock Music Free License, liberada para rede social, sem crédito).
//
// Uso: node scripts/historia.mjs historias/H-001.json   (OPENAI_API_KEY e SUPABASE_ANON_KEY no ambiente)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLICO = path.join(RAIZ, 'public');
const SAIDA = path.resolve(RAIZ, '..', 'videos');
const SUPABASE_URL = 'https://zknabgosqnxqzattoncg.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const OPENAI = process.env.OPENAI_API_KEY;
const MODELOS_IMAGEM = (process.env.MANA_MODELO_IMAGEM || 'gpt-image-2,gpt-image-1.5,gpt-image-1').split(',');
const SO_CONFERIR = process.env.MANA_SO_CONFERIR === 'true';

if (!SUPABASE_ANON) throw new Error('falta SUPABASE_ANON_KEY');

const arqPeca = process.argv[2];
if (!arqPeca) throw new Error('uso: node scripts/historia.mjs historias/H-00N.json');
const peca = JSON.parse(readFileSync(path.resolve(RAIZ, arqPeca), 'utf8'));
const nome = peca.nome;
if (!/^H-\d{3}$/.test(nome)) throw new Error(`nome da peça: ${nome}`);
const TMP = path.join(RAIZ, '.tmp', nome);
for (const d of [TMP, SAIDA, PUBLICO]) mkdirSync(d, { recursive: true });

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString();
const duracao = (arq) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).trim());

// ------------------------------------------------------------------ Bíblia

const LIVROS = { MRK: 'Marcos', MAT: 'Mateus', LUK: 'Lucas', JHN: 'João', GEN: 'Gênesis', EXO: 'Êxodo', '1SA': '1 Samuel', DAN: 'Daniel', JON: 'Jonas', ACT: 'Atos', PSA: 'Salmos', RUT: 'Rute', JOS: 'Josué' };

function refs(ref) {
  const m = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`referência inválida: ${ref}`);
  const [, livro, cap, de, ate] = m;
  const fim = ate ? Number(ate) : Number(de);
  if (fim < Number(de) || fim - Number(de) > 6) throw new Error(`trecho inválido: ${ref}`);
  return Array.from({ length: fim - Number(de) + 1 }, (_, i) => `${livro}.${cap}.${Number(de) + i}`);
}

function escrita(ref) {
  const m = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(ref);
  const livro = LIVROS[m[1]] ?? m[1];
  return `${livro} ${m[2]}:${m[3]}${m[4] ? `-${m[4]}` : ''}`;
}

async function lerVersiculo(ref) {
  const lista = refs(ref);
  const url = `${SUPABASE_URL}/rest/v1/versiculos?select=ref,texto&traducao=eq.blivre&ref=in.(${lista.join(',')})`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  if (!r.ok) throw new Error(`versiculos: ${r.status} ${await r.text()}`);
  const porRef = new Map((await r.json()).map((l) => [l.ref, String(l.texto).trim()]));
  const faltando = lista.filter((x) => !porRef.has(x));
  if (faltando.length) throw new Error(`versículo não encontrado: ${faltando.join(', ')}`);
  return lista.map((x) => porRef.get(x)).join(' ');
}

const espacos = (s) => s.replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ imagens

async function openai(rota, corpo) {
  const r = await fetch(`https://api.openai.com/v1/${rota}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) {
    const err = new Error(`OpenAI ${rota}: ${r.status} ${(await r.text()).slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

async function imagem(prompt, arq) {
  const texto = `${prompt}. ${peca.estilo}`;
  let ultimoErro;
  for (const model of MODELOS_IMAGEM) {
    try {
      const r = await openai('images/generations', { model: model.trim(), prompt: texto, size: '1024x1536', quality: 'high', n: 1 });
      const b64 = r.data?.[0]?.b64_json;
      if (b64) { writeFileSync(arq, Buffer.from(b64, 'base64')); console.log(`imagem ${path.basename(arq)}: ${model}`); return; }
      if (r.data?.[0]?.url) { writeFileSync(arq, Buffer.from(await (await fetch(r.data[0].url)).arrayBuffer())); console.log(`imagem ${path.basename(arq)}: ${model}`); return; }
    } catch (e) {
      ultimoErro = e;
      if (e.status && e.status !== 400 && e.status !== 404) throw e;
      console.log(`imagem: ${model} indisponível, tentando o próximo`);
    }
  }
  throw ultimoErro ?? new Error('nenhum modelo de imagem respondeu');
}

// ------------------------------------------------------------------ montagem

async function principal() {
  // 1. conferir TODO o texto bíblico antes de gastar qualquer centavo
  const cenas = [];
  for (const [i, c] of peca.cenas.entries()) {
    const cena = { tipo: c.tipo, dur: c.dur, texto: c.texto ?? '' };
    if (c.ref) cena.ref = escrita(c.ref);
    if (c.clima) cena.clima = c.clima;
    if (c.sub) cena.sub = c.sub;
    if (c.cita) {
      const verso = espacos(await lerVersiculo(c.ref));
      for (const trecho of [].concat(c.cita)) {
        if (!verso.includes(espacos(trecho))) throw new Error(`cena ${i + 1}: a citação "${trecho}" não está em ${c.ref} (${verso})`);
        if (!cena.texto.replace(/\*/g, '').includes(espacos(trecho))) throw new Error(`cena ${i + 1}: a citação "${trecho}" não aparece no texto da tela`);
      }
      console.log(`cena ${i + 1}: citação conferida em ${c.ref}`);
    }
    if (c.tipo === 'versiculo') {
      cena.versiculo = { texto: await lerVersiculo(c.ref), referencia: escrita(c.ref) };
      delete cena.ref;
      console.log(`cena ${i + 1}: versículo ${c.ref}: ${cena.versiculo.texto}`);
    }
    cenas.push(cena);
  }
  if (SO_CONFERIR) { console.log('texto conferido, sem gerar'); return; }
  if (!OPENAI) throw new Error('falta OPENAI_API_KEY');

  // 2. imagens (uma por cena com imagem; cenas podem repetir a imagem de outra pelo id)
  const feitas = new Map();
  for (const [i, c] of peca.cenas.entries()) {
    if (c.tipo !== 'imagem') continue;
    const id = c.imagemId ?? `c${i + 1}`;
    const jpg = path.join(PUBLICO, `${nome}-${id}.jpg`);
    if (!feitas.has(id)) {
      if (!existsSync(jpg)) {
        const png = path.join(TMP, `${id}.png`);
        await imagem(c.imagem, png);
        sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', jpg]);
      }
      copyFileSync(jpg, path.join(SAIDA, `${nome}-${id}.jpg`));
      feitas.set(id, path.basename(jpg));
    }
    cenas[i].imagem = feitas.get(id);
  }

  // 3. trilha
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

  // 4. render
  const props = { cenas, trilha, arroba: '@mana.biblia.app' };
  const arqProps = path.join(TMP, 'props.json');
  writeFileSync(arqProps, JSON.stringify(props, null, 2));
  console.log(JSON.stringify(props, null, 2));
  const bruto = path.join(TMP, 'bruto.mp4');
  const args = ['remotion', 'render', 'src/index.ts', 'Historia', bruto, `--props=${arqProps}`, '--codec=h264', '--crf=18', '--log=warn'];
  if (process.env.REMOTION_BROWSER) args.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
  execFileSync('npx', args, { cwd: RAIZ, stdio: 'inherit' });

  const final = path.join(SAIDA, `${nome}.mp4`);
  if (trilha) {
    sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final]);
  } else {
    sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-c', 'copy', '-movflags', '+faststart', final]);
  }
  // capa: o meio da primeira cena, já com o gancho escrito
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(2.4, peca.cenas[0].dur - 0.4)), '-i', final, '-frames:v', '1', '-q:v', '3', path.join(SAIDA, `${nome}-capa.jpg`)]);
  console.log(`pronto: ${final} (${duracao(final).toFixed(1)} s)`);
}

principal().catch((e) => { console.error(e); process.exit(1); });
