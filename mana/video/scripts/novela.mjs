// Gera um capítulo da NOVELA do Maná (mana/video/novela/<serie>/C-NN.json -> mana/videos/novela/<serie>-capNN.mp4).
//
// Regra de ouro, a mesma de tudo no Maná: zero erro no texto bíblico. Antes de renderizar, este script:
// - confere cada item de `conferir` (ref + cita) contra o versículo da Bíblia Livre no banco, caractere por caractere;
// - exige que todo trecho entre *asteriscos* na tela (fora do card final) seja exatamente um `cita` conferido;
// - exige que cada cena fique na tela pelo menos (palavras ÷ 3) + 1 segundos;
// - confere se toda mídia citada existe em public/.
// Se qualquer coisa falhar, o vídeo NÃO sai.
//
// Uso: SUPABASE_ANON_KEY=... node scripts/novela.mjs novela/jose/C-02.json   (MANA_SO_CONFERIR=true só confere)
//
// Sem acesso de rede ao Supabase (o caso da sessão do Claude): rode com MANA_SQL=true para imprimir a consulta
// que confere as citações dentro do próprio banco, rode essa consulta (MCP do Supabase) e, com todas as linhas
// "ok", rode de novo com MANA_BANCO_CONFERIDO=true para as outras conferências e o render.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLICO = path.join(RAIZ, 'public');
const SAIDA = path.resolve(RAIZ, '..', 'videos', 'novela');
const SUPABASE_URL = 'https://zknabgosqnxqzattoncg.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const SO_CONFERIR = process.env.MANA_SO_CONFERIR === 'true';
const SQL = process.env.MANA_SQL === 'true';
const BANCO_CONFERIDO = process.env.MANA_BANCO_CONFERIDO === 'true';
if (!SUPABASE_ANON && !SQL && !BANCO_CONFERIDO) throw new Error('falta SUPABASE_ANON_KEY');

const arq = process.argv[2];
if (!arq) throw new Error('uso: node scripts/novela.mjs novela/jose/C-02.json');
const cap = JSON.parse(readFileSync(path.resolve(RAIZ, arq), 'utf8'));
const m = /^N-([A-Z]+)-(\d{2})$/.exec(cap.nome ?? '');
if (!m) throw new Error(`nome do capítulo: ${cap.nome}`);
const base = `${m[1].toLowerCase()}-cap${m[2]}`;
const TMP = path.join(RAIZ, '.tmp', cap.nome);
for (const d of [TMP, SAIDA]) mkdirSync(d, { recursive: true });

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const espacos = (s) => s.replace(/\s+/g, ' ').trim();
const palavras = (s) => s.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
const erros = [];

async function versiculo(ref) {
  const url = `${SUPABASE_URL}/rest/v1/versiculos?select=ref,texto&traducao=eq.blivre&ref=eq.${ref}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  if (!r.ok) throw new Error(`versiculos: ${r.status} ${await r.text()}`);
  const l = await r.json();
  if (!l.length) throw new Error(`versículo não encontrado: ${ref}`);
  return espacos(String(l[0].texto));
}

async function principal() {
  // 1. cada citação, no banco
  if (SQL) {
    const q = (s) => `'${s.replace(/'/g, "''")}'`;
    const linhas = cap.conferir.map(({ ref, cita }) => `(${q(ref)}, ${q(espacos(cita))})`).join(',\n  ');
    console.log(`with c(ref, cita) as (values\n  ${linhas}\n)\nselect c.ref, c.cita, case when v.texto is null then 'SEM VERSÍCULO' when position(c.cita in regexp_replace(v.texto, '\\s+', ' ', 'g')) > 0 then 'ok' else 'DIFERENTE' end as resultado\nfrom c left join versiculos v on v.ref = c.ref and v.traducao = 'blivre';`);
    return;
  }
  const citas = new Set();
  for (const { ref, cita } of cap.conferir) {
    if (!BANCO_CONFERIDO) {
      const v = await versiculo(ref);
      if (!v.includes(espacos(cita))) erros.push(`"${cita}" não está em ${ref}: ${v}`);
      else console.log(`ok ${ref}: "${cita}"`);
    }
    citas.add(espacos(cita));
  }

  // 2. todo destaque na tela é uma citação conferida; 3. tempo de leitura; 4. mídia
  let t = 0;
  cap.cenas.forEach((c, i) => {
    const n = `cena ${i + 1} (${t.toFixed(1)} s)`;
    t += c.dur;
    if (c.tipo !== 'final') {
      // `destaqueLivre`: o gancho pode destacar uma frase de ligação (não é citação, e não leva aspas)
      for (const [, trecho] of c.destaqueLivre ? [] : c.texto.matchAll(/\*([^*]+)\*/g)) {
        if (!citas.has(espacos(trecho))) erros.push(`${n}: o destaque "${trecho}" não está em conferir`);
      }
      const min = palavras(c.texto) / 3 + 1;
      if (c.dur + 1e-9 < min) erros.push(`${n}: ${palavras(c.texto)} palavras pedem ${min.toFixed(1)} s, tem ${c.dur}`);
    }
    if (c.midia && !existsSync(path.join(PUBLICO, c.midia))) erros.push(`${n}: falta a mídia ${c.midia}`);
  });
  for (const cita of citas) {
    if (!cap.cenas.some((c) => espacos(c.texto.replace(/\*/g, '')).includes(cita))) erros.push(`"${cita}" está em conferir mas não aparece na tela`);
  }
  if (cap.trilha && !existsSync(path.join(PUBLICO, cap.trilha))) erros.push(`falta a trilha ${cap.trilha}`);

  if (erros.length) {
    console.error(`\n${erros.length} problema(s), o capítulo não sai:\n- ${erros.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`\ntexto conferido: ${cap.conferir.length} citações, ${t.toFixed(1)} s`);
  if (SO_CONFERIR) return;

  // 5. render, som em -14 LUFS e capa
  const props = { serie: cap.serie, capitulo: cap.capitulo, total: cap.total, cenas: cap.cenas, trilha: cap.trilha ?? null, arroba: cap.arroba };
  const arqProps = path.join(TMP, 'props.json');
  writeFileSync(arqProps, JSON.stringify(props, null, 2));
  const bruto = path.join(TMP, 'bruto.mp4');
  const args = ['remotion', 'render', 'src/index.ts', 'Novela', bruto, `--props=${arqProps}`, '--codec=h264', '--crf=18', '--log=warn'];
  if (process.env.REMOTION_BROWSER) args.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
  execFileSync('npx', args, { cwd: RAIZ, stdio: 'inherit' });

  finalizar(bruto);
}

// Som em -14 LUFS em duas passadas (a de uma passada só erra em vídeo curto com fade) e vídeo em CRF 20.
function finalizar(bruto) {
  const final = path.join(SAIDA, `${base}.mp4`);
  const txt = String(execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${bruto}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -14`]));
  const m = JSON.parse(/\{[\s\S]*\}/.exec(txt)[0]);
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', bruto, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final]);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(2.6, cap.cenas[0].dur - 0.4)), '-i', final, '-frames:v', '1', '-q:v', '3', path.join(SAIDA, `${base}-capa.jpg`)]);
  console.log(`pronto: ${final}`);
}

if (process.env.MANA_SO_FINALIZAR === 'true') finalizar(path.join(TMP, 'bruto.mp4'));
else principal().catch((e) => { console.error(e); process.exit(1); });
