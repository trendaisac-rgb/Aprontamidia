import React from 'react';
import { Composition } from 'remotion';
import { Versiculo, type PropsVersiculo } from './Versiculo';
import { Historia, duracaoTotal, type PropsHistoria } from './Historia';

export const FPS = 30;

// Exemplo para o estúdio. No render de verdade as props vêm de scripts/gerar.mjs.
const exemplo: PropsVersiculo = {
  imagem: 'exemplo.jpg', // coloque uma foto em public/ para usar o estúdio,
  voz: null,
  trilha: null,
  duracao: 22,
  gancho: { tela: 'Se o medo *apertou* hoje', inicio: 0.3, fim: 4.2 },
  versiculo: {
    frases: [
      { texto: 'Não temas, porque eu estou contigo;', inicio: 5.2 },
      { texto: 'não te assombres, porque eu sou teu Deus.', inicio: 7.6 },
      { texto: 'Eu te fortaleço, te ajudo,', inicio: 10.4 },
      { texto: 'e te sustento com a minha mão direita de justiça.', inicio: 12.3 },
    ],
    inicio: 5.2,
    referencia: 'Isaías 41:10',
    refInicio: 15.8,
  },
  fecho: { tela: 'Salva pra ouvir de novo *amanhã*.', inicio: 18.4 },
  arroba: '@mana.biblia.app',
};

const exemploHistoria: PropsHistoria = {
  trilha: null,
  arroba: '@mana.biblia.app',
  cenas: [
    { tipo: 'imagem', dur: 4, texto: 'Os discípulos acharam que *iam morrer*.', ref: 'Marcos 4:35-41', imagem: 'exemplo.jpg', clima: 'tempestade' },
    { tipo: 'final', dur: 4, texto: 'Manda pra quem está no meio de uma tempestade.', sub: 'A Bíblia no seu feed. Grátis no Google Play.' },
  ],
};

export const Root: React.FC = () => (
  <>
  <Composition
    id="Historia"
    component={Historia}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(duracaoTotal(exemploHistoria.cenas) * FPS)}
    defaultProps={exemploHistoria}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoTotal(props.cenas) * FPS) })}
  />
  <Composition
    id="Versiculo"
    component={Versiculo}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(exemplo.duracao * FPS)}
    defaultProps={exemplo}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.duracao * FPS) })}
  />
  </>
);
