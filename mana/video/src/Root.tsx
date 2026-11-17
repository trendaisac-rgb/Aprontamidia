import React from 'react';
import { Composition } from 'remotion';
import { Versiculo, type PropsVersiculo } from './Versiculo';
import { Historia, duracaoTotal, type PropsHistoria } from './Historia';
import { Novela, duracaoNovela, type PropsNovela } from './Novela';
import { BomDia, type PropsBomDia } from './BomDia';
import { Oracao, type PropsOracao } from './Oracao';

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

const exemploNovela: PropsNovela = {
  serie: 'José, o sonhador',
  capitulo: 1,
  total: 12,
  trilha: null,
  arroba: '@mana.biblia.app',
  cenas: [
    { tipo: 'cena', dur: 5, texto: 'Aos 17 anos, José teve um sonho.', ref: 'Gênesis 37', midia: 'exemplo.jpg', grande: true },
    { tipo: 'final', dur: 3.5, texto: 'Capítulo 2 amanhã, 12h.', sub: 'A Bíblia no seu feed. Grátis no Google Play.' },
  ],
};

const exemploBomDia: PropsBomDia = {
  fundo: 'exemplo.mp4',
  trilha: null,
  duracao: 18,
  dia: 'Terça-feira, 17 de novembro',
  mensagem: [{ texto: 'Que hoje você não carregue o peso de ontem.', inicio: 0.9, fim: 4.3 }],
  versiculo: { texto: 'Elas são novas a cada manhã; grande é a tua fidelidade.', referencia: 'Lamentações 3:23', inicio: 5, fim: 13 },
  fecho: { tela: 'Manda esse *bom dia* pra alguém.', sub: 'A Bíblia no seu feed. Grátis para ler na App Store e no Google Play.', inicio: 14 },
  arroba: '@mana.biblia.app',
};

const exemploOracao: PropsOracao = {
  voz: 'exemplo.wav', trilha: null, duracao: 8, clipes: ['exemplo.mp4'],
  abertura: { titulo: 'Bom dia!', dia: 'Terça-feira, 17 de novembro', ate: 2 },
  etiqueta: 'Bom dia · Terça-feira, 17 de novembro',
  palavras: [{ p: 'Respira.', i: 2.4, f: 3.2 }],
  versiculo: null,
  fecho: { inicio: 5, sub: 'A Bíblia no seu feed. Grátis para ler na App Store e no Google Play.', arroba: '@mana.biblia.app' },
};

export const Root: React.FC = () => (
  <>
  <Composition
    id="Oracao"
    component={Oracao}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(exemploOracao.duracao * FPS)}
    defaultProps={exemploOracao}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.duracao * FPS) })}
  />
  <Composition
    id="BomDia"
    component={BomDia}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(exemploBomDia.duracao * FPS)}
    defaultProps={exemploBomDia}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.duracao * FPS) })}
  />
  <Composition
    id="Novela"
    component={Novela}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(duracaoNovela(exemploNovela.cenas) * FPS)}
    defaultProps={exemploNovela}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoNovela(props.cenas) * FPS) })}
  />
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
