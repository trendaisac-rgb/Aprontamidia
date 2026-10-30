import React, { useEffect, useState } from 'react';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/inter/500.css';
import {
  AbsoluteFill, Audio, Img, continueRender, delayRender, interpolate, random, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// Vídeo calmo do Maná: foto de fundo com zoom bem lento, uma luz quente passando, poeira de luz subindo,
// e o texto entrando no ritmo da voz. Nada pisca, nada pula: toda entrada é fade com um leve desfoque.

export type Trecho = { texto: string; inicio: number };
export type PropsVersiculo = {
  imagem: string;
  voz: string | null;
  trilha: string | null;
  duracao: number;
  gancho: { tela: string; inicio: number; fim: number };
  versiculo: { frases: Trecho[]; inicio: number; referencia: string; refInicio: number };
  fecho: { tela: string; inicio: number };
  arroba: string;
};

const DOURADO = '#EBCB86';
const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const suave = Easing.bezier(0.25, 0.1, 0.25, 1);

const useFontes = () => {
  const [h] = useState(() => delayRender('fontes'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('500 60px Newsreader'),
      document.fonts.load('400 60px Newsreader'),
      document.fonts.load('italic 500 60px Newsreader'),
      document.fonts.load('500 30px Inter'),
    ]).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};

/** Entrada calma: opacidade, desfoque e um deslize curto, em `dur` segundos a partir de `t0`. */
const entrada = (t: number, t0: number, dur = 0.8) => {
  const p = interpolate(t, [t0, t0 + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });
  return { opacity: p, filter: `blur(${(1 - p) * 8}px)`, transform: `translateY(${(1 - p) * 14}px)` };
};
const saida = (t: number, t0: number, dur = 0.6) =>
  interpolate(t, [t0, t0 + dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });

/** "texto com *destaque*": o trecho entre asteriscos sai em itálico dourado. */
const ComDestaque: React.FC<{ texto: string }> = ({ texto }) => (
  <>
    {texto.split(/(\*[^*]+\*)/g).map((p, i) =>
      p.startsWith('*') && p.endsWith('*') ? (
        <span key={i} style={{ color: DOURADO, fontStyle: 'italic' }}>{p.slice(1, -1)}</span>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      ),
    )}
  </>
);

const Fundo: React.FC<{ imagem: string; t: number; total: number }> = ({ imagem, t, total }) => {
  const zoom = interpolate(t, [0, total], [1.04, 1.16]);
  const y = interpolate(t, [0, total], [0, -36]);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#0d0b09' }}>
      <Img
        src={staticFile(imagem)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${zoom}) translateY(${y}px)`,
          filter: 'brightness(0.8) saturate(0.92)',
        }}
      />
      {/* escurece em cima e embaixo para o texto ler bem, sem matar a foto */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(12,9,6,0.62) 0%, rgba(12,9,6,0.34) 38%, rgba(12,9,6,0.40) 62%, rgba(12,9,6,0.74) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)' }} />
    </AbsoluteFill>
  );
};

const Luz: React.FC<{ t: number; total: number }> = ({ t, total }) => {
  const x = interpolate(t, [0, total], [-25, 115]);
  const y = 30 + Math.sin(t / 5) * 6;
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`, width: 900, height: 900, marginLeft: -450, marginTop: -450,
        background: 'radial-gradient(circle, rgba(255,226,170,0.20) 0%, rgba(255,214,150,0.08) 40%, rgba(255,210,140,0) 70%)',
        filter: 'blur(30px)',
      }} />
    </AbsoluteFill>
  );
};

const Poeira: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {new Array(26).fill(0).map((_, i) => {
      const x0 = random(`x${i}`) * 1080;
      const y0 = random(`y${i}`) * 1920;
      const v = 6 + random(`v${i}`) * 12; // px por segundo, bem devagar
      const tam = 3 + random(`s${i}`) * 5;
      const op = 0.12 + random(`o${i}`) * 0.3;
      const y = ((y0 - t * v) % 1920 + 1920) % 1920;
      const x = x0 + Math.sin(t / (3 + random(`w${i}`) * 3) + i) * 18;
      return (
        <div key={i} style={{
          position: 'absolute', left: x, top: y, width: tam, height: tam, borderRadius: '50%',
          background: 'rgba(255,236,200,1)', opacity: op, filter: 'blur(1px)',
        }} />
      );
    })}
  </AbsoluteFill>
);

const tamanhoDoVersiculo = (texto: string) => {
  const n = texto.length;
  if (n <= 120) return 64;
  if (n <= 180) return 58;
  if (n <= 260) return 52;
  if (n <= 360) return 46;
  return 40;
};

export const Versiculo: React.FC<PropsVersiculo> = (p) => {
  useFontes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = p.duracao;
  const textoTodo = p.versiculo.frases.map((f) => f.texto).join(' ');
  const fs = tamanhoDoVersiculo(textoTodo);

  const ganchoVisivel = t < p.gancho.fim + 1.2;
  const versoOpacidade = saida(t, p.fecho.inicio - 0.3, 0.7);
  const finalEscuro = interpolate(t, [total - 0.9, total], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const volumeTrilha = (f: number) => {
    const s = f / fps;
    const entra = interpolate(s, [0, 1.5], [0, 1], { extrapolateRight: 'clamp' });
    const sai = interpolate(s, [total - 2.2, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return 0.14 * entra * sai;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0b09' }}>
      <Fundo imagem={p.imagem} t={t} total={total} />
      <Luz t={t} total={total} />
      <Poeira t={t} />

      {/* gancho */}
      {ganchoVisivel && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 110px', paddingBottom: 180 }}>
          <div style={{
            ...entrada(t, p.gancho.inicio, 0.9), opacity: entrada(t, p.gancho.inicio, 0.9).opacity * saida(t, p.gancho.fim + 0.3, 0.8),
            fontFamily: SERIF, fontWeight: 500, fontSize: 84, lineHeight: 1.18, color: '#FBF7EF', textAlign: 'center',
            textShadow: '0 2px 24px rgba(0,0,0,0.45)', textWrap: 'balance',
          } as React.CSSProperties}>
            <ComDestaque texto={p.gancho.tela} />
          </div>
        </AbsoluteFill>
      )}

      {/* versículo: o texto inteiro já está diagramado (invisível), e cada frase acende quando é lida */}
      {t >= p.versiculo.inicio - 0.5 && versoOpacidade > 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 96px', paddingBottom: 160, opacity: versoOpacidade }}>
          <div style={{
            fontFamily: SERIF, fontWeight: 400, fontSize: fs, lineHeight: 1.36, color: '#FBF7EF', textAlign: 'center',
            textShadow: '0 2px 20px rgba(0,0,0,0.5)', textWrap: 'pretty',
          } as React.CSSProperties}>
            {p.versiculo.frases.map((f, i) => (
              <span key={i} style={{ ...entrada(t, f.inicio - 0.15, 0.9), display: 'inline' }}>
                {f.texto}{i < p.versiculo.frases.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
          <div style={{
            ...entrada(t, p.versiculo.refInicio, 0.9), marginTop: 46, fontFamily: SANS, fontWeight: 500, fontSize: 34,
            letterSpacing: 2, color: DOURADO, textShadow: '0 2px 16px rgba(0,0,0,0.5)',
          }}>
            {p.versiculo.referencia}
          </div>
        </AbsoluteFill>
      )}

      {/* fecho */}
      {t >= p.fecho.inicio - 0.2 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 120px', paddingBottom: 160 }}>
          <div style={{
            ...entrada(t, p.fecho.inicio, 1.0), fontFamily: SERIF, fontWeight: 500, fontSize: 72, lineHeight: 1.2,
            color: '#FBF7EF', textAlign: 'center', textShadow: '0 2px 24px rgba(0,0,0,0.45)', textWrap: 'balance',
          } as React.CSSProperties}>
            <ComDestaque texto={p.fecho.tela} />
          </div>
          <div style={{ ...entrada(t, p.fecho.inicio + 0.7, 1.0), marginTop: 40, fontFamily: SANS, fontWeight: 500, fontSize: 34, color: 'rgba(251,247,239,0.85)' }}>
            {p.arroba}
          </div>
        </AbsoluteFill>
      )}

      {/* assinatura discreta o vídeo todo, longe da faixa de legenda das redes */}
      <div style={{
        position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic',
        fontWeight: 500, fontSize: 38, color: 'rgba(251,247,239,0.78)', letterSpacing: 1,
        opacity: interpolate(t, [0.2, 1.4], [0, 1], { extrapolateRight: 'clamp' }) * saida(t, p.fecho.inicio - 0.3, 0.7),
      }}>
        Maná
      </div>

      <AbsoluteFill style={{ backgroundColor: '#000', opacity: finalEscuro }} />

      {p.voz && <Audio src={staticFile(p.voz)} />}
      {p.trilha && <Audio src={staticFile(p.trilha)} volume={volumeTrilha} />}
    </AbsoluteFill>
  );
};
