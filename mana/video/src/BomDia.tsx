import React, { useEffect, useState } from 'react';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/inter/500.css';
import {
  AbsoluteFill, Audio, OffthreadVideo, continueRender, delayRender, interpolate, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// "Bom dia" do Maná: o cumprimento e a data já no primeiro quadro, uma mensagem curta, o versículo e o convite
// para mandar para alguém. Fundo em vídeo (amanhecer), texto grande e legível desde o quadro 0.

export type Bloco = { texto: string; inicio: number; fim: number };
export type PropsBomDia = {
  fundo: string; // vídeo em public/
  trilha: string | null;
  duracao: number;
  dia: string; // "Terça-feira, 17 de novembro"
  mensagem: Bloco[];
  versiculo: Bloco & { referencia: string };
  fecho: { tela: string; sub: string; inicio: number };
  arroba: string;
};

const DOURADO = '#F2D391';
const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const suave = Easing.bezier(0.25, 0.1, 0.25, 1);
const SOMBRA = '0 2px 26px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)';

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

const entra = (t: number, t0: number, dur = 0.7) =>
  interpolate(t, [t0, t0 + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });
const sai = (t: number, t0: number, dur = 0.5) =>
  interpolate(t, [t0, t0 + dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });

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

const Centro: React.FC<{ t: number; b: Bloco; children: React.ReactNode }> = ({ t, b, children }) => {
  if (t < b.inicio - 0.1 || t > b.fim + 0.6) return null;
  const p = entra(t, b.inicio);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 92px', paddingTop: 160 }}>
      <div style={{ opacity: p * sai(t, b.fim), transform: `translateY(${(1 - p) * 16}px)`, textAlign: 'center' }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const BomDia: React.FC<PropsBomDia> = (p) => {
  useFontes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = p.duracao;
  const topo = sai(t, p.fecho.inicio - 0.4, 0.5);
  const zoom = interpolate(t, [0, total], [1.0, 1.06]);

  const volume = (f: number) => {
    const s = f / fps;
    return 0.9 * interpolate(s, [0, 0.6], [0.4, 1], { extrapolateRight: 'clamp' })
      * interpolate(s, [total - 1.6, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a130c' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <OffthreadVideo src={staticFile(p.fundo)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,12,4,0.55) 0%, rgba(20,12,4,0.30) 30%, rgba(20,12,4,0.38) 62%, rgba(20,12,4,0.62) 100%)' }} />

      {/* cumprimento e data: no quadro 0 já estão na tela */}
      <div style={{ position: 'absolute', top: 210, width: '100%', textAlign: 'center', opacity: topo }}>
        <div style={{
          fontFamily: SERIF, fontWeight: 500, fontSize: 168, lineHeight: 1, color: '#FFFAF0', textShadow: SOMBRA,
          transform: `scale(${interpolate(t, [0, 0.5], [1.05, 1], { extrapolateRight: 'clamp', easing: suave })})`,
        }}>
          Bom dia!
        </div>
        <div style={{
          display: 'inline-block', marginTop: 34, padding: '14px 34px', borderRadius: 999,
          background: 'rgba(20,12,4,0.42)', border: '2px solid rgba(242,211,145,0.7)',
          fontFamily: SANS, fontWeight: 500, fontSize: 40, color: DOURADO, letterSpacing: 0.5,
        }}>
          {p.dia}
        </div>
      </div>

      {p.mensagem.map((b, i) => (
        <Centro key={i} t={t} b={b}>
          <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 78, lineHeight: 1.2, color: '#FFFAF0', textShadow: SOMBRA, textWrap: 'balance', whiteSpace: 'pre-line' } as React.CSSProperties}>
            <ComDestaque texto={b.texto} />
          </div>
        </Centro>
      ))}

      <Centro t={t} b={p.versiculo}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 66, lineHeight: 1.28, color: DOURADO, textShadow: SOMBRA, textWrap: 'balance' } as React.CSSProperties}>
          {p.versiculo.texto}
        </div>
        <div style={{ marginTop: 40, fontFamily: SANS, fontWeight: 500, fontSize: 36, letterSpacing: 1.5, color: '#FFFAF0', textShadow: SOMBRA }}>
          {p.versiculo.referencia}
        </div>
      </Centro>

      {t >= p.fecho.inicio - 0.1 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 100px', opacity: entra(t, p.fecho.inicio, 0.6) }}>
          <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 84, lineHeight: 1.18, color: '#FFFAF0', textAlign: 'center', textShadow: SOMBRA, textWrap: 'balance', whiteSpace: 'pre-line' } as React.CSSProperties}>
            <ComDestaque texto={p.fecho.tela} />
          </div>
          <div style={{ marginTop: 70, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 64, color: '#FFFAF0', textShadow: SOMBRA }}>Maná</div>
          <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 500, fontSize: 32, lineHeight: 1.4, color: 'rgba(255,250,240,0.92)', textAlign: 'center', textShadow: SOMBRA, maxWidth: 760 }}>
            {p.fecho.sub}
          </div>
          <div style={{ marginTop: 26, padding: '10px 28px', borderRadius: 999, background: '#FFFAF0', fontFamily: SANS, fontWeight: 500, fontSize: 32, color: '#1a130c' }}>
            {p.arroba}
          </div>
        </AbsoluteFill>
      )}

      {p.trilha && <Audio src={staticFile(p.trilha)} volume={volume} />}
    </AbsoluteFill>
  );
};
