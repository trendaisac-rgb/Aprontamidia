import React, { useEffect, useState } from 'react';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import {
  AbsoluteFill, Audio, Img, continueRender, delayRender, interpolate, random, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// Uma passagem da Bíblia contada em ~30 s, no visual claro do Maná (o mesmo dos carrosséis):
// fundo cinza claro, a cena num cartão de cantos redondos, o texto em Newsreader entrando palavra por
// palavra, destaque em vermelho itálico, o versículo no cartão branco do app e o fecho escuro com a marca.
// Movimento sempre calmo: zoom lento na cena; na tempestade, chuva fina e um balanço leve do barco.

export type Cena = {
  tipo: 'imagem' | 'versiculo' | 'final';
  dur: number;
  texto: string; // *assim* destaca
  ref?: string; // "Marcos 4:37", embaixo do texto
  imagem?: string; // arquivo em public/
  clima?: 'tempestade' | 'calma' | 'neutro';
  versiculo?: { texto: string; referencia: string }; // lido do banco, nunca digitado
  sub?: string; // texto menor (só no final)
};
export type PropsHistoria = {
  cenas: Cena[];
  trilha: string | null;
  arroba: string;
};

export const duracaoTotal = (cenas: Cena[]) => cenas.reduce((n, c) => n + c.dur, 0);

const C = {
  fundo: '#F2F2F5', cartao: '#FFFFFF', tinta: '#111111', suave: '#6E6E74', apagado: '#8A8A90', borda: '#E4E4E8',
  destaque: '#B3261E', escuro: '#0C0C0E', tintaEscura: '#F3F3F5', suaveEscuro: '#A3A3AA',
};
const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const suave = Easing.bezier(0.25, 0.1, 0.25, 1);
const TRANSICAO = 0.6;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const useFontes = () => {
  const [h] = useState(() => delayRender('fontes'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('600 60px Newsreader'),
      document.fonts.load('500 60px Newsreader'),
      document.fonts.load('400 60px Newsreader'),
      document.fonts.load('italic 500 60px Newsreader'),
      document.fonts.load('500 30px Inter'),
      document.fonts.load('600 30px Inter'),
    ]).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};

/** O trigo do ícone do app (lucide "wheat"). */
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

/** O texto em palavras; *trecho* destacado. Cada palavra entra com fade, um leve desfoque e um deslize curto. */
const Palavras: React.FC<{ texto: string; t: number; t0: number; ritmo?: number; base: React.CSSProperties; destaque: React.CSSProperties }> = ({
  texto, t, t0, ritmo = 0.07, base, destaque,
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
        const p = interpolate(t, [ti, ti + 0.5], [0, 1], { ...clamp, easing: suave });
        return (
          <span key={k} style={{
            ...(w.d ? destaque : {}), display: 'inline-block', opacity: p,
            filter: `blur(${(1 - p) * 6}px)`, transform: `translateY(${(1 - p) * 12}px)`,
          }}>{w.p}</span>
        );
      })}
    </span>
  );
};

const tamTexto = (s: string) => {
  const n = s.replace(/\*/g, '').length;
  if (n <= 42) return 70;
  if (n <= 70) return 62;
  if (n <= 100) return 56;
  return 50;
};

/** Chuva fina, em diagonal, dentro do cartão. */
const Chuva: React.FC<{ t: number; forca: number }> = ({ t, forca }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: forca }}>
    {new Array(70).fill(0).map((_, i) => {
      const x0 = random(`cx${i}`) * 1200 - 100;
      const v = 900 + random(`cv${i}`) * 600;
      const comp = 40 + random(`cl${i}`) * 50;
      const y = ((random(`cy${i}`) * 1100 + t * v) % 1200) - 100;
      const x = x0 - (y * 0.18);
      return (
        <div key={i} style={{
          position: 'absolute', left: x, top: y, width: 2, height: comp, borderRadius: 2,
          background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.55))',
          transform: 'rotate(10deg)',
        }} />
      );
    })}
  </AbsoluteFill>
);

const CARTAO = { x: 80, y: 300, w: 920, h: 1000 };

/** A cena no cartão: zoom lento; na tempestade, balanço e chuva; na calma, uma luz abrindo. */
const Quadro: React.FC<{ cena: Cena; local: number; opacidade: number }> = ({ cena, local, opacidade }) => {
  const tempestade = cena.clima === 'tempestade';
  const zoom = interpolate(local, [0, cena.dur + TRANSICAO], tempestade ? [1.06, 1.14] : [1.02, 1.09]);
  const balanco = tempestade ? Math.sin(local * 1.9) * 0.6 : 0;
  const sobe = tempestade ? Math.sin(local * 1.3) * 10 : interpolate(local, [0, cena.dur], [0, -18]);
  const luz = cena.clima === 'calma' ? interpolate(local, [0.2, cena.dur], [0, 0.55], { ...clamp, easing: suave }) : 0;
  return (
    <AbsoluteFill style={{ opacity: opacidade }}>
      <Img
        src={staticFile(cena.imagem!)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${zoom}) rotate(${balanco}deg) translateY(${sobe}px)`,
          filter: tempestade ? 'saturate(0.85) contrast(1.04)' : 'saturate(0.92)',
        }}
      />
      {tempestade && <Chuva t={local} forca={0.8} />}
      {luz > 0 && (
        <AbsoluteFill style={{
          mixBlendMode: 'screen', opacity: luz,
          background: 'radial-gradient(ellipse at 50% 22%, rgba(255,240,210,0.75) 0%, rgba(255,236,200,0.18) 38%, rgba(255,236,200,0) 70%)',
        }} />
      )}
    </AbsoluteFill>
  );
};

export const Historia: React.FC<PropsHistoria> = ({ cenas, trilha, arroba }) => {
  useFontes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = duracaoTotal(cenas);

  const inicios: number[] = [];
  cenas.reduce((acc, c) => { inicios.push(acc); return acc + c.dur; }, 0);
  const idxFinal = cenas.findIndex((c) => c.tipo === 'final');
  const tFinal = idxFinal >= 0 ? inicios[idxFinal]! : total + 1;
  const escuro = interpolate(t, [tFinal - 0.1, tFinal + TRANSICAO], [0, 1], { ...clamp, easing: suave });

  // as cenas com imagem ficam empilhadas; cada uma aparece por cima da anterior
  const comImagem = cenas.map((c, i) => ({ c, i })).filter(({ c }) => c.tipo === 'imagem');
  const ultimaImagem = comImagem.length ? comImagem[comImagem.length - 1]!.i : -1;
  const cartaoSai = interpolate(t, [inicios[ultimaImagem]! + cenas[ultimaImagem]!.dur - 0.1, inicios[ultimaImagem]! + cenas[ultimaImagem]!.dur + TRANSICAO], [1, 0], { ...clamp, easing: suave });

  const volume = (f: number) => {
    const s = f / fps;
    return interpolate(s, [0, 1.2], [0, 1], clamp) * interpolate(s, [total - 2.4, total], [1, 0], clamp);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: C.fundo }}>
      {/* barra de progresso por cena, como nos stories */}
      <div style={{ position: 'absolute', top: 112, left: 80, width: 920, display: 'flex', gap: 10, opacity: 1 - escuro }}>
        {cenas.filter((c) => c.tipo !== 'final').map((c, i) => {
          const ini = inicios[i]!;
          const p = interpolate(t, [ini, ini + c.dur], [0, 1], clamp);
          return (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.borda, overflow: 'hidden' }}>
              <div style={{ width: `${p * 100}%`, height: '100%', backgroundColor: C.tinta, opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', top: 160, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: 1 - escuro }}>
        <Marca tam={72} fundo={C.cartao} traco={C.tinta} borda={C.borda} />
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 46, color: C.tinta, letterSpacing: -0.5 }}>Maná</div>
      </div>

      {/* o cartão da cena */}
      {ultimaImagem >= 0 && (
        <div style={{
          position: 'absolute', left: CARTAO.x, top: CARTAO.y, width: CARTAO.w, height: CARTAO.h, borderRadius: 44,
          overflow: 'hidden', backgroundColor: '#DADBE0', border: `2px solid ${C.borda}`,
          boxShadow: '0 18px 50px rgba(17,17,17,0.10)', opacity: cartaoSai,
          transform: `scale(${interpolate(t, [0, 0.8], [0.97, 1], { ...clamp, easing: suave })})`,
        }}>
          {comImagem.map(({ c, i }) => {
            const ini = inicios[i]!;
            if (t < ini - 0.05 || t > ini + c.dur + TRANSICAO + 0.1) return null;
            const op = i === comImagem[0]!.i ? interpolate(t, [0, 0.5], [0, 1], clamp) : interpolate(t, [ini - 0.05, ini + TRANSICAO], [0, 1], { ...clamp, easing: suave });
            return <Quadro key={i} cena={c} local={t - ini} opacidade={op} />;
          })}
        </div>
      )}

      {/* o texto de cada cena com imagem, embaixo do cartão */}
      {cenas.map((c, i) => {
        if (c.tipo !== 'imagem') return null;
        const ini = inicios[i]!;
        if (t < ini - 0.1 || t > ini + c.dur + 0.1) return null;
        const sai = interpolate(t, [ini + c.dur - 0.35, ini + c.dur], [1, 0], clamp);
        const tam = tamTexto(c.texto);
        return (
          <div key={`tx${i}`} style={{
            position: 'absolute', top: CARTAO.y + CARTAO.h + 52, left: 90, width: 900, textAlign: 'center', opacity: sai,
          }}>
            <div style={{ textWrap: 'balance' } as React.CSSProperties}>
              <Palavras
                texto={c.texto} t={t} t0={ini + 0.15}
                base={{ fontFamily: SERIF, fontWeight: 600, fontSize: tam, lineHeight: 1.16, color: C.tinta, letterSpacing: -0.5 }}
                destaque={{ fontStyle: 'italic', fontWeight: 500, color: C.destaque }}
              />
            </div>
            {c.ref && (
              <div style={{
                marginTop: 22, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.apagado,
                opacity: interpolate(t, [ini + 0.5, ini + 1.1], [0, 1], clamp),
              }}>{c.ref}</div>
            )}
          </div>
        );
      })}

      {/* o versículo no cartão branco do app */}
      {cenas.map((c, i) => {
        if (c.tipo !== 'versiculo' || !c.versiculo) return null;
        const ini = inicios[i]!;
        if (t < ini - 0.1 || t > ini + c.dur + TRANSICAO) return null;
        const entra = interpolate(t, [ini, ini + 0.8], [0, 1], { ...clamp, easing: suave });
        const sai = interpolate(t, [ini + c.dur - 0.2, ini + c.dur + 0.4], [1, 0], clamp);
        const n = c.versiculo.texto.length;
        const fs = n <= 90 ? 66 : n <= 150 ? 58 : n <= 230 ? 52 : 46;
        return (
          <AbsoluteFill key={`v${i}`} style={{ justifyContent: 'center', alignItems: 'center', padding: '0 72px', opacity: entra * sai }}>
            {c.texto && (
              <div style={{ marginBottom: 44, textAlign: 'center', transform: `translateY(${(1 - entra) * 16}px)` }}>
                <Palavras texto={c.texto} t={t} t0={ini + 0.1}
                  base={{ fontFamily: SERIF, fontWeight: 600, fontSize: 60, lineHeight: 1.16, color: C.tinta, letterSpacing: -0.5 }}
                  destaque={{ fontStyle: 'italic', fontWeight: 500, color: C.destaque }} />
              </div>
            )}
            <div style={{
              width: '100%', backgroundColor: C.cartao, borderRadius: 48, border: `2px solid ${C.borda}`,
              padding: '76px 76px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: '0 18px 50px rgba(17,17,17,0.08)', transform: `translateY(${(1 - entra) * 24}px)`,
            }}>
              <Marca tam={104} fundo={C.cartao} traco={C.tinta} borda={C.borda} />
              <div style={{ marginTop: 52, textAlign: 'center' }}>
                <Palavras texto={c.versiculo.texto} t={t} t0={ini + 0.5} ritmo={0.05}
                  base={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs, lineHeight: 1.36, color: C.tinta }} destaque={{}} />
              </div>
              <div style={{ marginTop: 44, fontFamily: SANS, fontWeight: 500, fontSize: 34, color: C.apagado }}>{c.versiculo.referencia}</div>
              <div style={{ marginTop: 40, fontFamily: SANS, fontWeight: 600, fontSize: 28, color: C.apagado }}>Maná</div>
            </div>
          </AbsoluteFill>
        );
      })}

      {/* o fecho escuro, igual ao slide final */}
      <AbsoluteFill style={{ backgroundColor: C.escuro, opacity: escuro }} />
      {idxFinal >= 0 && t >= tFinal - 0.1 && (() => {
        const c = cenas[idxFinal]!;
        const e = (d: number) => interpolate(t, [tFinal + d, tFinal + d + 0.8], [0, 1], { ...clamp, easing: suave });
        return (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 96px' }}>
            <div style={{ opacity: e(0.2), transform: `scale(${0.94 + 0.06 * e(0.2)})` }}>
              <Marca tam={150} fundo="#FFFFFF" traco="#111111" />
            </div>
            <div style={{ opacity: e(0.35), marginTop: 40, fontFamily: SERIF, fontWeight: 600, fontSize: 104, color: C.tintaEscura, letterSpacing: -2 }}>Maná</div>
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <Palavras texto={c.texto} t={t} t0={tFinal + 0.6}
                base={{ fontFamily: SERIF, fontWeight: 500, fontSize: 60, lineHeight: 1.2, color: C.tintaEscura }}
                destaque={{ fontStyle: 'italic', color: '#FFFFFF' }} />
            </div>
            {c.sub && (
              <div style={{ opacity: e(1.2), marginTop: 36, fontFamily: SANS, fontWeight: 500, fontSize: 40, lineHeight: 1.4, color: C.suaveEscuro, textAlign: 'center' }}>{c.sub}</div>
            )}
            <div style={{ opacity: e(1.5), marginTop: 64, padding: '18px 40px', borderRadius: 999, backgroundColor: '#FFFFFF', fontFamily: SANS, fontWeight: 600, fontSize: 38, color: '#111111' }}>
              {arroba}
            </div>
          </AbsoluteFill>
        );
      })()}

      {trilha && <Audio src={staticFile(trilha)} volume={volume} />}
    </AbsoluteFill>
  );
};
