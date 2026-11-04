import React, { useEffect, useState } from 'react';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// A novela bíblica do Maná (nov/2026): um capítulo de ~1 minuto, cinema em tela cheia com a marca do Maná por cima.
// Cada cena tem uma frase na tela; as falas entre aspas são o texto exato da Bíblia Livre (conferido antes do render).
// Mídia: imagens do Flow (Nano Banana Pro) com Ken Burns e clipes do Veo 3.1 Lite, todos sem som.
// Uma cena sem `midia` continua mostrando a mídia da cena anterior (um clipe pode atravessar duas frases).

export type Movimento = 'in' | 'out' | 'esq' | 'dir' | 'sobe';
export type CenaNovela = {
  tipo: 'cena' | 'proximo' | 'final';
  dur: number;
  texto: string; // *assim* destaca
  ref?: string; // "Gênesis 37:3"
  midia?: string; // arquivo em public/
  video?: boolean;
  videoDur?: number; // duração do clipe em segundos
  mov?: Movimento;
  desloca?: number; // px para subir (negativo) ou descer a mídia, para o rosto não ficar atrás do texto
  grande?: boolean; // o gancho
  sub?: string; // final: linha de baixo
};
export type PropsNovela = {
  serie: string;
  capitulo: number;
  total: number;
  cenas: CenaNovela[];
  trilha: string | null;
  arroba: string;
};

export const duracaoNovela = (cenas: CenaNovela[]) => cenas.reduce((n, c) => n + c.dur, 0);

const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const OURO = '#F2C98A';
const suave = Easing.bezier(0.25, 0.1, 0.25, 1);
const X = 0.6; // crossfade entre mídias
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const useFontes = () => {
  const [h] = useState(() => delayRender('fontes'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('600 60px Newsreader'),
      document.fonts.load('500 60px Newsreader'),
      document.fonts.load('italic 500 60px Newsreader'),
      document.fonts.load('500 30px Inter'),
      document.fonts.load('600 30px Inter'),
    ]).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};

const Trigo: React.FC<{ tam: number; cor: string }> = ({ tam, cor }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 22 16 8" />
    <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
    <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
    <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
    <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
    <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
  </svg>
);

const Marca: React.FC<{ tam: number; fundo: string; traco: string; borda?: string }> = ({ tam, fundo, traco, borda }) => (
  <div style={{
    width: tam, height: tam, borderRadius: tam * 0.24, backgroundColor: fundo, display: 'flex',
    alignItems: 'center', justifyContent: 'center', border: borda ? `2px solid ${borda}` : undefined,
  }}>
    <Trigo tam={tam * 0.56} cor={traco} />
  </div>
);

/** Texto palavra por palavra; *trecho* destacado em itálico dourado. */
const Palavras: React.FC<{ texto: string; t: number; t0: number; ritmo?: number; base: React.CSSProperties; destaque: React.CSSProperties }> = ({
  texto, t, t0, ritmo = 0.06, base, destaque,
}) => {
  const partes: { p: string; d: boolean }[] = [];
  texto.split(/(\*[^*]+\*)/g).forEach((pedaco) => {
    const d = pedaco.startsWith('*') && pedaco.endsWith('*');
    (d ? pedaco.slice(1, -1) : pedaco).split(/(\s+)/).forEach((w) => { if (w) partes.push({ p: w, d }); });
  });
  let i = 0;
  return (
    <span style={{ ...base, display: 'inline' }}>
      {partes.map((w, k) => {
        if (/^\s+$/.test(w.p)) return <React.Fragment key={k}>{w.p.includes('\n') ? <br /> : ' '}</React.Fragment>;
        const ti = t0 + i++ * ritmo;
        const p = interpolate(t, [ti, ti + 0.55], [0, 1], { ...clamp, easing: suave });
        return (
          <span key={k} style={{
            ...(w.d ? destaque : {}), display: 'inline-block', opacity: p,
            filter: `blur(${(1 - p) * 7}px)`, transform: `translateY(${(1 - p) * 14}px)`,
          }}>{w.p}</span>
        );
      })}
    </span>
  );
};

const tamTexto = (s: string, grande?: boolean) => {
  const n = s.replace(/\*/g, '').length;
  if (grande) return n <= 60 ? 80 : 72;
  if (n <= 40) return 70;
  if (n <= 70) return 62;
  if (n <= 100) return 56;
  return 52;
};

/** Grão de filme determinístico (a semente muda a cada quadro). */
const Grao: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.16, pointerEvents: 'none' }}>
    <svg width="1080" height="1920">
      <filter id={`g${frame % 6}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#g${frame % 6})`} />
    </svg>
  </AbsoluteFill>
);

type Plano = { midia: string; video: boolean; videoDur?: number; mov: Movimento; desloca: number; ini: number; dur: number };

const Midia: React.FC<{ p: Plano; idx: number }> = ({ p, idx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // tempo local do plano
  const total = p.dur + X;
  const entra = idx === 0 ? interpolate(t, [0, 0.6], [0, 1], clamp) : interpolate(t, [0, X], [0, 1], { ...clamp, easing: suave });
  const k = interpolate(t, [0, total], [0, 1], clamp);
  let transform = '';
  if (p.video) {
    transform = `scale(${1.02 + 0.04 * k})`;
  } else if (p.mov === 'out') {
    transform = `scale(${1.15 - 0.1 * k})`;
  } else if (p.mov === 'esq') {
    transform = `scale(1.12) translateX(${30 - 60 * k}px)`;
  } else if (p.mov === 'dir') {
    transform = `scale(1.12) translateX(${-30 + 60 * k}px)`;
  } else if (p.mov === 'sobe') {
    transform = `scale(1.12) translateY(${34 - 68 * k}px)`;
  } else {
    transform = `scale(${1.04 + 0.1 * k})`;
  }
  if (p.desloca) transform = `translateY(${p.desloca}px) scale(${(960 + Math.abs(p.desloca)) / 960}) ` + transform;
  const taxa = p.video && p.videoDur ? Math.min(1, p.videoDur / (total + 0.05)) : 1;
  return (
    <AbsoluteFill style={{ opacity: entra, overflow: 'hidden' }}>
      {p.video ? (
        <OffthreadVideo src={staticFile(p.midia)} muted playbackRate={taxa}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform }} />
      ) : (
        <Img src={staticFile(p.midia)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform }} />
      )}
    </AbsoluteFill>
  );
};

export const Novela: React.FC<PropsNovela> = ({ serie, capitulo, total, cenas, trilha, arroba }) => {
  useFontes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dTotal = duracaoNovela(cenas);

  const inicios: number[] = [];
  cenas.reduce((acc, c) => { inicios.push(acc); return acc + c.dur; }, 0);
  const idxFinal = cenas.findIndex((c) => c.tipo === 'final');
  const tFinal = idxFinal >= 0 ? inicios[idxFinal]! : dTotal + 1;
  const escuro = interpolate(t, [tFinal - 0.2, tFinal + 0.7], [0, 1], { ...clamp, easing: suave });

  // planos de mídia: cada mídia vai do começo da sua cena até o começo da próxima mídia
  const planos: Plano[] = [];
  cenas.forEach((c, i) => {
    if (!c.midia) return;
    let fim = idxFinal >= 0 ? tFinal : dTotal;
    for (let j = i + 1; j < cenas.length; j++) { if (cenas[j]!.midia) { fim = inicios[j]!; break; } }
    planos.push({ midia: c.midia, video: !!c.video, videoDur: c.videoDur, mov: c.mov ?? 'in', desloca: c.desloca ?? 0, ini: inicios[i]!, dur: fim - inicios[i]! });
  });

  const volume = (f: number) => {
    const s = f / fps;
    return 0.9 * interpolate(s, [0, 1.5], [0, 1], clamp) * interpolate(s, [dTotal - 3, dTotal], [1, 0], clamp);
  };

  const comBarra = cenas.filter((c) => c.tipo !== 'final');

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {planos.map((p, i) => (
        <Sequence key={i} from={Math.round(p.ini * fps)} durationInFrames={Math.round((p.dur + X + 0.1) * fps)}>
          <Midia p={p} idx={i} />
        </Sequence>
      ))}

      {/* vinheta, faixas escuras de leitura e grão */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.62) 0px, rgba(0,0,0,0.28) 230px, rgba(0,0,0,0) 420px)' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 880px, rgba(0,0,0,0.55) 1180px, rgba(0,0,0,0.86) 1560px, rgba(0,0,0,0.9) 1920px)' }} />
      <Grao frame={frame} />

      {/* cabeçalho: barra de progresso, marca e capítulo */}
      <div style={{ position: 'absolute', top: 104, left: 72, width: 936, display: 'flex', gap: 8, opacity: 1 - escuro }}>
        {comBarra.map((c, i) => {
          const ini = inicios[i]!;
          const p = interpolate(t, [ini, ini + c.dur], [0, 1], clamp);
          return (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.26)', overflow: 'hidden' }}>
              <div style={{ width: `${p * 100}%`, height: '100%', backgroundColor: '#FFFFFF', opacity: 0.92 }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', top: 144, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - escuro }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Marca tam={58} fundo="rgba(0,0,0,0.28)" traco="#FFFFFF" borda="rgba(255,255,255,0.45)" />
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 42, color: '#FFFFFF', letterSpacing: -0.5, textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>Maná</div>
        </div>
        <div style={{ marginTop: 16, fontFamily: SANS, fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.86)', letterSpacing: 0.3, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 32 }}>{serie}</span>
          <span style={{ margin: '0 12px', opacity: 0.6 }}>·</span>
          Capítulo {capitulo} de {total}
        </div>
      </div>

      {/* o texto de cada cena, no terço de baixo */}
      {cenas.map((c, i) => {
        if (c.tipo === 'final') return null;
        const ini = inicios[i]!;
        if (t < ini - 0.1 || t > ini + c.dur + 0.1) return null;
        const sai = interpolate(t, [ini + c.dur - 0.4, ini + c.dur], [1, 0], clamp);
        const tam = tamTexto(c.texto, c.grande);
        const proximo = c.tipo === 'proximo';
        return (
          <div key={`tx${i}`} style={{
            position: 'absolute', left: 76, width: 840, bottom: 360, opacity: sai,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          }}>
            {proximo && (
              <div style={{
                marginBottom: 26, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 38, color: OURO,
                opacity: interpolate(t, [ini, ini + 0.6], [0, 1], clamp), textShadow: '0 2px 14px rgba(0,0,0,0.6)',
              }}>Cenas do próximo capítulo</div>
            )}
            <div style={{ textWrap: 'balance', textShadow: '0 2px 20px rgba(0,0,0,0.55)' } as React.CSSProperties}>
              <Palavras
                texto={c.texto} t={t} t0={ini + (proximo ? 0.5 : 0.2)}
                base={{ fontFamily: SERIF, fontWeight: 600, fontSize: tam, lineHeight: 1.14, color: '#FFFFFF', letterSpacing: -0.4 }}
                destaque={{ fontStyle: 'italic', fontWeight: 500, color: OURO }}
              />
            </div>
            {c.ref && (
              <div style={{
                marginTop: 24, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: 'rgba(255,255,255,0.72)',
                opacity: interpolate(t, [ini + 0.6, ini + 1.2], [0, 1], clamp), textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}>{c.ref}</div>
            )}
            {proximo && c.sub && (
              <div style={{
                marginTop: 30, padding: '12px 26px', borderRadius: 999, border: '2px solid rgba(255,255,255,0.7)',
                fontFamily: SANS, fontWeight: 600, fontSize: 30, color: '#FFFFFF',
                opacity: interpolate(t, [ini + 1.0, ini + 1.6], [0, 1], clamp),
              }}>{c.sub}</div>
            )}
          </div>
        );
      })}

      {/* fecho escuro com a marca */}
      <AbsoluteFill style={{ backgroundColor: '#0C0C0E', opacity: escuro }} />
      {idxFinal >= 0 && t >= tFinal - 0.2 && (() => {
        const c = cenas[idxFinal]!;
        const e = (d: number) => interpolate(t, [tFinal + d, tFinal + d + 0.7], [0, 1], { ...clamp, easing: suave });
        return (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 96px' }}>
            <div style={{ opacity: e(0.15), transform: `scale(${0.94 + 0.06 * e(0.15)})` }}>
              <Marca tam={140} fundo="#FFFFFF" traco="#111111" />
            </div>
            <div style={{ opacity: e(0.3), marginTop: 36, fontFamily: SERIF, fontWeight: 600, fontSize: 100, color: '#F3F3F5', letterSpacing: -2 }}>Maná</div>
            <div style={{ marginTop: 34, textAlign: 'center' }}>
              <Palavras texto={c.texto} t={t} t0={tFinal + 0.5}
                base={{ fontFamily: SERIF, fontWeight: 500, fontSize: 58, lineHeight: 1.2, color: '#F3F3F5' }}
                destaque={{ fontStyle: 'italic', color: OURO }} />
            </div>
            {c.sub && (
              <div style={{ opacity: e(1.0), marginTop: 30, fontFamily: SANS, fontWeight: 500, fontSize: 38, lineHeight: 1.4, color: '#A3A3AA', textAlign: 'center' }}>{c.sub}</div>
            )}
            <div style={{ opacity: e(1.25), marginTop: 56, padding: '18px 40px', borderRadius: 999, backgroundColor: '#FFFFFF', fontFamily: SANS, fontWeight: 600, fontSize: 38, color: '#111111' }}>
              {arroba}
            </div>
          </AbsoluteFill>
        );
      })()}

      {trilha && <Audio src={staticFile(trilha)} volume={volume} />}
    </AbsoluteFill>
  );
};
