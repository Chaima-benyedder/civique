// =====================================================
//  Test civique : app.js complet
// =====================================================

// ---------- Données et état ----------
const THEMES = [
  { id: "principes",            nom: "Principes et valeurs de la République", emoji: "🇫🇷" },
  { id: "institutions",         nom: "Système institutionnel et politique",   emoji: "🏛️" },
  { id: "droits-devoirs",       nom: "Droits et devoirs des citoyens",        emoji: "⚖️" },
  { id: "histoire-geo-culture", nom: "Histoire, géographie et culture",       emoji: "🗺️" },
  { id: "vie-societe",          nom: "Vivre dans la société française",       emoji: "🏠" }
];

const SEUIL = 80; // % nécessaire pour valider un thème ou l'examen

// Fichiers de questions : on peut en ajouter d'autres ici
const FICHIERS_QUESTIONS = ["questions.json", "questions-2.json"];

const EXAMEN = {
  duree: 45 * 60, // en secondes
  repartition: {
    "principes": 11,
    "institutions": 6,
    "droits-devoirs": 11,
    "histoire-geo-culture": 8,
    "vie-societe": 4
  }
};

let toutesLesQuestions = []; // toutes les questions de tous les fichiers
let questions = [];          // les questions de la partie en cours
let themeActuel = null;
let index = 0;
let score = 0;
let resultats = {};          // meilleurs scores : { principes: 100, examen: 34 }

let modeExamen = false;
let tempsRestant = 0;
let chrono = null;
let reponsesExamen = [];

const app = document.getElementById("app");

// ---------- Sauvegarde ----------
const CLE_SAUVEGARDE = "civique-resultats";

function sauvegarder() {
  localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(resultats));
}

function charger() {
  const brut = localStorage.getItem(CLE_SAUVEGARDE); // texte, ou null si rien
  if (brut === null) return;
  try {
    resultats = JSON.parse(brut);
  } catch (erreur) {
    resultats = {}; // données abîmées : on repart de zéro
  }
}

function reinitialiser() {
  if (confirm("Effacer toute la progression ?")) {
    resultats = {};
    sauvegarder();
    afficherAccueil();
  }
}

// ---------- Mélange ----------
function melanger(tableau) {
  const copie = [...tableau]; // on copie pour ne pas modifier l'original
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function preparerQuestion(q) {
  const bonneReponse = q.choix[q.reponse]; // on retient le TEXTE de la bonne réponse
  const choixMelanges = melanger(q.choix);
  return { ...q, choix: choixMelanges, reponse: choixMelanges.indexOf(bonneReponse) };
}

// ---------- Démarrage ----------
async function chargerFichier(nom) {
  try {
    const reponse = await fetch(nom);
    if (!reponse.ok) return []; // fichier absent : on l'ignore
    return await reponse.json();
  } catch (erreur) {
    console.error("Impossible de lire " + nom, erreur);
    return [];
  }
}

async function init() {
  const listes = await Promise.all(FICHIERS_QUESTIONS.map(chargerFichier));

  // On met tout dans un seul tableau, sans doublon d'id
  const dejaVus = new Set();
  toutesLesQuestions = listes.flat().filter(q => {
    if (dejaVus.has(q.id)) return false;
    dejaVus.add(q.id);
    return true;
  });

  if (toutesLesQuestions.length === 0) {
    app.innerHTML = "<h2>Aucune question trouvée</h2><p>Vérifie questions.json (ouvre la Console pour voir l'erreur).</p>";
    return;
  }

  charger();
  afficherAccueil();
}

// ---------- Écran d'accueil ----------
function afficherAccueil() {
  modeExamen = false;
  arreterChrono();

  const valides = THEMES.filter(t => (resultats[t.id] ?? 0) >= SEUIL).length;

  app.innerHTML = `
    <h1>Test civique</h1>
    <p class="compteur">Thèmes validés : ${valides} / ${THEMES.length} (objectif : ${SEUIL} % par thème)</p>
    <div id="themes"></div>
  `;
  const conteneur = document.getElementById("themes");

  THEMES.forEach(theme => {
    const meilleur = resultats[theme.id];
    const nbQuestions = toutesLesQuestions.filter(q => q.theme === theme.id).length;

    let etat;
    if (meilleur === undefined) {
      etat = `${nbQuestions} questions · à faire`;
    } else if (meilleur >= SEUIL) {
      etat = `✅ Validé · meilleur score : ${meilleur} %`;
    } else {
      etat = `Meilleur score : ${meilleur} % · à retravailler`;
    }

    const btn = document.createElement("button");
    btn.className = "theme";
    btn.innerHTML = `<strong>${theme.emoji} ${theme.nom}</strong><br><small>${etat}</small>`;
    btn.onclick = () => commencerTheme(theme.id);
    conteneur.appendChild(btn);
  });

  const examenBtn = document.createElement("button");
  examenBtn.className = "theme examen";
  const meilleurExamen = resultats.examen !== undefined ? ` · meilleur : ${resultats.examen} / 40` : "";
  examenBtn.innerHTML = `<strong>📝 Examen blanc</strong><br><small>40 questions · 45 min · 32/40 pour réussir${meilleurExamen}</small>`;
  examenBtn.onclick = commencerExamen;
  app.appendChild(examenBtn);

  const reset = document.createElement("button");
  reset.textContent = "Réinitialiser la progression";
  reset.className = "reset";
  reset.onclick = reinitialiser;
  app.appendChild(reset);
}

// ---------- Lancer un thème ----------
function commencerTheme(themeId) {
  modeExamen = false;
  arreterChrono();
  themeActuel = themeId;
  questions = melanger(toutesLesQuestions.filter(q => q.theme === themeId)).map(preparerQuestion);
  index = 0;
  score = 0;
  afficherQuestion();
}

// ---------- Une question (thème ou examen) ----------
function afficherQuestion() {
  const q = questions[index];
  const progression = (index / questions.length) * 100;
  app.innerHTML = `
    ${modeExamen ? '<p id="chrono" class="chrono"></p>' : ""}
    <div class="barre"><div class="barre-remplie" style="width: ${progression}%"></div></div>
    <p class="compteur">Question ${index + 1} / ${questions.length}</p>
    <h2>${q.question}</h2>
    <div id="choix"></div>
    <p id="feedback"></p>
  `;
  q.choix.forEach((texte, i) => {
    const btn = document.createElement("button");
    btn.textContent = texte;
    btn.onclick = () => (modeExamen ? repondreExamen(i) : repondre(i));
    document.getElementById("choix").appendChild(btn);
  });
  if (modeExamen) majChrono();

  // Bouton pour quitter : présent dans les thèmes ET dans l'examen
  const quitter = document.createElement("button");
  quitter.id = "quitter";
  quitter.textContent = modeExamen ? "Abandonner l'examen" : "Quitter ce thème";
  quitter.className = "reset";
  quitter.onclick = quitterQuiz;
  app.appendChild(quitter);
}

// ---------- Mode thème : correction immédiate ----------
function repondre(choisi) {
  const q = questions[index];
  if (choisi === q.reponse) score++;

  const boutons = document.querySelectorAll("#choix button");
  boutons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.reponse) b.classList.add("bonne");
  });
  if (choisi !== q.reponse) boutons[choisi].classList.add("mauvaise");
  document.getElementById("feedback").textContent = q.explication;

  const suivant = document.createElement("button");
  suivant.textContent = "Suivant";
  suivant.className = "suivant";
  suivant.onclick = questionSuivante;
  app.insertBefore(suivant, document.getElementById("quitter")); // "Suivant" au-dessus de "Quitter"
}

function questionSuivante() {
  index++;
  if (index < questions.length) {
    afficherQuestion();
  } else {
    afficherFin();
  }
}

// ---------- Fin d'un thème ----------
function afficherFin() {
  const pourcentage = Math.round((score / questions.length) * 100);

  // On garde le MEILLEUR score, pas le dernier
  if (resultats[themeActuel] === undefined || pourcentage > resultats[themeActuel]) {
    resultats[themeActuel] = pourcentage;
    sauvegarder();
  }

  const reussi = pourcentage >= SEUIL;

  let message;
  if (reussi) {
    message = "🎉 Thème validé !";
  } else {
    message = `Il faut ${SEUIL} % pour valider. Continue à t'entraîner !`;
  }

  app.innerHTML = `
    <h2>Thème terminé !</h2>
    <p>Ton score : ${score} / ${questions.length} (${pourcentage} %)</p>
    <p>${message}</p>
  `;

  const recommencer = document.createElement("button");
  recommencer.textContent = "Recommencer ce thème";
  recommencer.className = "suivant";
  recommencer.onclick = () => commencerTheme(themeActuel);
  app.appendChild(recommencer);

  const retour = document.createElement("button");
  retour.textContent = "Retour aux thèmes";
  retour.className = "suivant";
  retour.onclick = afficherAccueil;
  app.appendChild(retour);
}

// ---------- Examen blanc ----------
function formaterTemps(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function majChrono() {
  const el = document.getElementById("chrono");
  if (el) el.textContent = "⏱️ " + formaterTemps(tempsRestant);
}

function arreterChrono() {
  clearInterval(chrono);
  chrono = null;
}

function quitterQuiz() {
  const message = modeExamen
    ? "Abandonner l'examen ? Cette tentative ne sera pas enregistrée."
    : "Quitter ce thème ? Le score de cette tentative ne sera pas enregistré.";
  if (confirm(message)) {
    modeExamen = false;
    arreterChrono();
    afficherAccueil();
  }
}

function commencerExamen() {
  // On tire au hasard les questions de chaque thème, selon la répartition officielle
  const selection = [];
  for (const themeId in EXAMEN.repartition) {
    const disponibles = toutesLesQuestions.filter(q => q.theme === themeId);
    selection.push(...melanger(disponibles).slice(0, EXAMEN.repartition[themeId]));
  }
  questions = melanger(selection).map(preparerQuestion);

  modeExamen = true;
  themeActuel = "examen";
  index = 0;
  score = 0;
  reponsesExamen = [];
  tempsRestant = EXAMEN.duree;

  arreterChrono();
  chrono = setInterval(() => {
    tempsRestant--;
    majChrono();
    if (tempsRestant <= 0) afficherFinExamen();
  }, 1000);

  afficherQuestion();
}

function repondreExamen(choisi) {
  const q = questions[index];
  reponsesExamen.push({ choisi });
  if (choisi === q.reponse) score++;
  index++;
  if (index < questions.length) {
    afficherQuestion();
  } else {
    afficherFinExamen();
  }
}

function afficherFinExamen() {
  if (!modeExamen) return; // évite d'afficher la fin deux fois
  modeExamen = false;
  arreterChrono();

  const total = questions.length;
  const seuil = Math.ceil(total * SEUIL / 100); // 32 pour 40 questions
  const reussi = score >= seuil;
  const tempsUtilise = EXAMEN.duree - Math.max(tempsRestant, 0);

  if (resultats.examen === undefined || score > resultats.examen) {
    resultats.examen = score;
    sauvegarder();
  }

  // Les erreurs = mauvaises réponses + questions non répondues (temps écoulé)
  const erreurs = questions
    .map((q, i) => ({ q, choisi: reponsesExamen[i] ? reponsesExamen[i].choisi : null }))
    .filter(e => e.choisi !== e.q.reponse);

  let html = `
    <h2>${reussi ? "🎉 Examen réussi !" : "Examen non validé"}</h2>
    <p>Score : ${score} / ${total} (il faut ${seuil} pour réussir)</p>
    <p>Temps utilisé : ${formaterTemps(tempsUtilise)}</p>
    <h3>À revoir (${erreurs.length})</h3>
  `;
  erreurs.forEach(e => {
    const taReponse = e.choisi === null ? "Pas de réponse" : e.q.choix[e.choisi];
    html += `
      <div class="erreur">
        <strong>${e.q.question}</strong>
        <p>Ta réponse : ${taReponse}</p>
        <p>Bonne réponse : ${e.q.choix[e.q.reponse]}</p>
        <small>${e.q.explication} (${e.q.source})</small>
      </div>`;
  });
  app.innerHTML = html;

  const recommencer = document.createElement("button");
  recommencer.textContent = "Nouvel examen blanc";
  recommencer.className = "suivant";
  recommencer.onclick = commencerExamen;
  app.appendChild(recommencer);

  const retour = document.createElement("button");
  retour.textContent = "Retour à l'accueil";
  retour.className = "suivant";
  retour.onclick = afficherAccueil;
  app.appendChild(retour);
}

init();