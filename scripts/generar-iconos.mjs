// Genera los iconos PWA a partir del lenguaje visual del favicon.
// Uso: node scripts/generar-iconos.mjs
//
// No usa dependencias: dibuja en un búfer RGBA y escribe PNG con zlib.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(AQUI, '..', 'public');

const ACENTO = [166, 73, 31];
const ACENTO_FUERTE = [124, 52, 18];
const MASA = [250, 242, 228];

/** Dibuja un icono cuadrado de `tamano` px y devuelve el PNG. */
function icono(tamano, { maskable = false } = {}) {
  const escala = 4;
  const ancho = tamano * escala;
  const pixeles = new Uint8Array(ancho * ancho * 4);

  const radio = maskable ? 0 : ancho * 0.22;
  const centro = ancho / 2;
  const proporcion = maskable ? 0.62 : 0.82;

  // Fondo: cuadrado redondeado color acento.
  for (let y = 0; y < ancho; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      if (!dentroRectanguloRedondeado(x, y, 0, 0, ancho, ancho, radio)) {
        continue;
      }

      pintar(pixeles, ancho, x, y, ACENTO, 255);
    }
  }

  // Barra de pan: cápsula de masa con borde oscuro y dos cortes.
  const panAncho = ancho * 0.56 * proporcion;
  const panAlto = ancho * 0.34 * proporcion;
  const borde = Math.max(ancho * 0.012, 1);

  capsula(
    pixeles,
    ancho,
    centro,
    centro,
    panAncho + borde * 2,
    panAlto + borde * 2,
    ACENTO_FUERTE,
  );
  capsula(pixeles, ancho, centro, centro, panAncho, panAlto, MASA);

  const corte = panAncho * 0.5;
  const separacion = panAlto * 0.2;
  const grosor = Math.max(ancho * 0.016, 1);

  linea(
    pixeles,
    ancho,
    centro - corte / 2,
    centro - separacion,
    centro + corte / 2,
    centro - separacion,
    grosor,
    ACENTO,
  );
  linea(
    pixeles,
    ancho,
    centro - corte / 2,
    centro + separacion,
    centro + corte / 2,
    centro + separacion,
    grosor,
    ACENTO,
  );

  return codificarPng(escala, tamano, pixeles);
}

function capsula(pixeles, ancho, cx, cy, anchoCapsula, altoCapsula, color) {
  const r = altoCapsula / 2;
  const izquierda = cx - anchoCapsula / 2;
  const arriba = cy - altoCapsula / 2;

  for (let y = Math.floor(arriba) - 1; y < arriba + altoCapsula + 1; y += 1) {
    for (let x = Math.floor(izquierda) - 1; x < izquierda + anchoCapsula + 1; x += 1) {
      if (
        dentroRectanguloRedondeado(
          x,
          y,
          izquierda,
          arriba,
          anchoCapsula,
          altoCapsula,
          r,
        )
      ) {
        pintar(pixeles, ancho, x, y, color, 255);
      }
    }
  }
}

function linea(pixeles, ancho, x1, y1, x2, y2, grosor, color) {
  const pasos = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) + 1;
  const r = grosor / 2;

  for (let paso = 0; paso <= pasos; paso += 1) {
    const t = paso / pasos;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;

    for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y += 1) {
      for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x += 1) {
        if (Math.hypot(x - cx, y - cy) <= r) {
          pintar(pixeles, ancho, x, y, color, 255);
        }
      }
    }
  }
}

function dentroRectanguloRedondeado(x, y, rx, ry, ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  const ax = Math.min(Math.max(x, rx + r), rx + ancho - r);
  const ay = Math.min(Math.max(y, ry + r), ry + alto - r);

  if (x >= rx && x <= rx + ancho && y >= ry + r && y <= ry + alto - r) {
    return true;
  }

  if (y >= ry && y <= ry + alto && x >= rx + r && x <= rx + ancho - r) {
    return true;
  }

  return Math.hypot(x - ax, y - ay) <= r;
}

function pintar(pixeles, ancho, x, y, color, alfa) {
  if (x < 0 || y < 0 || x >= ancho || y >= ancho) {
    return;
  }

  const indice = (y * ancho + x) * 4;

  pixeles[indice] = color[0];
  pixeles[indice + 1] = color[1];
  pixeles[indice + 2] = color[2];
  pixeles[indice + 3] = alfa;
}

function codificarPng(escala, tamano, pixeles) {
  const anchoFuente = tamano * escala;
  const paso = tamano * 4 + 1;
  const filas = Buffer.alloc(paso * tamano);

  for (let y = 0; y < tamano; y += 1) {
    const destino = y * paso;

    filas[destino] = 0; // filtro "None"

    for (let x = 0; x < tamano; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < escala; sy += 1) {
        for (let sx = 0; sx < escala; sx += 1) {
          const indice =
            ((y * escala + sy) * anchoFuente + (x * escala + sx)) * 4;

          r += pixeles[indice];
          g += pixeles[indice + 1];
          b += pixeles[indice + 2];
          a += pixeles[indice + 3];
        }
      }

      const muestras = escala * escala;
      const salida = destino + 1 + x * 4;

      filas[salida] = Math.round(r / muestras);
      filas[salida + 1] = Math.round(g / muestras);
      filas[salida + 2] = Math.round(b / muestras);
      filas[salida + 3] = Math.round(a / muestras);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamano, 0);
  ihdr.writeUInt32BE(tamano, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

function trozo(tipo, datos) {
  const nombre = Buffer.from(tipo, 'ascii');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nombre, datos])), 0);

  return Buffer.concat([largo, nombre, datos, crc]);
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

function crc32(datos) {
  let crc = 0xffffffff;

  for (const byte of datos) {
    crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

writeFileSync(join(PUBLICO, 'pwa-192x192.png'), icono(192));
writeFileSync(join(PUBLICO, 'pwa-512x512.png'), icono(512));
writeFileSync(
  join(PUBLICO, 'pwa-maskable-512x512.png'),
  icono(512, { maskable: true }),
);

console.log('Iconos PWA generados en public/.');
