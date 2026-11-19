// Préparation des photos de cours avant lecture par Claude, et zoom sur une zone.
// Tout se passe sur le téléphone : rien n'est envoyé tant que l'élève n'a pas lancé l'analyse.

// Taille des images envoyées à Claude (bord le plus long, en pixels).
// Manuscrit : haute définition (Claude Opus 5.5 lit jusqu'à 2576 px), indispensable pour une écriture fine ou pâle.
// Imprimé : 1280 px suffisent et coûtent environ 3 fois moins de tokens.
export const TAILLES = { manuscrit: 2400, imprime: 1280 };
const TAILLE_ORIGINAL = 3200; // copie gardée en mémoire pour les zooms

const charger = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Image illisible"));
    img.src = src;
  });

function dessiner(img, max) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Nettoie une photo de cahier :
 * 1. efface les ombres et le jaunissement : on estime la couleur du papier zone par zone (pixels les plus clairs
 *    de chaque case, donc sans l'encre), on lisse, puis on divise l'image par ce fond ;
 * 2. fonce l'encre pâle et le crayon (étirement du contraste + courbe qui assombrit les tons moyens).
 * Les couleurs sont conservées : un titre en rouge reste rouge.
 */
export function ameliorer(c) {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // 1. Fond du papier, case par case.
  const cote = Math.max(16, Math.round(Math.min(w, h) / 48));
  const gw = Math.ceil(w / cote), gh = Math.ceil(h / cote);
  const grille = new Float32Array(gw * gh * 3);
  const histo = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * cote, y0 = gy * cote, x1 = Math.min(w, x0 + cote), y1 = Math.min(h, y0 + cote);
      histo.fill(0);
      let n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = (y * w + x) * 4;
        histo[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
        n++;
      }
      // Seuil : les 25 % de pixels les plus clairs de la case = le papier.
      let seuil = 255, cumul = 0;
      for (let v = 255; v >= 0; v--) { cumul += histo[v]; if (cumul >= n * 0.25) { seuil = v; break; } }
      let r = 0, g = 0, bl = 0, m = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = (y * w + x) * 4;
        if (((d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8) >= seuil) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; m++; }
      }
      const k = (gy * gw + gx) * 3;
      grille[k] = r / m; grille[k + 1] = g / m; grille[k + 2] = bl / m;
    }
  }
  // Lissage (deux passes 3×3) pour éviter les marches entre cases.
  for (let passe = 0; passe < 2; passe++) {
    const copie = grille.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) for (let ch = 0; ch < 3; ch++) {
      let sum = 0, nb = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = gy + dy, xx = gx + dx;
        if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) { sum += copie[(yy * gw + xx) * 3 + ch]; nb++; }
      }
      grille[(gy * gw + gx) * 3 + ch] = sum / nb;
    }
  }
  // Agrandissement lissé de la grille à la taille de la photo.
  const petit = document.createElement("canvas");
  petit.width = gw; petit.height = gh;
  const pctx = petit.getContext("2d");
  const pimg = pctx.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) {
    pimg.data[i * 4] = grille[i * 3]; pimg.data[i * 4 + 1] = grille[i * 3 + 1]; pimg.data[i * 4 + 2] = grille[i * 3 + 2]; pimg.data[i * 4 + 3] = 255;
  }
  pctx.putImageData(pimg, 0, 0);
  const fond = document.createElement("canvas");
  fond.width = w; fond.height = h;
  const fctx = fond.getContext("2d", { willReadFrequently: true });
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(petit, 0, 0, w, h);
  const bg = fctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, (d[i + k] * 250) / Math.max(bg[i + k], 30));
  }
  // 2. Contraste : papier → blanc, encre la plus foncée → noir, tons moyens assombris (crayon, encre pâle).
  histo.fill(0);
  for (let i = 0; i < d.length; i += 4) histo[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
  const total = w * h;
  let bas = 0, cumul = 0;
  for (let v = 0; v < 256; v++) { cumul += histo[v]; if (cumul >= total * 0.002) { bas = v; break; } }
  const haut = 242;
  if (haut - bas > 30) {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.pow(Math.min(1, Math.max(0, (v - bas) / (haut - bas))), 1.6) * 255;
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = lut[d[i + k]];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Prépare une page : version envoyée à Claude + copie haute définition pour les zooms.
 * @param {string} dataUrl photo d'origine
 * @param {"manuscrit"|"imprime"} type
 */
export async function preparerPage(dataUrl, type = "manuscrit") {
  const img = await charger(dataUrl);
  const original = ameliorer(dessiner(img, TAILLE_ORIGINAL));
  const envoi = dessiner(original, TAILLES[type] || TAILLES.manuscrit);
  const out = envoi.toDataURL("image/jpeg", type === "manuscrit" ? 0.88 : 0.8);
  const apercu = dessiner(envoi, 420).toDataURL("image/jpeg", 0.7);
  return {
    kind: "image",
    mediaType: "image/jpeg",
    data: out.split(",")[1],
    preview: apercu,
    largeur: envoi.width,
    hauteur: envoi.height,
    original: original.toDataURL("image/jpeg", 0.92),
  };
}

/**
 * Agrandit une zone d'une page (coordonnées en pixels de l'image envoyée à Claude).
 * Renvoie un JPEG en base64 d'environ 1400 px de large, découpé dans la copie haute définition.
 */
export async function zoomer(page, { x0, y0, x1, y1 }) {
  const img = await charger(page.original);
  const k = img.width / page.largeur;
  let [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  let [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  // Marge de 4 % et taille minimale, pour garder le contexte autour du mot.
  const mx = Math.max(16, (bx - ax) * 0.04), my = Math.max(16, (by - ay) * 0.04);
  ax = Math.max(0, ax - mx); ay = Math.max(0, ay - my);
  bx = Math.min(page.largeur, bx + mx); by = Math.min(page.hauteur, by + my);
  if (bx - ax < 48 || by - ay < 24) throw new Error("Zone trop petite ou hors de la page.");
  const sx = ax * k, sy = ay * k, sw = (bx - ax) * k, sh = (by - ay) * k;
  const cible = Math.min(1400, Math.max(sw, sh) * 2.5) / Math.max(sw, sh);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * cible));
  c.height = Math.max(1, Math.round(sh * cible));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9).split(",")[1];
}

/** Reprend une page déjà préparée à une autre définition (depuis sa copie haute définition). */
export async function changerType(page, type) {
  const img = await charger(page.original);
  const envoi = dessiner(img, TAILLES[type] || TAILLES.manuscrit);
  return { ...page, data: envoi.toDataURL("image/jpeg", type === "manuscrit" ? 0.88 : 0.8).split(",")[1], largeur: envoi.width, hauteur: envoi.height };
}
