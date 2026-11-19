import "./style.css";
import { marked } from "marked";
import { Capacitor } from "@capacitor/core";
import * as store from "./store.js";
import * as ai from "./claude.js";
import { ficheDeDepart, questionsDepartDemo } from "./demo.js";
import { ouvrirScanner } from "./scanner.js";
import { getMatieres, suggestions, ajouterMatiere, retirerMatiere, EMOJIS, COULEURS, normaliserMatiere, couleur, emoji } from "./matieres.js";

// Version « maquette » publiée en page web : uniquement le mode démo.
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "1";

const app = document.getElementById("app");

// ---------- Petits outils ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Le Markdown vient de Claude : on neutralise tout HTML avant de l'afficher.
const md = (s = "") => marked.parse(String(s).replace(/</g, "&lt;"), { breaks: true });
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
// Fenêtre de confirmation intégrée (les fenêtres du navigateur ne marchent pas partout).
function confirmer(message, libelleOk = "Supprimer") {
  return new Promise((resolve) => {
    const d = document.createElement("div");
    d.className = "modal";
    d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p>${esc(message)}</p>
      <div class="row"><button class="btn secondary" data-r="0">Annuler</button><button class="btn bad" data-r="1">${esc(libelleOk)}</button></div></div>`;
    d.onclick = (e) => {
      const r = e.target.closest("[data-r]");
      if (!r && e.target !== d) return;
      d.remove();
      resolve(r?.dataset.r === "1");
    };
    document.body.appendChild(d);
  });
}
// Fenêtre intégrée avec un contenu libre ; bind(boîte, fermer) branche les boutons.
function modale(html, bind) {
  const d = document.createElement("div");
  d.className = "modal";
  d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}</div>`;
  const fermer = () => d.remove();
  d.onclick = (e) => e.target === d && fermer();
  document.body.appendChild(d);
  bind(d.querySelector(".modal-box"), fermer);
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- Navigation ----------
let ui = { view: "home", ficheId: null, tab: "resume", matiere: null, retour: "home" };
const go = (patch) => {
  ui = { ...ui, ...patch };
  render();
  window.scrollTo(0, 0);
};
function back() {
  // Scanner ouvert : le bouton retour le ferme.
  const scanner = document.querySelector(".scanner [data-a=fermer]");
  if (scanner) return scanner.click();
  if (ui.view === "fiche" || ui.view === "scan" || ui.view === "revision") go({ view: ui.retour });
  else if (ui.view === "chapitre") go({ view: "matiere" });
  else if (ui.view === "test") go({ view: "chapitre" });
  else if (ui.view === "settings" || ui.view === "matiere") go({ view: "home", matiere: null });
}

// Remet les anciennes fiches (matière en texte libre) dans la liste fixe des matières.
for (const f of store.getFiches()) {
  const m = normaliserMatiere(f.matiere);
  if (m !== f.matiere) store.saveFiche({ ...f, matiere: m });
}
// Bouton retour d'Android : revient à l'accueil, ou quitte l'appli depuis l'accueil.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", () => (ui.view === "home" || ui.view === "welcome" ? App.exitApp() : back()))
  );
}

function entrerDemo() {
  store.saveSettings({ demo: true });
  if (!store.getFiches().some((f) => f.demoKey)) {
    // Fiche d'exemple avec un test de départ et deux QCM déjà faits, pour montrer le graphique.
    const f = nouvelleFiche(ficheDeDepart());
    const J = 864e5;
    const now = Date.now();
    f.cree = now - 12 * J;
    f.qcm = [
      { date: now - 8 * J, score: 5, total: 10, niveau: "moyen" },
      { date: now - 3 * J, score: 7, total: 10, niveau: "moyen" },
    ];
    store.saveFiche(f);
    store.saveProgres(f.matiere, f.chapitre, { demo: true, depart: { date: now - 12 * J, score: 3, total: 10, questions: questionsDepartDemo() }, finals: [] });
  }
  go({ view: "home" });
}
function quitterDemo() {
  store.saveSettings({ demo: false });
  store.getFiches().filter((f) => f.demoKey).forEach((f) => store.deleteFiche(f.id));
  store.supprimerProgresDemo();
}

function render() {
  const s = store.getSettings();
  if (DEMO_ONLY && !s.demo) return entrerDemo();
  if (!s.apiKey && !s.demo && ui.view !== "settings") ui.view = "welcome";
  const views = { welcome, home, matiere: matiereView, chapitre: chapitreView, test: testView, scan, fiche: ficheView, settings, revision };
  app.innerHTML = views[ui.view]();
  afterRender[ui.view]?.();
}
const afterRender = {};
afterRender.welcome = () => (document.getElementById("btn-demo").onclick = entrerDemo);

// ---------- Accueil (premier lancement) ----------
function welcome() {
  return `
  <div class="welcome">
    <div class="logo">R<span>é</span>vizz</div>
    <p class="big">Scanne tes fiches de cours.<br>Révise avec des résumés, des flashcards, des QCM et des sujets d'entraînement.</p>
    <ol class="steps">
      <li>📸 Prends en photo ta fiche ou ton cahier</li>
      <li>🧠 Claude prépare ta fiche de révision</li>
      <li>🎯 Entraîne-toi jusqu'à tout savoir</li>
    </ol>
    <div class="welcome-actions">
      <button class="btn primary big-btn" data-go="settings">Commencer avec ma clé Claude</button>
      <button class="btn secondary big-btn" id="btn-demo">👀 Essayer la démo, sans clé</button>
    </div>
  </div>`;
}

// ---------- Écran principal ----------
function home() {
  const s = store.getSettings();
  const fiches = store.getFiches();
  const stats = store.getStats();
  const dues = fiches.reduce((n, f) => n + store.cartesDues(f).length, 0);
  const recentes = [...fiches].sort((a, b) => (b.vue || b.cree) - (a.vue || a.cree)).slice(0, 3);
  return `
  <header class="top">
    <div>
      <div class="hello">Salut ${esc(s.prenom || "")} 👋</div>
      <div class="sub">Prêt à réviser ?</div>
    </div>
    <button class="icon" data-go="settings" aria-label="Réglages">⚙️</button>
  </header>

  ${s.demo ? `<div class="demo-banner"><span><b>Mode démo</b> · réponses préparées à l'avance, sans Claude.${DEMO_ONLY ? " En démo, n'importe quelle photo donne la fiche de maths d'exemple." : ""}</span>${DEMO_ONLY ? "" : `<button class="btn secondary" data-go="settings">Utiliser ma clé</button>`}</div>` : ""}
  <section class="stats">
    <div class="stat"><b>🔥 ${stats.serie}</b><span>jour${stats.serie > 1 ? "s" : ""} de suite</span></div>
    <div class="stat"><b>📚 ${fiches.length}</b><span>fiche${fiches.length > 1 ? "s" : ""}</span></div>
    <div class="stat"><b>🃏 ${dues}</b><span>carte${dues > 1 ? "s" : ""} à revoir</span></div>
  </section>

  <button class="btn primary big-btn" data-scan="">📸 Scanner une fiche</button>
  ${dues ? `<button class="btn secondary big-btn" data-revision="">🃏 Révision du jour (${dues} cartes)</button>` : ""}

  <h3>Mes matières</h3>
  <div class="matieres">${grilleMatieres(fiches)}</div>
  ${
    fiches.length
      ? `<h3>Vues récemment</h3>
         <div class="list">${recentes.map((f) => carteFiche(f, true)).join("")}</div>`
      : `<div class="empty">Aucune fiche pour l'instant.<br>Touche une matière ou scanne ton premier cours !</div>`
  }`;
}
// Une tuile par matière de « Mes matières » (« Autre » seulement si elle a des fiches), puis « Ajouter ».
function grilleMatieres(fiches) {
  const tuiles = getMatieres()
    .filter((m) => m.nom !== "Autre" || fiches.some((f) => f.matiere === "Autre"))
    .map((m) => {
      const siennes = fiches.filter((f) => f.matiere === m.nom);
      const dues = siennes.reduce((n, f) => n + store.cartesDues(f).length, 0);
      return `<button class="matiere-tile ${siennes.length ? "" : "vide"}" data-matiere="${esc(m.nom)}" style="--c:${m.couleur}">
        <span class="em">${m.emoji}</span>
        <b>${esc(m.nom)}</b>
        <small>${siennes.length ? `${siennes.length} fiche${siennes.length > 1 ? "s" : ""}${dues ? ` · ${dues} à revoir` : ""}` : "Aucune fiche"}</small>
      </button>`;
    });
  tuiles.push(`<button class="matiere-tile ajout" data-ajout-matiere><span class="em">➕</span><b>Ajouter une matière</b></button>`);
  return tuiles.join("");
}

// Options d'un menu de matières (avec « Nouvelle matière… » à la fin).
function optionsMatieres(choisie, avecAuto = false) {
  return (
    (avecAuto ? `<option value="">✨ Détecter automatiquement</option>` : "") +
    getMatieres().map((m) => `<option value="${esc(m.nom)}" ${m.nom === choisie ? "selected" : ""}>${m.emoji} ${esc(m.nom)}</option>`).join("") +
    `<option value="__nouvelle__">➕ Nouvelle matière…</option>`
  );
}

// Ajouter une matière : du catalogue (un geste) ou créée par l'élève.
function ouvrirAjoutMatiere(apresAjout) {
  const sugg = suggestions();
  modale(
    `<h3>Ajouter une matière</h3>
    ${sugg.length ? `<p class="hint">Touche une matière pour l'ajouter :</p>
    <div class="sugg-matieres">${sugg.map((m) => `<button class="chip" data-add="${esc(m.nom)}">${m.emoji} ${esc(m.nom)}</button>`).join("")}</div>` : ""}
    <h3>Ou crée la tienne</h3>
    <label class="field">Nom de la matière<input id="nm-nom" placeholder="ex : Option cinéma" maxlength="40"></label>
    <div class="field">Icône<div class="picker" id="nm-emoji">${EMOJIS.map((e, i) => `<button class="pick ${i ? "" : "on"}" data-v="${e}" aria-label="Icône ${e}">${e}</button>`).join("")}</div></div>
    <div class="field">Couleur<div class="picker" id="nm-couleur">${COULEURS.map((c, i) => `<button class="pick swatch ${i ? "" : "on"}" data-v="${c}" style="background:${c}" aria-label="Couleur ${i + 1}"></button>`).join("")}</div></div>
    <div class="row"><button class="btn secondary" id="nm-annuler">Fermer</button><button class="btn primary" id="nm-ok">Créer</button></div>`,
    (box, fermer) => {
      const fini = (nom) => {
        fermer();
        toast(`${emoji(nom)} ${nom} ajoutée`);
        apresAjout ? apresAjout(nom) : render();
      };
      box.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => fini(ajouterMatiere({ nom: b.dataset.add }))));
      box.querySelectorAll(".picker").forEach((pk) =>
        pk.querySelectorAll(".pick").forEach(
          (b) =>
            (b.onclick = () => {
              pk.querySelectorAll(".pick").forEach((x) => x.classList.remove("on"));
              b.classList.add("on");
            })
        )
      );
      box.querySelector("#nm-annuler").onclick = fermer;
      box.querySelector("#nm-ok").onclick = () => {
        const nom = box.querySelector("#nm-nom").value.trim();
        if (!nom) return toast("Donne un nom à ta matière ✍️");
        fini(
          ajouterMatiere({
            nom,
            emoji: box.querySelector("#nm-emoji .on").dataset.v,
            couleur: box.querySelector("#nm-couleur .on").dataset.v,
          })
        );
      };
    }
  );
}
function carteFiche(f, avecMatiere = false) {
  const m = store.maitrise(f);
  const d = store.cartesDues(f).length;
  return `
  <button class="fiche-card" data-open="${f.id}" style="--c:${couleur(f.matiere)}">
    <div class="tag">${avecMatiere ? `${emoji(f.matiere)} ${esc(f.matiere)}${f.chapitre ? " · " + esc(f.chapitre) : ""}` : esc(f.chapitre || "Sans chapitre")}</div>
    <div class="titre">${esc(f.titre)}</div>
    <div class="meta">${f.flashcards.length} cartes · ${d ? `${d} à revoir` : "à jour ✅"}</div>
    <div class="bar"><i style="width:${m}%"></i></div>
  </button>`;
}

// ---------- Une matière ----------
function matiereView() {
  const nom = ui.matiere;
  const fiches = store.getFiches().filter((f) => f.matiere === nom);
  if (!fiches.length) {
    return `
    <header class="top" style="--c:${couleur(nom)}">
      <button class="icon" data-go="home">←</button>
      <div class="title"><small>Aucune fiche</small>${emoji(nom)} ${esc(nom)}</div>
      <span></span>
    </header>
    <div class="card center">
      <div class="big-num">${emoji(nom)}</div>
      <p>Pas encore de fiche en ${esc(nom)}.<br>Scanne ton premier cours pour commencer.</p>
    </div>
    <button class="btn primary big-btn" data-scan="${esc(nom)}">📸 Ajouter une fiche de ${esc(nom)}</button>
    ${nom !== "Autre" ? `<button class="btn ghost big-btn" data-retirer="${esc(nom)}">Retirer ${esc(nom)} de mes matières</button>` : ""}`;
  }
  const dues = fiches.reduce((n, f) => n + store.cartesDues(f).length, 0);
  // Regroupe par chapitre ; les chapitres sont triés par ordre alphabétique, les fiches par date.
  const chapitres = {};
  for (const f of fiches) (chapitres[f.chapitre || "Sans chapitre"] ||= []).push(f);
  const groupes = Object.entries(chapitres).sort(([a], [b]) => a.localeCompare(b, "fr"));
  return `
  <header class="top" style="--c:${couleur(nom)}">
    <button class="icon" data-go="home">←</button>
    <div class="title"><small>${fiches.length} fiche${fiches.length > 1 ? "s" : ""}</small>${emoji(nom)} ${esc(nom)}</div>
    <span></span>
  </header>
  ${dues ? `<button class="btn primary big-btn" data-revision="${esc(nom)}">🃏 Réviser les cartes de ${esc(nom)} (${dues})</button>` : `<div class="card center">✅ Toutes les cartes de ${esc(nom)} sont à jour.</div>`}
  <button class="btn secondary big-btn" data-scan="${esc(nom)}">📸 Ajouter une fiche de ${esc(nom)}</button>
  ${groupes
    .map(
      ([chap, liste]) => `<div class="chap-head"><h3 class="chapitre">${esc(chap)}</h3>
        <button class="pill-btn" data-chapitre="${esc(chap)}" data-m="${esc(nom)}">${resumeProgres(nom, chap)}</button></div>
      <div class="list">${liste.sort((a, b) => b.cree - a.cree).map((f) => carteFiche(f)).join("")}</div>`
    )
    .join("")}`;
}

// ---------- Scanner ----------
let pages = [];
let scanNote = "";
let scanMatiere = ""; // vide = détection automatique
let analyseEnCours = false;
function scan() {
  const vide = !pages.length;
  return `
  <header class="top"><button class="icon" data-back>←</button><div class="title">${scanMatiere ? `<small>${emoji(scanMatiere)} ${esc(scanMatiere)}</small>` : ""}Nouvelle fiche</div><span></span></header>
  ${
    vide
      ? `<p class="hint">Comment veux-tu scanner ton cours ?</p>
        <div class="choix-scan">
          <button class="choix" data-scanmode="une"><span class="em">📄</span><b>Une page</b><small>Une photo, et c'est prêt.</small></button>
          <button class="choix" data-scanmode="plusieurs"><span class="em">📚</span><b>Plusieurs pages</b><small>Enchaîne les photos sans valider chaque page.</small></button>
        </div>
        <button class="btn ghost big-btn" id="btn-import">🖼️ Importer depuis la galerie ou un PDF</button>`
      : `<p class="hint">${pages.length} page${pages.length > 1 ? "s" : ""}. Vérifie l'ordre avec les flèches, puis crée ta fiche.</p>
        <div class="pages">
          ${pages
            .map(
              (p, i) => `<div class="page">${
                p.kind === "pdf" ? `<div class="pdf">📄 PDF<br><small>${esc(p.name)}</small></div>` : `<img src="${p.preview}" alt="page ${i + 1}">`
              }<button class="del" data-delpage="${i}" aria-label="Retirer la page ${i + 1}">✕</button><span class="num">${i + 1}</span>
              ${pages.length > 1 ? `<span class="moves">${i ? `<button data-move="${i}" data-dir="-1" aria-label="Avancer la page ${i + 1}">◀</button>` : ""}${i < pages.length - 1 ? `<button data-move="${i}" data-dir="1" aria-label="Reculer la page ${i + 1}">▶</button>` : ""}</span>` : ""}</div>`
            )
            .join("")}
          <button class="page add" data-scanmode="plusieurs">📸<br>Ajouter des pages</button>
          <button class="page add" id="btn-import">🖼️<br>Galerie / PDF</button>
        </div>
        <label class="field">Matière
          <select id="scan-matiere">${optionsMatieres(scanMatiere, true)}</select>
        </label>
        <label class="field">Une précision pour Claude ? (facultatif)
          <input id="note" placeholder="ex : chapitre 3, contrôle vendredi sur la partie 2" value="${esc(scanNote)}">
        </label>
        <button class="btn primary big-btn" id="btn-analyser" ${analyseEnCours ? "disabled" : ""}>✨ Créer ma fiche (${pages.length} page${pages.length > 1 ? "s" : ""})</button>
        <div id="progress"></div>`
  }
  <input type="file" id="file-import" accept="image/*,application/pdf" multiple hidden>
  <input type="file" id="file-camera" accept="image/*" capture="environment" hidden>`;
}
afterRender.scan = () => {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-scanmode]").forEach((b) => (b.onclick = () => lancerScanner(b.dataset.scanmode === "plusieurs")));
  document.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.move;
        const j = i + +b.dataset.dir;
        [pages[i], pages[j]] = [pages[j], pages[i]];
        render();
      })
  );
  $("btn-import").onclick = () => $("file-import").click();
  $("file-import").onchange = (e) => ajouterFichiers(e.target.files);
  $("file-camera").onchange = (e) => ajouterFichiers(e.target.files);
  if (!pages.length) return;
  $("note").oninput = (e) => (scanNote = e.target.value);
  $("scan-matiere").onchange = (e) => {
    if (e.target.value !== "__nouvelle__") return (scanMatiere = e.target.value);
    e.target.value = scanMatiere;
    ouvrirAjoutMatiere((nom) => {
      scanMatiere = nom;
      render();
    });
  };
  $("btn-analyser").onclick = analyser;
};
// Scanner intégré (rafale sans validation) ; si la caméra intégrée est indisponible, appareil photo classique.
async function lancerScanner(multi) {
  const ok = await ouvrirScanner({
    multi,
    dejaPrises: pages.filter((p) => p.kind === "image").length,
    onPage: async (dataUrl) => {
      pages.push(await imagePage(dataUrl));
    },
    onRetirer: () => pages.pop(),
    onFin: () => render(),
  });
  if (!ok) {
    if (multi) toast("Caméra intégrée indisponible : prends tes pages une par une, ou importe-les depuis la galerie.");
    prendrePhoto();
  }
}
async function prendrePhoto() {
  if (!Capacitor.isNativePlatform()) return document.getElementById("file-camera").click();
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 85,
      width: 1280,
      correctOrientation: true,
    });
    pages.push(await imagePage(photo.dataUrl));
    render();
  } catch (e) {
    if (!/cancel/i.test(e?.message || "")) toast("Impossible d'utiliser l'appareil photo : " + (e?.message || e));
  }
}
async function ajouterFichiers(files) {
  for (const f of files) {
    if (f.type === "application/pdf") {
      if (f.size > 25 * 1024 * 1024) {
        toast("PDF trop lourd (25 Mo max).");
        continue;
      }
      const data = (await lireDataUrl(f)).split(",")[1];
      pages.push({ kind: "pdf", data, name: f.name });
    } else if (f.type.startsWith("image/")) {
      pages.push(await imagePage(await lireDataUrl(f)));
    }
  }
  render();
}
const lireDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
// Réduit la photo (1280 px max) : environ 1 600 tokens par page au lieu de 2 400, l'écriture reste lisible.
function imagePage(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/jpeg", 0.8);
      res({ kind: "image", mediaType: "image/jpeg", data: out.split(",")[1], preview: out });
    };
    img.onerror = () => rej(new Error("Image illisible"));
    img.src = dataUrl;
  });
}
function progressUI(el, label) {
  const msgs = ["Je lis ta fiche…", "Je repère les notions importantes…", "Je rédige ta fiche de révision…", "Je prépare les flashcards…", "Presque fini…"];
  el.innerHTML = `<div class="loading"><div class="spinner"></div><div class="lmsg">${label || msgs[0]}</div><div class="lsub"></div></div>`;
  const lmsg = el.querySelector(".lmsg");
  const lsub = el.querySelector(".lsub");
  let i = 0;
  const timer = label ? null : setInterval(() => (lmsg.textContent = msgs[Math.min(++i, msgs.length - 1)]), 7000);
  return {
    update: (chars) => (lsub.textContent = chars ? `${Math.round(chars / 5)} mots écrits` : ""),
    stop: () => timer && clearInterval(timer),
  };
}
function nouvelleFiche(r) {
  return {
    id: store.uid(),
    cree: Date.now(),
    demoKey: r.demoKey,
    titre: r.titre,
    matiere: normaliserMatiere(r.matiere),
    chapitre: r.chapitre,
    transcription: r.transcription,
    resume: r.resume,
    points_cles: r.points_cles,
    vocabulaire: r.vocabulaire,
    astuce: r.astuce_memo,
    flashcards: r.flashcards.map(store.nouvelleCarte),
    questionsVues: [],
    qcm: [],
    sujets: [],
    chat: [],
  };
}
async function analyser() {
  if (analyseEnCours) return;
  analyseEnCours = true;
  const btn = document.getElementById("btn-analyser");
  btn.disabled = true;
  const p = progressUI(document.getElementById("progress"));
  try {
    const r = await ai.analyserCours(pages, scanNote, scanMatiere, p.update);
    if (scanMatiere) r.matiere = scanMatiere;
    const fiche = nouvelleFiche(r);
    store.saveFiche(fiche);
    pages = [];
    scanNote = "";
    scanMatiere = "";
    go({ view: "fiche", ficheId: fiche.id, tab: "resume", ...(ui.retour === "matiere" ? { matiere: fiche.matiere } : {}) });
    toast("Fiche créée ! 🎉");
  } catch (e) {
    document.getElementById("progress").innerHTML = `<div class="error">${esc(e.message)}</div>`;
    btn.disabled = false;
  } finally {
    p.stop();
    analyseEnCours = false;
  }
}

// ---------- Fiche ----------
const TABS = [
  ["resume", "📝", "Résumé"],
  ["cartes", "🃏", "Cartes"],
  ["qcm", "✅", "QCM"],
  ["sujet", "📄", "Sujet"],
  ["prof", "💬", "Prof"],
];
function ficheView() {
  const f = store.getFiche(ui.ficheId);
  if (!f) return home();
  const body = { resume: tabResume, cartes: tabCartes, qcm: tabQCM, sujet: tabSujet, prof: tabProf }[ui.tab](f);
  return `
  <header class="top" style="--c:${couleur(f.matiere)}">
    <button class="icon" data-back>←</button>
    <button class="title title-edit" id="btn-edit" aria-label="Modifier la matière, le chapitre ou le titre"><small>${emoji(f.matiere)} ${esc(f.matiere)}${f.chapitre ? " · " + esc(f.chapitre) : ""} ✏️</small>${esc(f.titre)}</button>
    <button class="icon" id="btn-suppr" aria-label="Supprimer">🗑️</button>
  </header>
  <nav class="tabs">${TABS.map(([k, i, l]) => `<button class="${ui.tab === k ? "on" : ""}" data-tab="${k}"><span>${i}</span>${l}</button>`).join("")}</nav>
  <div class="tab-body">${body}</div>`;
}
afterRender.fiche = () => {
  const f = store.getFiche(ui.ficheId);
  if (!f) return;
  document.getElementById("btn-suppr").onclick = async () => {
    if (await confirmer(`Supprimer la fiche « ${f.titre} » ?`)) {
      store.deleteFiche(f.id);
      go({ view: ui.retour });
    }
  };
  document.getElementById("btn-edit").onclick = () => editerFiche(f);
  ({ cartes: bindCartes, qcm: bindQCM, sujet: bindSujet, prof: bindProf, resume: bindResume })[ui.tab]?.(f);
};

// --- Classer : matière, chapitre, titre
function editerFiche(f) {
  const chapitres = [...new Set(store.getFiches().map((x) => x.chapitre).filter(Boolean))];
  modale(
    `<h3>Classer la fiche</h3>
    <label class="field">Matière
      <select id="ed-matiere">${optionsMatieres(f.matiere)}</select>
    </label>
    <label class="field">Chapitre
      <input id="ed-chapitre" list="ed-chapitres" value="${esc(f.chapitre || "")}" placeholder="ex : La Révolution française">
      <datalist id="ed-chapitres">${chapitres.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
    </label>
    <label class="field">Titre<input id="ed-titre" value="${esc(f.titre)}"></label>
    <div class="row"><button class="btn secondary" id="ed-annuler">Annuler</button><button class="btn primary" id="ed-ok">Enregistrer</button></div>`,
    (box, fermer) => {
      box.querySelector("#ed-annuler").onclick = fermer;
      const sel = box.querySelector("#ed-matiere");
      let valeur = sel.value;
      sel.onchange = () => {
        if (sel.value !== "__nouvelle__") return (valeur = sel.value);
        sel.value = valeur;
        ouvrirAjoutMatiere((nom) => {
          valeur = nom;
          sel.innerHTML = optionsMatieres(nom);
        });
      };
      box.querySelector("#ed-ok").onclick = () => {
        const fiche = store.getFiche(f.id);
        const avant = { matiere: fiche.matiere, chapitre: fiche.chapitre };
        fiche.matiere = valeur;
        fiche.chapitre = box.querySelector("#ed-chapitre").value.trim();
        fiche.titre = box.querySelector("#ed-titre").value.trim() || fiche.titre;
        store.saveFiche(fiche);
        // Si plus aucune fiche ne reste dans l'ancien chapitre, ses résultats suivent la fiche.
        if (!fichesDuChapitre(avant.matiere, avant.chapitre || "Sans chapitre").length)
          store.deplacerProgres(avant.matiere, avant.chapitre, fiche.matiere, fiche.chapitre);
        fermer();
        if (ui.retour === "matiere") ui.matiere = fiche.matiere;
        toast("Fiche classée ✅");
        render();
      };
    }
  );
}

// --- Résumé
function tabResume(f) {
  const chap = f.chapitre || "Sans chapitre";
  const sansDepart = !store.getProgres(f.matiere, f.chapitre).depart;
  return `
  ${
    sansDepart
      ? `<div class="depart-banner"><span>🎯 <b>Nouveau chapitre ?</b> Fais le test de départ de « ${esc(chap)} » avant de réviser : tu pourras mesurer tes progrès.</span>
         <button class="btn secondary" data-chapitre="${esc(chap)}" data-m="${esc(f.matiere)}">Mes progrès</button></div>`
      : ""
  }
  <div class="md card">${md(f.resume)}</div>
  ${
    f.points_cles?.length
      ? `<h3>🎯 À retenir</h3><ul class="keys">${f.points_cles.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
      : ""
  }
  ${
    f.vocabulaire?.length
      ? `<h3>📖 Vocabulaire</h3><dl class="vocab">${f.vocabulaire
          .map((v) => `<div><dt>${esc(v.terme)}</dt><dd>${esc(v.definition)}</dd></div>`)
          .join("")}</dl>`
      : ""
  }
  ${f.astuce ? `<div class="astuce">💡 <b>Astuce mémo :</b> ${esc(f.astuce)}</div>` : ""}
  <details class="card"><summary>Voir le texte du cours scanné</summary><div class="md">${md(f.transcription)}</div></details>
  <div class="row">
    <button class="btn secondary" data-tab="cartes">🃏 Réviser les cartes</button>
    <button class="btn secondary" data-tab="qcm">✅ Faire un QCM</button>
  </div>`;
}
function bindResume() {}

// --- Flashcards
let session = null; // { ficheId, cartes, i, retourne, sues }
function tabCartes(f) {
  if (!session || session.ficheId !== f.id) {
    return `
    <div class="card center">
      <div class="big-num">${store.cartesDues(f).length}</div>
      <div>carte(s) à revoir maintenant sur ${f.flashcards.length}</div>
      <div class="bar wide"><i style="width:${store.maitrise(f)}%"></i></div>
      <small>Maîtrise : ${store.maitrise(f)} %</small>
    </div>
    <button class="btn primary big-btn" id="start-due" ${store.cartesDues(f).length ? "" : "disabled"}>▶️ Réviser les cartes à revoir</button>
    <button class="btn secondary big-btn" id="start-all">🔀 Tout réviser (mélangé)</button>
    <button class="btn ghost big-btn" id="more-cards">➕ 10 cartes de plus avec Claude</button>
    <div id="progress"></div>
    <h3>Toutes les cartes</h3>
    <div class="all-cards">${f.flashcards
      .map((c) => `<div class="mini"><b>${esc(c.recto)}</b><span>${esc(c.verso)}</span><i class="lvl l${c.boite}"></i></div>`)
      .join("")}</div>`;
  }
  return sessionCartes(f.id, session);
}
function sessionCartes(ficheId, s) {
  if (s.i >= s.cartes.length) {
    return `<div class="card center done">
      <div class="big-num">🎉</div>
      <p>Bravo ! ${s.sues} / ${s.cartes.length} cartes sues.</p>
      <p class="sub">Les cartes ratées reviendront plus vite, les autres plus tard.</p>
      <button class="btn primary" id="end-session">Terminer</button></div>`;
  }
  const c = s.cartes[s.i];
  return `
  <div class="counter">${s.i + 1} / ${s.cartes.length}</div>
  <div class="flip ${s.retourne ? "flipped" : ""}" id="flip">
    <div class="face front">${esc(c.recto)}<small>Touche pour voir la réponse</small></div>
    <div class="face back">${esc(c.verso)}</div>
  </div>
  ${
    s.retourne
      ? `<div class="row"><button class="btn bad" id="ko">😕 À revoir</button><button class="btn good" id="ok">😎 Je savais</button></div>`
      : `<button class="btn secondary big-btn" id="show">Voir la réponse</button>`
  }
  <button class="btn ghost" id="end-session">Arrêter</button>`;
}
function bindCartes(f) {
  const $ = (id) => document.getElementById(id);
  if (!session || session.ficheId !== f.id) {
    $("start-due").onclick = () => {
      session = { ficheId: f.id, cartes: shuffle(store.cartesDues(f)), i: 0, retourne: false, sues: 0 };
      render();
    };
    $("start-all").onclick = () => {
      session = { ficheId: f.id, cartes: shuffle(f.flashcards), i: 0, retourne: false, sues: 0 };
      render();
    };
    $("more-cards").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude écrit de nouvelles cartes…");
      try {
        const nouvelles = await ai.plusDeFlashcards(f, f.flashcards, p.update);
        f.flashcards.push(...nouvelles.map(store.nouvelleCarte));
        store.saveFiche(f);
        toast(nouvelles.length > 1 ? `${nouvelles.length} cartes ajoutées` : "1 carte ajoutée");
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
    return;
  }
  bindSession(session, () => {
    session = null;
    render();
  });
}
function bindSession(s, onEnd) {
  const $ = (id) => document.getElementById(id);
  $("end-session").onclick = onEnd;
  if (s.i >= s.cartes.length) return;
  const flip = () => {
    s.retourne = !s.retourne;
    render();
  };
  $("flip").onclick = flip;
  if ($("show")) $("show").onclick = flip;
  const noter = (sue) => {
    const c = s.cartes[s.i];
    const fiche = store.getFiche(c.ficheId || s.ficheId);
    const vraie = fiche.flashcards.find((x) => x.id === c.id);
    if (vraie) store.noterCarte(vraie, sue);
    store.saveFiche(fiche);
    store.enregistrerActivite("carte");
    if (sue) s.sues++;
    s.i++;
    s.retourne = false;
    render();
  };
  if ($("ok")) $("ok").onclick = () => noter(true);
  if ($("ko")) $("ko").onclick = () => noter(false);
}

// --- Révision du jour (toutes matières, ou une seule)
let sessionJour = null;
function revision() {
  if (!sessionJour) {
    const cartes = store
      .getFiches()
      .filter((f) => !ui.revMatiere || f.matiere === ui.revMatiere)
      .flatMap((f) => store.cartesDues(f).map((c) => ({ ...c, ficheId: f.id })));
    sessionJour = { cartes: shuffle(cartes).slice(0, 40), i: 0, retourne: false, sues: 0 };
  }
  return `<header class="top"><button class="icon" data-back>←</button><div class="title">${ui.revMatiere ? `<small>${emoji(ui.revMatiere)} ${esc(ui.revMatiere)}</small>` : ""}Révision du jour</div><span></span></header>
  ${sessionCartes(null, sessionJour)}`;
}
afterRender.revision = () =>
  bindSession(sessionJour, () => {
    sessionJour = null;
    go({ view: ui.retour });
  });

// Mélange les questions et l'ordre des propositions (pour refaire un QCM sans appel à Claude).
function melangerQCM(questions) {
  return shuffle(questions).map((q) => {
    const ordre = shuffle(q.choix.map((_, i) => i));
    return { ...q, choix: ordre.map((i) => q.choix[i]), bonne_reponse: ordre.indexOf(q.bonne_reponse) };
  });
}

// --- QCM
let qcm = null; // { ficheId, questions, i, choisi, score, niveau }
let qcmNiveau = "moyen";
let qcmNombre = 10;
function tabQCM(f) {
  if (!qcm || qcm.ficheId !== f.id) {
    const hist = f.qcm.slice(-5).reverse();
    return `
    <div class="card">
      <h3>Nouveau QCM</h3>
      <div class="seg">${["facile", "moyen", "difficile"]
        .map((n) => `<button class="${qcmNiveau === n ? "on" : ""}" data-niveau="${n}">${n}</button>`)
        .join("")}</div>
      <div class="seg">${[5, 10, 20].map((n) => `<button class="${qcmNombre === n ? "on" : ""}" data-nombre="${n}">${n} questions</button>`).join("")}</div>
      <button class="btn primary big-btn" id="gen-qcm">✨ Générer le QCM</button>
      ${f.dernierQCM?.length ? `<button class="btn secondary big-btn" id="replay-qcm">🔁 Refaire le dernier QCM (${f.dernierQCM.length} questions, sans appel à Claude)</button>` : ""}
      <div id="progress"></div>
    </div>
    ${
      hist.length
        ? `<h3>Mes derniers scores</h3><div class="scores">${hist
            .map(
              (h) =>
                `<div class="score"><b>${h.score}/${h.total}</b><span>${h.niveau} · ${new Date(h.date).toLocaleDateString("fr-FR")}</span></div>`
            )
            .join("")}</div>`
        : ""
    }`;
  }
  if (qcm.i >= qcm.questions.length) {
    const note = Math.round((qcm.score / qcm.questions.length) * 20);
    return `<div class="card center done">
      <div class="big-num">${note}/20</div>
      <p>${qcm.score} bonne${qcm.score > 1 ? "s" : ""} réponse${qcm.score > 1 ? "s" : ""} sur ${qcm.questions.length}</p>
      <p class="sub">${note >= 16 ? "Excellent, tu maîtrises ! 🏆" : note >= 12 ? "Bien joué, encore un petit effort 💪" : "Relis le résumé puis réessaie, tu vas y arriver 📚"}</p>
      ${qcm.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${qcm.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <div class="row"><button class="btn secondary" id="qcm-fin">Terminer</button><button class="btn primary" id="qcm-again">Nouveau QCM</button></div>
    </div>`;
  }
  const q = qcm.questions[qcm.i];
  const rep = qcm.choisi;
  return `
  <div class="counter">Question ${qcm.i + 1} / ${qcm.questions.length} · Score ${qcm.score}</div>
  <div class="card question">${esc(q.question)}</div>
  <div class="choices">${q.choix
    .map((c, i) => {
      let cls = "";
      if (rep !== null) cls = i === q.bonne_reponse ? "good" : i === rep ? "bad" : "dim";
      return `<button class="choice ${cls}" data-choix="${i}" ${rep !== null ? "disabled" : ""}><b>${"ABCD"[i]}</b>${esc(c)}</button>`;
    })
    .join("")}</div>
  ${
    rep !== null
      ? `<div class="explain ${rep === q.bonne_reponse ? "ok" : "ko"}">${rep === q.bonne_reponse ? "✅ Bravo !" : "❌ Raté."} ${esc(q.explication)}</div>
         <button class="btn primary big-btn" id="qcm-next">${qcm.i + 1 < qcm.questions.length ? "Question suivante →" : "Voir mon score"}</button>`
      : ""
  }
  <button class="btn ghost" id="qcm-stop">Arrêter</button>`;
}
function bindQCM(f) {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-niveau]").forEach((b) => (b.onclick = () => ((qcmNiveau = b.dataset.niveau), render())));
  document.querySelectorAll("[data-nombre]").forEach((b) => (b.onclick = () => ((qcmNombre = +b.dataset.nombre), render())));
  if ($("gen-qcm"))
    $("gen-qcm").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude prépare tes questions…");
      try {
        const questions = await ai.genererQCM(f, qcmNiveau, qcmNombre, f.questionsVues || [], p.update);
        f.questionsVues = [...(f.questionsVues || []), ...questions.map((q) => q.question)].slice(-40);
        f.dernierQCM = questions; // gardé pour le refaire hors ligne
        store.saveFiche(f);
        qcm = { ficheId: f.id, questions, i: 0, choisi: null, score: 0, niveau: qcmNiveau, erreurs: [] };
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("replay-qcm"))
    $("replay-qcm").onclick = () => {
      const questions = melangerQCM(f.dernierQCM);
      qcm = { ficheId: f.id, questions, i: 0, choisi: null, score: 0, niveau: "rejoué", erreurs: [] };
      render();
    };
  document.querySelectorAll("[data-choix]").forEach(
    (b) =>
      (b.onclick = () => {
        const q = qcm.questions[qcm.i];
        qcm.choisi = +b.dataset.choix;
        if (qcm.choisi === q.bonne_reponse) qcm.score++;
        else qcm.erreurs.push(`${q.question} → ${q.choix[q.bonne_reponse]}`);
        render();
      })
  );
  if ($("qcm-next"))
    $("qcm-next").onclick = () => {
      qcm.i++;
      qcm.choisi = null;
      if (qcm.i >= qcm.questions.length) {
        f.qcm.push({ date: Date.now(), score: qcm.score, total: qcm.questions.length, niveau: qcm.niveau });
        store.saveFiche(f);
        store.enregistrerActivite("qcm");
      }
      render();
    };
  const reset = () => ((qcm = null), render());
  if ($("qcm-stop")) $("qcm-stop").onclick = reset;
  if ($("qcm-fin")) $("qcm-fin").onclick = reset;
  if ($("qcm-again")) $("qcm-again").onclick = reset;
}

// --- Sujet d'entraînement
let sujetType = "controle";
let sujetOuvert = null; // index dans f.sujets
let corrigeVisible = false;
function tabSujet(f) {
  const s = sujetOuvert !== null ? f.sujets[sujetOuvert] : null;
  if (!s) {
    return `
    <div class="card">
      <h3>Préparer un sujet d'entraînement</h3>
      <div class="seg wrap">${Object.entries(ai.TYPES_SUJET)
        .map(([k, l]) => `<button class="${sujetType === k ? "on" : ""}" data-stype="${k}">${l}</button>`)
        .join("")}</div>
      <button class="btn primary big-btn" id="gen-sujet">✨ Générer le sujet</button>
      <div id="progress"></div>
    </div>
    ${
      f.sujets.length
        ? `<h3>Mes sujets</h3>${f.sujets
            .map(
              (x, i) =>
                `<button class="fiche-card small" data-sujet="${i}"><div class="titre">${esc(x.titre)}</div><div class="meta">${esc(x.duree)}${x.note ? " · corrigé ✔︎" : ""}</div></button>`
            )
            .join("")}`
        : ""
    }`;
  }
  return `
  <button class="btn ghost" id="sujet-back">← Mes sujets</button>
  <div class="card md"><h2>${esc(s.titre)}</h2><p class="sub">⏱️ ${esc(s.duree)}</p>${md(s.sujet)}</div>
  <h3>✍️ Ma réponse</h3>
  <textarea id="copie" rows="8" placeholder="Écris tes réponses ici (ou résume-les), puis demande la correction.">${esc(s.copie || "")}</textarea>
  <button class="btn primary big-btn" id="corriger">🧑‍🏫 Corriger ma copie</button>
  <div id="progress"></div>
  ${s.note ? `<div class="card md correction">${md(s.note)}</div>` : ""}
  <button class="btn secondary big-btn" id="toggle-corrige">${corrigeVisible ? "Cacher" : "Voir"} le corrigé</button>
  ${corrigeVisible ? `<div class="card md">${md(s.corrige)}</div>` : ""}`;
}
function bindSujet(f) {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-stype]").forEach((b) => (b.onclick = () => ((sujetType = b.dataset.stype), render())));
  document.querySelectorAll("[data-sujet]").forEach(
    (b) => (b.onclick = () => ((sujetOuvert = +b.dataset.sujet), (corrigeVisible = false), render()))
  );
  if ($("gen-sujet"))
    $("gen-sujet").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude rédige ton sujet et son corrigé…");
      try {
        const s = await ai.genererSujet(f, sujetType, p.update);
        f.sujets.unshift({ ...s, type: sujetType, date: Date.now() });
        f.sujets = f.sujets.slice(0, 10);
        store.saveFiche(f);
        sujetOuvert = 0;
        corrigeVisible = false;
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("sujet-back")) $("sujet-back").onclick = () => ((sujetOuvert = null), render());
  if ($("toggle-corrige")) $("toggle-corrige").onclick = () => ((corrigeVisible = !corrigeVisible), render());
  if ($("copie")) {
    const s = f.sujets[sujetOuvert];
    $("copie").oninput = (e) => {
      s.copie = e.target.value;
      store.saveFiche(f);
    };
    $("corriger").onclick = async (e) => {
      if (!s.copie?.trim()) return toast("Écris d'abord ta réponse ✍️");
      e.target.disabled = true;
      const p = progressUI($("progress"), "Le prof corrige ta copie…");
      try {
        s.note = await ai.corrigerCopie(f, s, s.copie, p.update);
        store.saveFiche(f);
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  }
}

// --- Prof particulier (chat)
let chatBusy = false;
function tabProf(f) {
  const suggestions = ["Explique-moi ce cours comme si j'avais 10 ans", "Quelles sont les 3 choses les plus importantes ?", "Donne-moi un exemple concret", "Pose-moi une question pour vérifier"];
  return `
  <div class="chat" id="chat">
    <div class="bubble bot">Salut ! Je suis ton prof pour « ${esc(f.titre)} ». Qu'est-ce que tu n'as pas compris ?</div>
    ${f.chat.map((m) => `<div class="bubble ${m.role === "user" ? "me" : "bot md"}">${m.role === "user" ? esc(m.content) : md(m.content)}</div>`).join("")}
    <div id="live"></div>
  </div>
  ${!f.chat.length ? `<div class="sugg">${suggestions.map((s) => `<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
  <form class="composer" id="composer">
    <input id="msg" placeholder="Pose ta question…" autocomplete="off">
    <button class="btn primary" ${chatBusy ? "disabled" : ""}>➤</button>
  </form>
  ${f.chat.length ? `<button class="btn ghost" id="clear-chat">Effacer la conversation</button>` : ""}`;
}
function bindProf(f) {
  const $ = (id) => document.getElementById(id);
  const envoyer = async (texte) => {
    if (!texte.trim() || chatBusy) return;
    chatBusy = true;
    f.chat.push({ role: "user", content: texte.trim() });
    store.saveFiche(f);
    render();
    const live = $("live");
    live.className = "bubble bot md";
    live.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    live.scrollIntoView({ block: "end" });
    try {
      const rep = await ai.discuter(f, f.chat.slice(-20), (_, acc) => {
        live.innerHTML = md(acc);
        live.scrollIntoView({ block: "end" });
      });
      f.chat.push({ role: "assistant", content: rep });
    } catch (err) {
      f.chat.pop();
      toast(err.message);
    }
    store.saveFiche(f);
    chatBusy = false;
    if (ui.view === "fiche" && ui.tab === "prof") render();
    document.getElementById("live")?.scrollIntoView({ block: "end" });
  };
  $("composer").onsubmit = (e) => {
    e.preventDefault();
    envoyer($("msg").value);
  };
  document.querySelectorAll("[data-sugg]").forEach((b) => (b.onclick = () => envoyer(b.dataset.sugg)));
  if ($("clear-chat"))
    $("clear-chat").onclick = () => {
      f.chat = [];
      store.saveFiche(f);
      render();
    };
}

// ---------- Réglages ----------
const CLASSES = ["CM2", "6e", "5e", "4e", "3e", "Seconde", "Première", "Terminale", "Études supérieures"];
function settings() {
  const s = store.getSettings();
  return `
  <header class="top"><button class="icon" data-go="home">←</button><div class="title">Réglages</div><span></span></header>
  <label class="field">Ton prénom<input id="prenom" value="${esc(s.prenom)}" placeholder="ex : Lucas"></label>
  <label class="field">Ta classe<select id="classe">${CLASSES.map((c) => `<option ${c === s.classe ? "selected" : ""}>${c}</option>`).join("")}</select></label>
  ${
    DEMO_ONLY
      ? `<div class="card parent"><h3>👨‍👩‍👦 Espace parent</h3><p class="hint">Dans l'appli Android, c'est ici que tu colles la clé API Claude et que tu choisis le modèle. Cette maquette fonctionne uniquement en mode démo.</p></div>`
      : `<div class="card parent">
    <h3>👨‍👩‍👦 Espace parent</h3>
    <label class="field">Clé API Claude
      <input id="apikey" type="password" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off">
    </label>
    <p class="hint">Crée une clé sur <b>platform.claude.com</b> → API Keys. Elle reste uniquement sur ce téléphone. Pense à fixer une limite de dépense mensuelle dans la console.</p>
    <label class="field">Modèle<select id="model">${ai.MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
  </div>`
  }
  <button class="btn primary big-btn" id="save">Enregistrer</button>
  ${DEMO_ONLY ? "" : `<button class="btn ghost big-btn" id="test">Tester la clé</button>`}
  ${s.demo && !DEMO_ONLY ? `<button class="btn ghost big-btn" id="quit-demo">Quitter la démo</button>` : ""}
  <div id="progress"></div>
  <div class="card">
    <h3>📚 Mes matières</h3>
    <div class="mes-matieres">${getMatieres()
      .filter((m) => m.nom !== "Autre")
      .map((m) => `<span class="chip-m" style="--c:${m.couleur}">${m.emoji} ${esc(m.nom)}<button data-retirer="${esc(m.nom)}" aria-label="Retirer ${esc(m.nom)}">✕</button></span>`)
      .join("")}</div>
    <button class="btn secondary big-btn" data-ajout-matiere>➕ Ajouter une matière</button>
  </div>
  ${consoHTML()}
  <p class="hint center">Révizz · tes fiches restent sur ce téléphone.</p>`;
}
const nf = (n) => n.toLocaleString("fr-FR");
function consoHTML() {
  const c = store.getConso();
  if (!c.appels) return "";
  const total = c.entree + c.cache + c.sortie;
  const partCache = total ? Math.round((c.cache / (c.entree + c.cache || 1)) * 100) : 0;
  return `<div class="card conso">
    <h3>🌱 Consommation</h3>
    <div class="conso-grid">
      <div><b>${nf(c.appels)}</b><span>demandes à Claude</span></div>
      <div><b>${nf(c.entree + c.cache)}</b><span>tokens lus</span></div>
      <div><b>${nf(c.sortie)}</b><span>tokens écrits</span></div>
      <div><b>${partCache} %</b><span>relus depuis le cache</span></div>
    </div>
    <p class="hint">Les tokens écrits sont les plus coûteux en énergie. Refaire un QCM déjà généré ou réviser les cartes ne consomme rien.</p>
    <button class="btn ghost" id="reset-conso">Remettre le compteur à zéro</button>
  </div>`;
}
afterRender.settings = () => {
  const $ = (id) => document.getElementById(id);
  if ($("reset-conso"))
    $("reset-conso").onclick = () => {
      store.resetConso();
      render();
    };
  const save = () => {
    const reglages = { prenom: $("prenom").value.trim(), classe: $("classe").value };
    if (!DEMO_ONLY) Object.assign(reglages, { apiKey: $("apikey").value.trim(), model: $("model").value });
    store.saveSettings(reglages);
  };
  $("save").onclick = () => {
    save();
    const s = store.getSettings();
    if (!s.apiKey && !s.demo) return toast("Il faut une clé API pour utiliser Révizz.");
    if (s.apiKey && s.demo && !DEMO_ONLY) quitterDemo();
    toast("Enregistré ✅");
    go({ view: "home" });
  };
  if ($("quit-demo"))
    $("quit-demo").onclick = async () => {
      if (!(await confirmer("Quitter la démo ? Les fiches d'exemple seront supprimées.", "Quitter"))) return;
      quitterDemo();
      go({ view: store.getSettings().apiKey ? "home" : "welcome" });
    };
  if ($("test")) $("test").onclick = async (e) => {
    save();
    e.target.disabled = true;
    const p = progressUI($("progress"), "Je contacte Claude…");
    try {
      await ai.testerCle();
      $("progress").innerHTML = `<div class="success">La clé fonctionne ✅</div>`;
    } catch (err) {
      $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    } finally {
      p.stop();
      e.target.disabled = false;
    }
  };
};

async function demanderRetrait(nom) {
  const n = store.getFiches().filter((f) => f.matiere === nom).length;
  if (n) return toast(`${nom} contient ${n} fiche${n > 1 ? "s" : ""} : déplace-les ou supprime-les d'abord.`);
  if (!(await confirmer(`Retirer ${nom} de tes matières ?`, "Retirer"))) return;
  retirerMatiere(nom);
  if (ui.view === "matiere") go({ view: "home", matiere: null });
  else render();
}

// ---------- Progrès d'un chapitre : test de départ → révisions → test final ----------
const fichesDuChapitre = (m, c) => store.getFiches().filter((f) => f.matiere === m && (f.chapitre || "Sans chapitre") === c);
// Toutes les fiches du chapitre réunies, pour générer un test sur l'ensemble du chapitre.
function ficheChapitre(m, c) {
  const fiches = fichesDuChapitre(m, c);
  return {
    titre: c,
    matiere: m,
    chapitre: c === "Sans chapitre" ? "" : c,
    demoKey: fiches[0]?.demoKey,
    transcription: fiches.map((f) => `## ${f.titre}\n${f.transcription}`).join("\n\n"),
  };
}
const humeur = (n) => (n >= 16 ? "🤩" : n >= 12 ? "😃" : n >= 8 ? "🙂" : "😕");
const noteDe = (r) => store.sur20(r.score, r.total);

function resumeProgres(m, c) {
  const p = store.getProgres(m, c);
  if (!p.depart) return "🎯 Mesurer mes progrès";
  const fin = p.finals?.at(-1);
  return fin ? `📈 ${noteDe(p.depart)} → ${noteDe(fin)}/20` : `📈 Départ ${noteDe(p.depart)}/20`;
}

// Points du graphique : test de départ, QCM d'entraînement du chapitre, tests finals, dans l'ordre.
function pointsDuChapitre(m, c) {
  const p = store.getProgres(m, c);
  const pts = [];
  if (p.depart) pts.push({ date: p.depart.date, note: noteDe(p.depart), type: "depart" });
  for (const q of fichesDuChapitre(m, c).flatMap((f) => f.qcm || [])) pts.push({ date: q.date, note: noteDe(q), type: "qcm" });
  for (const f of p.finals || []) pts.push({ date: f.date, note: noteDe(f), type: "final" });
  pts.sort((a, b) => a.date - b.date);
  let k = 0;
  for (const pt of pts) pt.label = pt.type === "depart" ? "Départ" : pt.type === "final" ? "Final" : `QCM ${++k}`;
  return pts;
}

// Graphique en courbe, notes sur 20, avec la ligne de la moyenne.
function graphique(points) {
  const W = 320, H = 190, L = 30, R = 14, T = 18, B = 34;
  const w = W - L - R, h = H - T - B;
  const x = (i) => (points.length === 1 ? L + w / 2 : L + (i * w) / (points.length - 1));
  const y = (n) => T + (1 - n / 20) * h;
  const montrerLabels = points.length <= 8;
  const grille = [0, 5, 10, 15, 20]
    .map((v) => `<line class="g-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="g-axe" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`)
    .join("");
  const ligne = points.map((pt, i) => `${x(i).toFixed(1)},${y(pt.note).toFixed(1)}`).join(" ");
  const marques = points
    .map(
      (pt, i) => `<circle class="g-pt g-${pt.type}" cx="${x(i)}" cy="${y(pt.note)}" r="${pt.type === "qcm" ? 5 : 7}"/>
      <text class="g-val" x="${x(i)}" y="${y(pt.note) - 11}" text-anchor="middle">${pt.note}</text>
      ${montrerLabels || pt.type !== "qcm" ? `<text class="g-lab" x="${x(i)}" y="${H - 12}" text-anchor="middle">${pt.label}</text>` : ""}`
    )
    .join("");
  return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des notes sur 20 : ${points.map((p) => `${p.label} ${p.note}`).join(", ")}">
    ${grille}
    <line class="g-moy" x1="${L}" x2="${W - R}" y1="${y(10)}" y2="${y(10)}"/>
    ${points.length > 1 ? `<polyline class="g-line" points="${ligne}"/>` : ""}
    ${marques}
  </svg>`;
}

// Grandes barres « Avant / Après », lisibles d'un coup d'œil.
function avantApres(p) {
  const avant = noteDe(p.depart);
  const fin = p.finals?.at(-1);
  const apres = fin ? noteDe(fin) : null;
  const barre = (note, cls, titre) => `
    <div class="aa-col">
      <div class="aa-note">${note === null ? "?" : `${note}<small>/20</small>`}</div>
      <div class="aa-track"><div class="aa-bar ${cls}" style="height:${note === null ? 100 : Math.max(4, (note / 20) * 100)}%"></div></div>
      <div class="aa-lab">${note === null ? "⏳" : humeur(note)} ${titre}</div>
    </div>`;
  let message = "Révise tes fiches et tes cartes, puis fais le test final pour voir tes progrès !";
  if (apres !== null) {
    const gain = apres - avant;
    message =
      gain >= 6 ? `+${gain} points : énorme progrès ! 🚀` :
      gain >= 3 ? `+${gain} points : beau progrès ! 💪` :
      gain > 0 ? `+${gain} point${gain > 1 ? "s" : ""} : tu progresses 👍` :
      gain === 0 ? "Même note qu'au départ : refais un tour des cartes et réessaie." :
      "Pas grave : revois les cartes à revoir, puis retente le test final.";
  }
  return `<div class="card aa">
    <div class="aa-cols">${barre(avant, "avant", "Avant")}<div class="aa-fleche">→</div>${barre(apres, apres === null ? "attente" : "apres", "Après")}</div>
    <p class="aa-msg">${message}</p>
  </div>`;
}

function chapitreView() {
  const m = ui.matiere;
  const c = ui.chapitre;
  const fiches = fichesDuChapitre(m, c);
  const p = store.getProgres(m, c);
  const pts = pointsDuChapitre(m, c);
  const cartes = fiches.flatMap((f) => f.flashcards);
  const maitrise = cartes.length ? Math.round(fiches.reduce((s, f) => s + store.maitrise(f) * f.flashcards.length, 0) / cartes.length) : 0;
  return `
  <header class="top" style="--c:${couleur(m)}">
    <button class="icon" data-back>←</button>
    <div class="title"><small>${emoji(m)} ${esc(m)} · Mes progrès</small>${esc(c)}</div>
    <span></span>
  </header>
  ${
    !p.depart
      ? `<div class="card">
          <h3>🎯 Test de départ</h3>
          <p>Fais-le <b>au début du chapitre</b>, avant de réviser : il montre d'où tu pars. Une note basse est normale, c'est justement ce qu'on veut mesurer !</p>
          <p class="hint">10 questions sur tout le chapitre. À la fin du chapitre, tu referas le même test pour voir tes progrès.</p>
          <button class="btn primary big-btn" data-test="depart">Commencer le test de départ</button>
          <div id="progress"></div>
        </div>`
      : `${avantApres(p)}
        <div class="card">
          <h3>📈 Ton parcours</h3>
          ${graphique(pts)}
          <div class="legende"><span><i class="g-depart"></i>Départ</span><span><i class="g-qcm"></i>QCM d'entraînement</span><span><i class="g-final"></i>Test final</span><span><i class="g-moy-l"></i>Moyenne (10/20)</span></div>
          <div class="maitrise"><span>🃏 Cartes maîtrisées</span><div class="bar wide"><i style="width:${maitrise}%"></i></div><b>${maitrise} %</b></div>
        </div>
        <button class="btn primary big-btn" data-test="final">${p.finals?.length ? "🔁 Refaire le test final" : "🏁 Faire le test final"}</button>
        <p class="hint center">Les mêmes questions qu'au départ, dans un autre ordre : la comparaison est juste.</p>
        <div id="progress"></div>`
  }
  <h3 class="chapitre">Fiches du chapitre</h3>
  <div class="list">${fiches.map((f) => carteFiche(f)).join("")}</div>`;
}

let test = null; // { type, questions, i, choisi, score, erreurs, fini }
async function lancerTest(type) {
  const m = ui.matiere;
  const c = ui.chapitre;
  const p = store.getProgres(m, c);
  let questions;
  if (type === "final" && p.depart?.questions?.length) {
    // Éco-conception : on reprend les questions du départ, sans appel à Claude.
    questions = melangerQCM(p.depart.questions);
  } else {
    const zone = document.getElementById("progress");
    document.querySelectorAll("[data-test]").forEach((b) => (b.disabled = true));
    const pr = progressUI(zone, "Claude prépare ton test sur tout le chapitre…");
    try {
      questions = await ai.genererQCM(ficheChapitre(m, c), "moyen", 10, [], pr.update);
    } catch (err) {
      zone.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      document.querySelectorAll("[data-test]").forEach((b) => (b.disabled = false));
      return;
    } finally {
      pr.stop();
    }
  }
  test = { type, questions, i: 0, choisi: null, score: 0, erreurs: [], fini: false };
  go({ view: "test" });
}

function testView() {
  if (!test) {
    ui.view = "chapitre";
    return chapitreView();
  }
  const titre = test.type === "depart" ? "🎯 Test de départ" : "🏁 Test final";
  const head = `<header class="top" style="--c:${couleur(ui.matiere)}"><button class="icon" data-back>←</button><div class="title"><small>${esc(ui.chapitre)}</small>${titre}</div><span></span></header>`;
  if (test.i >= test.questions.length) {
    const note = store.sur20(test.score, test.questions.length);
    const p = store.getProgres(ui.matiere, ui.chapitre);
    const comparaison =
      test.type === "final" && p.depart
        ? `<div class="compare"><span>Avant <b>${noteDe(p.depart)}/20</b></span><span class="aa-fleche">→</span><span>Maintenant <b>${note}/20</b></span></div>`
        : `<p class="sub">C'est ton point de départ. Révise les fiches et les cartes du chapitre, puis fais le test final !</p>`;
    return `${head}<div class="card center done">
      <div class="big-num">${humeur(note)} ${note}/20</div>
      <p>${test.score} bonne${test.score > 1 ? "s" : ""} réponse${test.score > 1 ? "s" : ""} sur ${test.questions.length}</p>
      ${comparaison}
      ${test.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${test.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <button class="btn primary big-btn" id="test-voir">📈 Voir mes progrès</button>
    </div>`;
  }
  const q = test.questions[test.i];
  const rep = test.choisi;
  return `${head}
  <div class="counter">Question ${test.i + 1} / ${test.questions.length}</div>
  <div class="card question">${esc(q.question)}</div>
  <div class="choices">${q.choix
    .map((ch, i) => {
      let cls = "";
      if (rep !== null) cls = i === q.bonne_reponse ? "good" : i === rep ? "bad" : "dim";
      return `<button class="choice ${cls}" data-tchoix="${i}" ${rep !== null ? "disabled" : ""}><b>${"ABCD"[i]}</b>${esc(ch)}</button>`;
    })
    .join("")}</div>
  ${
    rep !== null
      ? `<div class="explain ${rep === q.bonne_reponse ? "ok" : "ko"}">${rep === q.bonne_reponse ? "✅ Bravo !" : "❌ Raté."} ${esc(q.explication)}</div>
         <button class="btn primary big-btn" id="test-next">${test.i + 1 < test.questions.length ? "Question suivante →" : "Voir ma note"}</button>`
      : ""
  }`;
}
afterRender.test = () => {
  if (!test) return;
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-tchoix]").forEach(
    (b) =>
      (b.onclick = () => {
        const q = test.questions[test.i];
        test.choisi = +b.dataset.tchoix;
        if (test.choisi === q.bonne_reponse) test.score++;
        else test.erreurs.push(`${q.question} → ${q.choix[q.bonne_reponse]}`);
        render();
      })
  );
  if ($("test-next"))
    $("test-next").onclick = () => {
      test.i++;
      test.choisi = null;
      if (test.i >= test.questions.length && !test.fini) {
        test.fini = true;
        const p = store.getProgres(ui.matiere, ui.chapitre);
        const resultat = { date: Date.now(), score: test.score, total: test.questions.length };
        if (test.type === "depart") p.depart = { ...resultat, questions: test.questions };
        else p.finals = [...(p.finals || []), resultat];
        store.saveProgres(ui.matiere, ui.chapitre, p);
        store.enregistrerActivite("qcm");
      }
      render();
      window.scrollTo(0, 0);
    };
  if ($("test-voir"))
    $("test-voir").onclick = () => {
      test = null;
      go({ view: "chapitre" });
    };
};

// ---------- Clics globaux ----------
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-back],[data-open],[data-tab],[data-matiere],[data-scan],[data-revision],[data-delpage],[data-ajout-matiere],[data-retirer],[data-chapitre],[data-test]");
  if (!t) return;
  // D'où vient-on ? (pour que « ← » ramène à la matière ou à l'accueil)
  const origine = ui.view === "matiere" ? "matiere" : "home";
  if (t.dataset.go) go({ view: t.dataset.go, ...(t.dataset.go === "home" ? { matiere: null } : {}) });
  else if (t.dataset.back !== undefined) back();
  else if (t.dataset.open) {
    const f = store.getFiche(t.dataset.open);
    if (f) store.saveFiche({ ...f, vue: Date.now() });
    go({ view: "fiche", ficheId: t.dataset.open, tab: "resume", retour: origine });
  } else if (t.dataset.tab) go({ tab: t.dataset.tab });
  else if (t.dataset.matiere) go({ view: "matiere", matiere: t.dataset.matiere });
  else if (t.dataset.ajoutMatiere !== undefined) ouvrirAjoutMatiere();
  else if (t.dataset.retirer) demanderRetrait(t.dataset.retirer);
  else if (t.dataset.chapitre) go({ view: "chapitre", chapitre: t.dataset.chapitre, matiere: t.dataset.m || ui.matiere });
  else if (t.dataset.test) lancerTest(t.dataset.test);
  else if (t.dataset.scan !== undefined) {
    scanMatiere = t.dataset.scan;
    go({ view: "scan", retour: origine });
  } else if (t.dataset.revision !== undefined) {
    sessionJour = null;
    go({ view: "revision", revMatiere: t.dataset.revision || null, retour: origine });
  }
  else if (t.dataset.delpage !== undefined) {
    pages.splice(+t.dataset.delpage, 1);
    render();
  }
});

render();
