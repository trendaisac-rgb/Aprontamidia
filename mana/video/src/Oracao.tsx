import React, { useEffect, useState } from 'react';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/600-italic.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/inter/500.css';
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// Oração narrada do Maná (manhã e noite): imagem de arquivo trocando devagar, a voz no centro de tudo
// e o texto montando na tela palavra por palavra, no tempo em que é falado. Termina com a marca.

// p: a palavra como é falada. t: como aparece na tela, quando difere da fala (ex.: "SENHOR," no versículo).
// q: força começar um bloco novo nesta palavra, para a frase quebrar no lugar certo.
export type Palavra = { p: string; i: number; f: number; t?: string; q?: boolean };
export type PropsOracao = {
  voz: string;
  trilha: string | null;
  volumeTrilha?: number;
  trilhaInicio?: number; // segundo da trilha em que a música começa
  duracao: number; // total, com o fecho
  clipes: string[]; // vídeos em public/, na ordem
  trocas?: number[]; // segundo em que cada clipe entra (o primeiro é 0). Sem isso, dividem o tempo por igual
  filtro?: string; // ajuste de cor dos clipes (CSS filter)
  abertura: { titulo: string; dia: string; ate: number; tamanho?: number }; // "Bom dia!" + data, até esse segundo
  etiqueta: string; // fica pequena no topo depois da abertura
  palavras: Palavra[];
  versiculo: { de: number; ate: number; referencia: string } | null; // índices em palavras (ate exclusivo)
  fecho: { inicio: number; sub: string; arroba: string };
};

const DOURADO = '#FFE7A8';
const BRANCO = '#FFFAF0';
const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const suave = Easing.bezier(0.25, 0.1, 0.25, 1);
const SOMBRA = '0 3px 34px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.6)';

const useFontes = () => {
  const [h] = useState(() => delayRender('fontes'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('500 60px Newsreader'),
      document.fonts.load('600 60px Newsreader'),
      document.fonts.load('italic 600 60px Newsreader'),
      document.fonts.load('italic 500 60px Newsreader'),
      document.fonts.load('500 30px Inter'),
    ]).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};

const rampa = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });

type Grupo = { de: number; ate: number; verso: boolean };

/** Junta as palavras em blocos curtos de leitura. O versículo fica inteiro num bloco só (até 14 palavras). */
export const agrupar = (p: PropsOracao): Grupo[] => {
  const g: Grupo[] = [];
  const v = p.versiculo;
  let i = p.palavras.findIndex((w) => w.i >= p.abertura.ate - 0.05);
  if (i < 0) i = p.palavras.length;
  while (i < p.palavras.length) {
    if (v && i === v.de) {
      let a = v.de;
      while (a < v.ate) {
        let b = Math.min(v.ate, a + 14);
        if (b < v.ate) { for (let k = b; k > a + 4; k--) if (/[;:.!?]$/.test(p.palavras[k - 1].p)) { b = k; break; } }
        g.push({ de: a, ate: b, verso: true }); a = b;
      }
      i = v.ate; continue;
    }
    const limite = v && i < v.de ? v.de : p.palavras.length;
    let j = i, letras = 0;
    while (j < limite) {
      const w = p.palavras[j].p; letras += w.length + 1; j++;
      if (/(\.\.\.|[.!?;:,])$/.test(w)) break;
      if (j - i >= 3 || letras >= 17) break;
      if (j < limite && p.palavras[j].q) break;
      if (j < limite && p.palavras[j].i - p.palavras[j - 1].f > 0.3) break;
    }
    g.push({ de: i, ate: j, verso: false }); i = j;
  }
  return g;
};

const limpa = (w: string) => w.replace(/[.,;:]+$/g, '');

export const Oracao: React.FC<PropsOracao> = (p) => {
  useFontes();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const total = p.duracao;
  const grupos = React.useMemo(() => agrupar(p), [p]);

  // fundo: os clipes dividem o tempo por igual, com fusão entre um e outro
  const n = p.clipes.length;
  const fusao = 0.7;
  const entradas = p.trocas && p.trocas.length === n ? p.trocas : p.clipes.map((_, k) => (k * total) / n);
  const FILTRO = p.filtro ?? 'brightness(1.1) saturate(1.22) contrast(1.03)';

  // legenda atual
  let atual: Grupo | null = null;
  for (let k = 0; k < grupos.length; k++) {
    const g = grupos[k];
    const ini = p.palavras[g.de].i - 0.08;
    const prox = k + 1 < grupos.length ? p.palavras[grupos[k + 1].de].i - 0.08 : p.fecho.inicio;
    const fim = Math.min(prox, p.palavras[g.ate - 1].f + (g.verso ? 1.4 : 0.9));
    if (t >= ini && t < fim) { atual = g; break; }
  }

  const emAbertura = t < p.abertura.ate + 0.5;
  const abreOpac = 1 - rampa(t, p.abertura.ate, p.abertura.ate + 0.5);
  const emFecho = t >= p.fecho.inicio - 0.1;
  const fechoOpac = rampa(t, p.fecho.inicio, p.fecho.inicio + 0.7);

  const vol = p.volumeTrilha ?? 0.16;
  const volumeTrilha = (f: number) => {
    const s = f / fps;
    const base = interpolate(s, [0, 1.2], [0.5, 1], { extrapolateRight: 'clamp' });
    const sobe = interpolate(s, [p.fecho.inicio, p.fecho.inicio + 0.8], [1, 2.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const some = interpolate(s, [total - 1.4, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return vol * base * sobe * some;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#120c06' }}>
      {p.clipes.map((src, k) => {
        const passo = (k + 1 < n ? entradas[k + 1] : total) - entradas[k];
        const de = Math.max(0, Math.round((entradas[k] - (k ? fusao : 0)) * fps));
        const dur = Math.round((passo + (k ? fusao : 0) + 0.1) * fps);
        const tl = t - de / fps;
        return (
          <Sequence key={k} from={de} durationInFrames={dur}>
            <AbsoluteFill style={{ opacity: k ? rampa(tl, 0, fusao) : 1, transform: `scale(${1.02 + 0.05 * Math.min(1, Math.max(0, tl / (passo + fusao)))})` }}>
              <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTRO }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(16,10,4,0.34) 0%, rgba(16,10,4,0.06) 24%, rgba(16,10,4,0.10) 62%, rgba(16,10,4,0.42) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 90% 30% at 50% 47%, rgba(10,6,2,0.34) 0%, rgba(10,6,2,0.14) 60%, rgba(10,6,2,0) 100%)' }} />

      {/* abertura: no quadro 0 o cumprimento e a data já estão na tela */}
      {emAbertura && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: abreOpac, paddingBottom: 120 }}>
          <div style={{
            fontFamily: SERIF, fontWeight: 500, fontSize: p.abertura.tamanho ?? 190, lineHeight: 1.06, color: BRANCO, textShadow: SOMBRA,
            textAlign: 'center', whiteSpace: 'pre-line', padding: '0 70px',
            transform: `scale(${interpolate(t, [0, 0.6], [1.05, 1], { extrapolateRight: 'clamp', easing: suave })})`,
          }}>
            {p.abertura.titulo}
          </div>
          <div style={{
            marginTop: 40, padding: '16px 38px', borderRadius: 999, background: 'rgba(16,10,4,0.45)',
            border: '2px solid rgba(246,213,142,0.75)', fontFamily: SANS, fontWeight: 500, fontSize: 44, color: DOURADO,
          }}>
            {p.abertura.dia}
          </div>
        </AbsoluteFill>
      )}

      {/* etiqueta pequena no topo, depois da abertura */}
      {!emFecho && (
        <div style={{
          position: 'absolute', top: 170, width: '100%', textAlign: 'center', opacity: rampa(t, p.abertura.ate + 0.2, p.abertura.ate + 0.9) * 0.92,
          fontFamily: SANS, fontWeight: 500, fontSize: 32, letterSpacing: 0.5, color: DOURADO, textShadow: SOMBRA,
        }}>
          {p.etiqueta}
        </div>
      )}

      {/* legenda: o bloco monta palavra por palavra, no tempo da voz */}
      {atual && !emFecho && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: atual.verso ? '0 84px' : '0 90px', paddingBottom: 110 }}>
          <div style={{
            fontFamily: SERIF, fontWeight: 600, fontStyle: atual.verso ? 'italic' : 'normal',
            fontSize: atual.verso ? 84 : 118, lineHeight: atual.verso ? 1.26 : 1.12,
            color: atual.verso ? DOURADO : BRANCO, textShadow: SOMBRA,
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.26em', maxWidth: 900,
          } as React.CSSProperties}>
            {p.palavras.slice(atual.de, atual.ate).map((w, k) => {
              // bloco comum: entra inteiro, de uma vez. Versículo: fica todo na tela e cada palavra acende quando é lida.
              const entra = rampa(t, p.palavras[atual!.de].i - 0.1, p.palavras[atual!.de].i + 0.14);
              const lida = rampa(t, w.i - 0.1, w.i + 0.15);
              const op = atual!.verso ? entra * (0.72 + 0.28 * lida) : entra;
              return (
                <span key={k} style={{ opacity: op, display: 'inline-block', transform: `translateY(${(1 - entra) * 12}px)` }}>
                  {atual!.verso ? (w.t ?? w.p) : limpa(w.t ?? w.p)}
                </span>
              );
            })}
          </div>
          {atual.verso && p.versiculo && (
            <div style={{
              marginTop: 44, fontFamily: SANS, fontWeight: 500, fontSize: 38, letterSpacing: 1.5, color: BRANCO, textShadow: SOMBRA,
              opacity: rampa(t, p.palavras[atual.de].i + 0.2, p.palavras[atual.de].i + 0.9),
            }}>
              {p.versiculo.referencia}
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* fecho com a marca */}
      {emFecho && (
        <AbsoluteFill style={{ opacity: fechoOpac }}>
          <AbsoluteFill style={{ backgroundColor: 'rgba(12,8,3,0.42)' }} />
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 100px', paddingBottom: 60 }}>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 150, color: BRANCO, textShadow: SOMBRA }}>Maná</div>
            <div style={{ marginTop: 26, fontFamily: SANS, fontWeight: 500, fontSize: 38, lineHeight: 1.4, color: BRANCO, textAlign: 'center', textShadow: SOMBRA, maxWidth: 800 }}>
              {p.fecho.sub}
            </div>
            <div style={{ marginTop: 40, padding: '14px 36px', borderRadius: 999, background: BRANCO, fontFamily: SANS, fontWeight: 500, fontSize: 36, color: '#1a130c' }}>
              {p.fecho.arroba}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      <Audio src={staticFile(p.voz)} />
      {p.trilha && <Audio src={staticFile(p.trilha)} volume={volumeTrilha} startFrom={Math.round((p.trilhaInicio ?? 0) * fps)} loop />}
    </AbsoluteFill>
  );
};
