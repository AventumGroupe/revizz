// Scanner intégré : l'appareil photo reste ouvert, chaque appui sur le déclencheur ajoute une page.
// Pas de validation page par page : on enchaîne, puis « Terminé ».

/**
 * Ouvre le scanner plein écran.
 * @param {{ multi: boolean, dejaPrises: number, onPage: (dataUrl: string) => Promise<void> | void,
 *           onRetirer: () => void, onFin: () => void }} options
 * @returns {Promise<boolean>} false si la caméra intégrée n'est pas disponible (on passe alors à la méthode classique).
 */
export async function ouvrirScanner({ multi, dejaPrises = 0, onPage, onRetirer, onFin }) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
    });
  } catch {
    return false;
  }

  let enChaine = multi;
  let prises = 0;
  const el = document.createElement("div");
  el.className = "scanner";
  el.innerHTML = `
    <video playsinline muted autoplay></video>
    <div class="sc-cadre"></div>
    <div class="sc-flash"></div>
    <div class="sc-haut">
      <button class="sc-btn" data-a="fermer" aria-label="Fermer">✕</button>
      <div class="sc-mode" role="group" aria-label="Mode de scan">
        <button data-mode="une">Une page</button><button data-mode="plusieurs">Plusieurs pages</button>
      </div>
      <span class="sc-place"></span>
    </div>
    <p class="sc-aide"></p>
    <div class="sc-bas">
      <div class="sc-vignette"><img alt=""><b class="sc-compte"></b><button class="sc-annuler" data-a="annuler" aria-label="Retirer la dernière page">↩︎</button></div>
      <button class="sc-declencheur" data-a="photo" aria-label="Prendre la page en photo"><span></span></button>
      <button class="sc-fini" data-a="fini">Terminé</button>
    </div>`;
  document.body.appendChild(el);
  const video = el.querySelector("video");
  video.srcObject = stream;
  await video.play().catch(() => {});

  const $ = (s) => el.querySelector(s);
  const maj = () => {
    el.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", (b.dataset.mode === "plusieurs") === enChaine));
    const total = dejaPrises + prises;
    $(".sc-aide").textContent = enChaine
      ? total
        ? `Page ${total + 1} : tourne la page et appuie à nouveau.`
        : "Cadre la première page, puis appuie. Enchaîne les pages sans rien valider."
      : "Cadre ta page bien à plat, puis appuie.";
    $(".sc-vignette").classList.toggle("vide", !prises);
    $(".sc-compte").textContent = total;
    $(".sc-fini").textContent = total ? `Terminé (${total}) ✓` : "Terminé";
    $(".sc-fini").hidden = !enChaine;
  };
  maj();

  const fermer = () => {
    stream.getTracks().forEach((t) => t.stop());
    el.remove();
    onFin();
  };

  let occupe = false;
  async function photo() {
    if (occupe || !video.videoWidth) return;
    occupe = true;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    // Retour immédiat : flash, petite vibration, vignette.
    $(".sc-flash").classList.remove("go");
    void $(".sc-flash").offsetWidth;
    $(".sc-flash").classList.add("go");
    navigator.vibrate?.(30);
    $(".sc-vignette img").src = dataUrl;
    prises++;
    maj();
    await onPage(dataUrl);
    occupe = false;
    if (!enChaine) fermer();
  }

  el.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) {
      enChaine = m.dataset.mode === "plusieurs";
      return maj();
    }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "photo") photo();
    else if (a === "fermer" || a === "fini") fermer();
    else if (a === "annuler" && prises) {
      prises--;
      onRetirer();
      if (!prises) $(".sc-vignette img").removeAttribute("src");
      maj();
    }
  });
  // Boutons de volume ou touche Entrée sur un clavier : déclencheur.
  el.tabIndex = -1;
  el.focus();
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "AudioVolumeUp" || e.key === "AudioVolumeDown") {
      e.preventDefault();
      photo();
    } else if (e.key === "Escape") fermer();
  });
  return true;
}
