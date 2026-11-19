import "./style.css";
import { marked } from "marked";
import { Capacitor } from "@capacitor/core";
import * as store from "./store.js";
import * as ai from "./claude.js";
import { ficheDeDepart } from "./demo.js";

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
const COULEURS = {
  math: "#0f9d8a", fran: "#e17055", hist: "#d4a017", géo: "#d4a017", svt: "#2f9e44", phys: "#1c7ed6",
  chim: "#1c7ed6", angl: "#e84393", espa: "#fd79a8", allem: "#fd79a8", philo: "#636e72", éco: "#00cec9", ses: "#00cec9", tech: "#74b9ff",
};
const couleur = (matiere = "") => {
  const m = matiere.toLowerCase();
  for (const k in COULEURS) if (m.includes(k)) return COULEURS[k];
  return "#64748b";
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
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- Navigation ----------
let ui = { view: "home", ficheId: null, tab: "resume", filtre: "Toutes" };
const go = (patch) => {
  ui = { ...ui, ...patch };
  render();
  window.scrollTo(0, 0);
};
function back() {
  if (ui.view === "fiche" || ui.view === "scan" || ui.view === "settings" || ui.view === "revision") go({ view: "home" });
}
// Bouton retour d'Android : revient à l'accueil, ou quitte l'appli depuis l'accueil.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", () => (ui.view === "home" || ui.view === "welcome" ? App.exitApp() : back()))
  );
}

function entrerDemo() {
  store.saveSettings({ demo: true });
  if (!store.getFiches().some((f) => f.demoKey)) store.saveFiche(nouvelleFiche(ficheDeDepart()));
  go({ view: "home" });
}
function quitterDemo() {
  store.saveSettings({ demo: false });
  store.getFiches().filter((f) => f.demoKey).forEach((f) => store.deleteFiche(f.id));
}

function render() {
  const s = store.getSettings();
  if (DEMO_ONLY && !s.demo) return entrerDemo();
  if (!s.apiKey && !s.demo && ui.view !== "settings") ui.view = "welcome";
  const views = { welcome, home, scan, fiche: ficheView, settings, revision };
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
  const matieres = ["Toutes", ...new Set(fiches.map((f) => f.matiere))];
  const liste = fiches.filter((f) => ui.filtre === "Toutes" || f.matiere === ui.filtre);
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

  <button class="btn primary big-btn" data-go="scan">📸 Scanner une fiche</button>
  ${dues ? `<button class="btn secondary big-btn" data-go="revision">🃏 Révision du jour (${dues} cartes)</button>` : ""}

  ${
    fiches.length
      ? `<div class="chips">${matieres
          .map((m) => `<button class="chip ${m === ui.filtre ? "on" : ""}" data-filtre="${esc(m)}">${esc(m)}</button>`)
          .join("")}</div>
         <div class="list">${liste.map(carteFiche).join("")}</div>`
      : `<div class="empty">Aucune fiche pour l'instant.<br>Commence par scanner ton premier cours !</div>`
  }`;
}
function carteFiche(f) {
  const m = store.maitrise(f);
  const d = store.cartesDues(f).length;
  return `
  <button class="fiche-card" data-open="${f.id}" style="--c:${couleur(f.matiere)}">
    <div class="tag">${esc(f.matiere)}</div>
    <div class="titre">${esc(f.titre)}</div>
    <div class="meta">${f.flashcards.length} cartes · ${d ? `${d} à revoir` : "à jour ✅"}</div>
    <div class="bar"><i style="width:${m}%"></i></div>
  </button>`;
}

// ---------- Scanner ----------
let pages = [];
let scanNote = "";
let analyseEnCours = false;
function scan() {
  return `
  <header class="top"><button class="icon" data-go="home">←</button><div class="title">Nouvelle fiche</div><span></span></header>
  <p class="hint">Prends une photo par page, bien à plat et bien éclairée. Tu peux ajouter plusieurs pages ou un PDF.</p>
  <div class="pages">
    ${pages
      .map(
        (p, i) => `<div class="page">${
          p.kind === "pdf" ? `<div class="pdf">📄 PDF<br><small>${esc(p.name)}</small></div>` : `<img src="${p.preview}" alt="page ${i + 1}">`
        }<button class="del" data-delpage="${i}">✕</button><span class="num">${i + 1}</span></div>`
      )
      .join("")}
    <button class="page add" id="btn-photo">📸<br>Photo</button>
    <button class="page add" id="btn-import">🖼️<br>Galerie / PDF</button>
  </div>
  <input type="file" id="file-import" accept="image/*,application/pdf" multiple hidden>
  <input type="file" id="file-camera" accept="image/*" capture="environment" hidden>
  <label class="field">Une précision pour Claude ? (facultatif)
    <input id="note" placeholder="ex : chapitre 3, contrôle vendredi sur la partie 2" value="${esc(scanNote)}">
  </label>
  <button class="btn primary big-btn" id="btn-analyser" ${pages.length && !analyseEnCours ? "" : "disabled"}>✨ Créer ma fiche de révision</button>
  <div id="progress"></div>`;
}
afterRender.scan = () => {
  const $ = (id) => document.getElementById(id);
  $("note").oninput = (e) => (scanNote = e.target.value);
  $("btn-import").onclick = () => $("file-import").click();
  $("btn-photo").onclick = prendrePhoto;
  $("file-import").onchange = (e) => ajouterFichiers(e.target.files);
  $("file-camera").onchange = (e) => ajouterFichiers(e.target.files);
  $("btn-analyser").onclick = analyser;
};
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
    matiere: r.matiere || "Autre",
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
    const r = await ai.analyserCours(pages, scanNote, p.update);
    const fiche = nouvelleFiche(r);
    store.saveFiche(fiche);
    pages = [];
    scanNote = "";
    go({ view: "fiche", ficheId: fiche.id, tab: "resume" });
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
    <button class="icon" data-go="home">←</button>
    <div class="title"><small>${esc(f.matiere)}</small>${esc(f.titre)}</div>
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
      go({ view: "home" });
    }
  };
  ({ cartes: bindCartes, qcm: bindQCM, sujet: bindSujet, prof: bindProf, resume: bindResume })[ui.tab]?.(f);
};

// --- Résumé
function tabResume(f) {
  return `
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

// --- Révision du jour (toutes matières)
let sessionJour = null;
function revision() {
  if (!sessionJour) {
    const cartes = store.getFiches().flatMap((f) => store.cartesDues(f).map((c) => ({ ...c, ficheId: f.id })));
    sessionJour = { cartes: shuffle(cartes).slice(0, 40), i: 0, retourne: false, sues: 0 };
  }
  return `<header class="top"><button class="icon" data-go="home">←</button><div class="title">Révision du jour</div><span></span></header>
  ${sessionCartes(null, sessionJour)}`;
}
afterRender.revision = () =>
  bindSession(sessionJour, () => {
    sessionJour = null;
    go({ view: "home" });
  });

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
      const questions = shuffle(f.dernierQCM).map((q) => {
        // Mélange aussi l'ordre des propositions.
        const ordre = shuffle(q.choix.map((_, i) => i));
        return { ...q, choix: ordre.map((i) => q.choix[i]), bonne_reponse: ordre.indexOf(q.bonne_reponse) };
      });
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

// ---------- Clics globaux ----------
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-open],[data-tab],[data-filtre],[data-delpage]");
  if (!t) return;
  if (t.dataset.go) go({ view: t.dataset.go });
  else if (t.dataset.open) go({ view: "fiche", ficheId: t.dataset.open, tab: "resume" });
  else if (t.dataset.tab) go({ tab: t.dataset.tab });
  else if (t.dataset.filtre) go({ filtre: t.dataset.filtre });
  else if (t.dataset.delpage !== undefined) {
    pages.splice(+t.dataset.delpage, 1);
    render();
  }
});

render();
