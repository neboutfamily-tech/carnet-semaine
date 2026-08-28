import React from 'react';
import { useState, useEffect, useMemo } from "react";
import {
  Users, ChefHat, ShoppingCart, Dumbbell, Plus, Trash2, Loader2,
  RefreshCw, AlertCircle, Info, Sparkles, Sun, CloudSun, Cloud,
  CloudRain, CloudSnow, Wind, Check, X,
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Constantes                                                        */
/* ---------------------------------------------------------------- */

const JOURS = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

const REPAS = [
  { key: "petit_dejeuner", label: "Petit-déjeuner" },
  { key: "dejeuner", label: "Déjeuner" },
  { key: "gouter", label: "Goûter" },
  { key: "diner", label: "Dîner" },
];

const METEOS = [
  { key: "ensoleille", label: "Ensoleillé", Icon: Sun },
  { key: "doux", label: "Doux", Icon: CloudSun },
  { key: "nuageux", label: "Nuageux", Icon: Cloud },
  { key: "pluvieux", label: "Pluvieux", Icon: CloudRain },
  { key: "froid", label: "Froid / venteux", Icon: Wind },
  { key: "neige", label: "Neige / verglas", Icon: CloudSnow },
];

const CATEGORIES = [
  "Fruits & légumes",
  "Viande & poisson",
  "Crémerie & œufs",
  "Épicerie & féculents",
  "Boissons",
  "Autres",
];

const COLORS = {
  paper: "#F5F6F1",
  card: "#FFFFFF",
  ink: "#23322B",
  inkSoft: "#5B6459",
  primary: "#3D6B52",
  primaryDark: "#2A4A39",
  primarySoft: "#E4ECE5",
  gold: "#C98A2E",
  goldSoft: "#F3E4C6",
  alert: "#B5482F",
  alertSoft: "#F5E1DA",
  border: "#DBDCD1",
};

const SYSTEM_PROMPT = `Tu es un assistant qui aide une famille française à planifier UNE journée de repas (petit-déjeuner, déjeuner, goûter, dîner) et une activité physique.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans balises markdown (pas de \`\`\`), respectant EXACTEMENT ce schéma :

{
  "repas": {
    "petit_dejeuner": {"titre": string, "description": string, "ingredients": [{"nom": string, "categorie": string}]} ou null,
    "dejeuner": {"titre": string, "description": string, "ingredients": [{"nom": string, "categorie": string}]} ou null,
    "gouter": {"titre": string, "description": string, "ingredients": [{"nom": string, "categorie": string}]} ou null,
    "diner": {"titre": string, "description": string, "ingredients": [{"nom": string, "categorie": string}]} ou null
  },
  "activites": [
    {"personne": string, "activite": string, "duree": string, "notes": string}
  ]
}

"categorie" doit être une valeur EXACTE parmi : "Fruits & légumes", "Viande & poisson", "Crémerie & œufs", "Épicerie & féculents", "Boissons", "Autres".
Si un repas n'a personne présent, mets sa valeur à null. Si personne n'est présent ce jour-là, "activites" est un tableau vide.

Règles impératives :
- Un seul menu commun par repas, adapté à TOUTES les personnes présentes à ce repas (jamais un menu séparé par personne).
- Priorité 1 : respecter strictement les contraintes médicales indiquées pour chaque personne présente à ce repas.
- Priorité 2 : éviter les aliments qu'une personne présente n'aime pas ; privilégier ceux qu'elle aime.
- Si les goûts de plusieurs personnes présentes divergent, trouve un plat commun et précise dans la "description" une petite variante ou un accompagnement pour concilier les deux.
- Tiens compte de la saison et de la météo du jour indiquées pour privilégier des produits de saison.
- Les indications de poids sont informatives (IMC) : ne propose jamais de régime restrictif à cause du poids seul ; privilégie simplement l'équilibre nutritionnel, sauf contre-indication médicale explicite fournie.
- Les activités physiques doivent tenir compte de la météo du jour (propose une alternative en intérieur si la météo n'est pas favorable) et des contraintes médicales de chaque personne présente ce jour-là.
- Reste concis : "description" en 1 à 2 phrases maximum, "notes" d'activité en 1 phrase maximum, 3 à 8 ingrédients par repas.
- N'invente aucun champ supplémentaire, respecte exactement le schéma demandé.`;

/* ---------------------------------------------------------------- */
/* Fonctions utilitaires                                             */
/* ---------------------------------------------------------------- */

function calcIMC(taille_cm, poids_kg) {
  const t = parseFloat(taille_cm);
  const p = parseFloat(poids_kg);
  if (!t || !p) return null;
  const m = t / 100;
  const imc = p / (m * m);
  let categorie;
  if (imc < 18.5) categorie = "Insuffisance pondérale";
  else if (imc < 25) categorie = "Corpulence normale";
  else if (imc < 30) categorie = "Surpoids";
  else categorie = "Obésité";
  return { valeur: Math.round(imc * 10) / 10, categorie };
}

function prochainLundi() {
  const d = new Date();
  const jour = d.getDay(); // 0 = dimanche, 1 = lundi ...
  const diff = jour === 0 ? 1 : jour === 1 ? 0 : 8 - jour;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function calcSaison(dateStr) {
  if (!dateStr) return "Saison inconnue";
  const mois = new Date(dateStr + "T00:00:00").getMonth() + 1;
  if ([12, 1, 2].includes(mois)) return "Hiver";
  if ([3, 4, 5].includes(mois)) return "Printemps";
  if ([6, 7, 8].includes(mois)) return "Été";
  return "Automne";
}

function dateDuJour(dateDebut, index) {
  if (!dateDebut) return null;
  const d = new Date(dateDebut + "T00:00:00");
  d.setDate(d.getDate() + index);
  return d;
}

function formatDateFr(d) {
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

async function storageGet(key) {
  try {
    const res = await window.storage.get(key, false);
    return res ? res.value : null;
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  window.storage.set(key, value, false).catch(() => {});
}

/* ---------------------------------------------------------------- */
/* Composant principal                                               */
/* ---------------------------------------------------------------- */

export default function App() {
  const [famille, setFamille] = useState([]);
  const [dateDebut, setDateDebut] = useState(prochainLundi());
  const [meteoParJour, setMeteoParJour] = useState({});
  const [presence, setPresence] = useState({});
  const [resultats, setResultats] = useState({});
  const [statutJour, setStatutJour] = useState({});
  const [erreurJour, setErreurJour] = useState({});

  const [onglet, setOnglet] = useState("famille");
  const [jourActifSemaine, setJourActifSemaine] = useState("lundi");
  const [jourActifResultats, setJourActifResultats] = useState("lundi");
  const [vueResultats, setVueResultats] = useState("jour");
  const [genEnCours, setGenEnCours] = useState(false);
  const [pret, setPret] = useState(false);

  /* --- Chargement initial depuis le stockage --- */
  useEffect(() => {
    (async () => {
      const f = await storageGet("famille-membres");
      if (f) {
        try { setFamille(JSON.parse(f)); } catch (e) {}
      }
      const p = await storageGet("parametres-semaine");
      if (p) {
        try {
          const parsed = JSON.parse(p);
          if (parsed.dateDebut) setDateDebut(parsed.dateDebut);
          if (parsed.meteoParJour) setMeteoParJour(parsed.meteoParJour);
        } catch (e) {}
      }
      const pr = await storageGet("presence-semaine");
      if (pr) {
        try { setPresence(JSON.parse(pr)); } catch (e) {}
      }
      const r = await storageGet("derniers-resultats");
      if (r) {
        try {
          const parsed = JSON.parse(r);
          setResultats(parsed);
          const st = {};
          Object.keys(parsed).forEach((k) => { st[k] = "done"; });
          setStatutJour(st);
        } catch (e) {}
      }
      setPret(true);
    })();
  }, []);

  /* --- Famille : CRUD --- */
  function saveFamille(next) {
    setFamille(next);
    storageSet("famille-membres", JSON.stringify(next));
  }
  function ajouterMembre() {
    const nouveau = {
      id: "p" + Date.now(),
      nom: "",
      taille_cm: "",
      poids_kg: "",
      contraintes: "",
      aime: "",
      naimePas: "",
    };
    saveFamille([...famille, nouveau]);
  }
  function modifierMembre(id, champ, valeur) {
    saveFamille(famille.map((m) => (m.id === id ? { ...m, [champ]: valeur } : m)));
  }
  function supprimerMembre(id) {
    saveFamille(famille.filter((m) => m.id !== id));
    setPresence((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      JOURS.forEach((j) => {
        REPAS.forEach((r) => {
          if (copy[j.key] && copy[j.key][r.key]) {
            copy[j.key][r.key] = copy[j.key][r.key].filter((pid) => pid !== id);
          }
        });
      });
      storageSet("presence-semaine", JSON.stringify(copy));
      return copy;
    });
  }

  /* --- Semaine : dates et météo --- */
  function changerDateDebut(v) {
    setDateDebut(v);
    storageSet("parametres-semaine", JSON.stringify({ dateDebut: v, meteoParJour }));
  }
  function changerMeteo(jourKey, meteoKey) {
    setMeteoParJour((prev) => {
      const copy = { ...prev, [jourKey]: meteoKey };
      storageSet("parametres-semaine", JSON.stringify({ dateDebut, meteoParJour: copy }));
      return copy;
    });
  }

  /* --- Présence par repas --- */
  function estPresent(jourKey, repasKey, id) {
    const liste = presence[jourKey] ? presence[jourKey][repasKey] : undefined;
    if (liste === undefined) return true; // par défaut : tout le monde est présent
    return liste.includes(id);
  }
  function togglePresence(jourKey, repasKey, id) {
    setPresence((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[jourKey]) copy[jourKey] = {};
      let liste = copy[jourKey][repasKey];
      if (liste === undefined) {
        liste = famille.map((m) => m.id).filter((pid) => pid !== id);
      } else if (liste.includes(id)) {
        liste = liste.filter((pid) => pid !== id);
      } else {
        liste = [...liste, id];
      }
      copy[jourKey][repasKey] = liste;
      storageSet("presence-semaine", JSON.stringify(copy));
      return copy;
    });
  }
  function personnesPresentesJour(jourKey) {
    const ids = new Set();
    REPAS.forEach((r) => {
      famille.forEach((m) => {
        if (estPresent(jourKey, r.key, m.id)) ids.add(m.id);
      });
    });
    return famille.filter((m) => ids.has(m.id));
  }

  /* --- Construction du message envoyé à l'IA pour un jour --- */
  function detailsPersonne(m) {
    const imc = calcIMC(m.taille_cm, m.poids_kg);
    const lignes = [`- ${m.nom || "Sans nom"}`];
    if (imc) lignes.push(`  Indication de poids (IMC informatif, non médical) : ${imc.categorie}`);
    if (m.contraintes) lignes.push(`  Contraintes médicales / traitements à respecter : ${m.contraintes}`);
    if (m.aime) lignes.push(`  Aime particulièrement : ${m.aime}`);
    if (m.naimePas) lignes.push(`  N'aime pas / à éviter par goût : ${m.naimePas}`);
    return lignes.join("\n");
  }

  function construireMessageJour(jourKey, jourLabel, dateLabel, saison, meteoLabel) {
    const parts = [];
    parts.push(`Jour à planifier : ${jourLabel} ${dateLabel}.`);
    parts.push(`Saison : ${saison}. Météo prévue ce jour : ${meteoLabel}.`);
    parts.push("");
    parts.push("REPAS — convives présents à chaque repas :");
    REPAS.forEach((r) => {
      const presents = famille.filter((m) => estPresent(jourKey, r.key, m.id));
      parts.push(`\n${r.label} :`);
      if (presents.length === 0) {
        parts.push("Personne présent à ce repas -> renvoyer null pour ce repas dans le JSON.");
      } else {
        presents.forEach((m) => parts.push(detailsPersonne(m)));
      }
    });
    parts.push("\n\nACTIVITÉ PHYSIQUE — personnes présentes ce jour (au moins un repas) :");
    const presentsJour = personnesPresentesJour(jourKey);
    if (presentsJour.length === 0) {
      parts.push("Personne présent ce jour -> renvoyer un tableau \"activites\" vide.");
    } else {
      presentsJour.forEach((m) => parts.push(detailsPersonne(m)));
    }
    return parts.join("\n");
  }

  /* --- Appel à l'API pour générer un jour --- */
  async function genererJour(jourKey) {
    const idx = JOURS.findIndex((j) => j.key === jourKey);
    const jourInfo = JOURS[idx];
    const dateLabel = formatDateFr(dateDuJour(dateDebut, idx));
    const saison = calcSaison(dateDebut);
    const meteoKey = meteoParJour[jourKey] || "doux";
    const meteoLabel = (METEOS.find((m) => m.key === meteoKey) || METEOS[1]).label;

    setStatutJour((prev) => ({ ...prev, [jourKey]: "loading" }));
    setErreurJour((prev) => ({ ...prev, [jourKey]: null }));

    try {
      const userMsg = construireMessageJour(jourKey, jourInfo.label, dateLabel, saison, meteoLabel);
    const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMsg }
          ],
          model: "openai",
        }),
      });
      const data = await response.text();
      if (!response.ok) throw new Error("Erreur réseau (" + response.status + ")");
      const data = await response.json();
      const texte = (data.content || [])
        .map((b) => (b && b.type === "text" ? b.text : ""))
        .join("");
      const nettoye = texte.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(nettoye);

      setResultats((prev) => {
        const copy = { ...prev, [jourKey]: parsed };
        storageSet("derniers-resultats", JSON.stringify(copy));
        return copy;
      });
      setStatutJour((prev) => ({ ...prev, [jourKey]: "done" }));
    } catch (e) {
      setStatutJour((prev) => ({ ...prev, [jourKey]: "error" }));
      setErreurJour((prev) => ({ ...prev, [jourKey]: (e && e.message) || "Erreur de génération" }));
    }
  }

  async function genererSemaine() {
    if (famille.length === 0 || !dateDebut) return;
    setGenEnCours(true);
    setOnglet("resultats");
    setVueResultats("jour");
    for (const j of JOURS) {
      await genererJour(j.key);
      setJourActifResultats(j.key);
    }
    setGenEnCours(false);
  }

  function reinitialiser() {
    setFamille([]);
    setPresence({});
    setResultats({});
    setStatutJour({});
    setErreurJour({});
    storageSet("famille-membres", JSON.stringify([]));
    storageSet("presence-semaine", JSON.stringify({}));
    storageSet("derniers-resultats", JSON.stringify({}));
  }

  /* --- Liste de courses agrégée (dérivée des résultats) --- */
  const listeCourses = useMemo(() => {
    const parCategorie = {};
    CATEGORIES.forEach((c) => { parCategorie[c] = new Map(); });
    Object.values(resultats).forEach((jour) => {
      if (!jour || !jour.repas) return;
      REPAS.forEach((r) => {
        const repas = jour.repas[r.key];
        if (repas && Array.isArray(repas.ingredients)) {
          repas.ingredients.forEach((ing) => {
            if (!ing || !ing.nom) return;
            const cat = CATEGORIES.includes(ing.categorie) ? ing.categorie : "Autres";
            const nomPropre = String(ing.nom).trim();
            if (nomPropre) parCategorie[cat].set(nomPropre.toLowerCase(), nomPropre);
          });
        }
      });
    });
    const out = {};
    CATEGORIES.forEach((c) => {
      out[c] = Array.from(parCategorie[c].values()).sort((a, b) => a.localeCompare(b, "fr"));
    });
    return out;
  }, [resultats]);

  const [coches, setCoches] = useState({});
  function toggleCoche(nom) {
    setCoches((prev) => ({ ...prev, [nom]: !prev[nom] }));
  }

  const nbJoursGeneres = JOURS.filter((j) => statutJour[j.key] === "done").length;
  const totalArticles = Object.values(listeCourses).reduce((s, l) => s + l.length, 0);

  if (!pret) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.paper }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: COLORS.primary }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.paper, color: COLORS.ink }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: COLORS.primaryDark }}>
              Le carnet de la semaine
            </h1>
            <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>
              Menus, courses et activités générés pour votre famille, repas par repas.
            </p>
          </div>
          <button
            onClick={reinitialiser}
            title="Réinitialiser toutes les données"
            className="shrink-0 p-2 rounded-full border transition-colors hover:opacity-70"
            style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton active={onglet === "famille"} onClick={() => setOnglet("famille")} Icon={Users} label={`Famille (${famille.length})`} />
          <TabButton active={onglet === "semaine"} onClick={() => setOnglet("semaine")} Icon={ChefHat} label="Semaine" />
          <TabButton active={onglet === "resultats"} onClick={() => setOnglet("resultats")} Icon={Sparkles} label="Résultats" />
        </div>

        {/* --- Onglet Famille --- */}
        {onglet === "famille" && (
          <div className="space-y-4">
            <div className="rounded-xl border p-3 flex items-start gap-2 text-xs" style={{ borderColor: COLORS.border, backgroundColor: COLORS.primarySoft, color: COLORS.primaryDark }}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Les tailles/poids servent uniquement à afficher un IMC indicatif (informatif, pas un diagnostic). Indiquez les contraintes prescrites par un professionnel de santé dans le champ dédié — c'est ce champ qui guidera réellement les menus et les activités.</p>
            </div>

            {famille.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}>
                <Users className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm mb-3">Ajoutez un premier membre de la famille pour commencer.</p>
                <button onClick={ajouterMembre} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white" style={{ backgroundColor: COLORS.primary }}>
                  <Plus className="w-4 h-4" /> Ajouter un membre
                </button>
              </div>
            )}

            {famille.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {famille.map((m) => (
                  <MembreCard key={m.id} membre={m} onChange={modifierMembre} onDelete={() => supprimerMembre(m.id)} />
                ))}
              </div>
            )}

            {famille.length > 0 && (
              <button onClick={ajouterMembre} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm border" style={{ borderColor: COLORS.primary, color: COLORS.primary }}>
                <Plus className="w-4 h-4" /> Ajouter un membre
              </button>
            )}
          </div>
        )}

        {/* --- Onglet Semaine --- */}
        {onglet === "semaine" && (
          <div className="space-y-5">
            <div className="rounded-xl border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.card }}>
              <label className="block text-xs uppercase tracking-wide mb-1" style={{ color: COLORS.inkSoft }}>Semaine à partir du (lundi)</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => changerDateDebut(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                  style={{ borderColor: COLORS.border }}
                />
                <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: COLORS.goldSoft, color: COLORS.gold }}>
                  Saison : {calcSaison(dateDebut)}
                </span>
              </div>
            </div>

            {famille.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Ajoutez d'abord au moins un membre de la famille dans l'onglet « Famille ».</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {JOURS.map((j) => (
                    <button
                      key={j.key}
                      onClick={() => setJourActifSemaine(j.key)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors"
                      style={
                        jourActifSemaine === j.key
                          ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary, color: "white" }
                          : { borderColor: COLORS.border, color: COLORS.ink }
                      }
                    >
                      {j.label}
                    </button>
                  ))}
                </div>

                <JourSemaine
                  jourKey={jourActifSemaine}
                  famille={famille}
                  meteo={meteoParJour[jourActifSemaine] || "doux"}
                  onMeteo={(v) => changerMeteo(jourActifSemaine, v)}
                  estPresent={estPresent}
                  togglePresence={togglePresence}
                />

                <div className="pt-2">
                  <button
                    onClick={genererSemaine}
                    disabled={genEnCours}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: COLORS.primary }}
                  >
                    {genEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {genEnCours ? `Génération en cours… (${nbJoursGeneres}/7)` : "Générer les menus de la semaine"}
                  </button>
                  <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
                    Chaque jour est généré séparément par l'IA au moment du clic, en tenant compte de la saison, de la météo, des présences, des contraintes et des goûts que vous avez saisis.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- Onglet Résultats --- */}
        {onglet === "resultats" && (
          <div className="space-y-4">
            {Object.keys(resultats).length === 0 && !genEnCours && (
              <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}>
                <Sparkles className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm">Aucun menu généré pour l'instant. Rendez-vous dans l'onglet « Semaine » pour lancer la génération.</p>
              </div>
            )}

            {(Object.keys(resultats).length > 0 || genEnCours) && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVueResultats("jour")}
                    className="px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5"
                    style={vueResultats === "jour" ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary, color: "white" } : { borderColor: COLORS.border }}
                  >
                    <ChefHat className="w-3.5 h-3.5" /> Jour par jour
                  </button>
                  <button
                    onClick={() => setVueResultats("courses")}
                    className="px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5"
                    style={vueResultats === "courses" ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary, color: "white" } : { borderColor: COLORS.border }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Liste de courses {totalArticles > 0 ? `(${totalArticles})` : ""}
                  </button>
                </div>

                {vueResultats === "jour" && (
                  <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {JOURS.map((j) => (
                        <button
                          key={j.key}
                          onClick={() => setJourActifResultats(j.key)}
                          className="shrink-0 px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5"
                          style={
                            jourActifResultats === j.key
                              ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary, color: "white" }
                              : { borderColor: COLORS.border }
                          }
                        >
                          {j.label}
                          <StatutPoint statut={statutJour[j.key]} />
                        </button>
                      ))}
                    </div>

                    <JourResultat
                      jourKey={jourActifResultats}
                      jourLabel={JOURS.find((j) => j.key === jourActifResultats).label}
                      statut={statutJour[jourActifResultats]}
                      erreur={erreurJour[jourActifResultats]}
                      resultat={resultats[jourActifResultats]}
                      onRegenerer={() => genererJour(jourActifResultats)}
                    />
                  </div>
                )}

                {vueResultats === "courses" && (
                  <ListeCourses listeCourses={listeCourses} coches={coches} onToggle={toggleCoche} />
                )}
              </>
            )}
          </div>
        )}

        {/* Pied de page */}
        <div className="mt-10 pt-4 border-t text-xs flex items-start gap-2" style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}>
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>Les menus, activités et indications de poids sont générés à titre indicatif et ne remplacent pas l'avis d'un professionnel de santé. Les données saisies restent liées à votre compte.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sous-composants                                                   */
/* ---------------------------------------------------------------- */

function TabButton({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border transition-colors"
      style={
        active
          ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary, color: "white" }
          : { borderColor: COLORS.border, color: COLORS.ink, backgroundColor: COLORS.card }
      }
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function StatutPoint({ statut }) {
  if (statut === "done") return <Check className="w-3 h-3" style={{ color: COLORS.primary }} />;
  if (statut === "loading") return <Loader2 className="w-3 h-3 animate-spin" style={{ color: COLORS.gold }} />;
  if (statut === "error") return <AlertCircle className="w-3 h-3" style={{ color: COLORS.alert }} />;
  return null;
}

function MembreCard({ membre, onChange, onDelete }) {
  const imc = calcIMC(membre.taille_cm, membre.poids_kg);
  return (
    <div className="rounded-xl border p-4 space-y-2.5" style={{ borderColor: COLORS.border, backgroundColor: COLORS.card }}>
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={membre.nom}
          onChange={(e) => onChange(membre.id, "nom", e.target.value)}
          placeholder="Prénom"
          className="font-serif text-lg font-medium bg-transparent outline-none w-full"
          style={{ color: COLORS.primaryDark }}
        />
        <button onClick={onDelete} className="shrink-0 p-1.5 rounded-full hover:opacity-70" style={{ color: COLORS.alert }}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ChampMini label="Taille (cm)" value={membre.taille_cm} onChange={(v) => onChange(membre.id, "taille_cm", v)} type="number" />
        <ChampMini label="Poids (kg)" value={membre.poids_kg} onChange={(v) => onChange(membre.id, "poids_kg", v)} type="number" />
      </div>
      {imc && (
        <p className="text-xs px-2 py-1 rounded-full inline-block" style={{ backgroundColor: COLORS.goldSoft, color: COLORS.gold }}>
          IMC {imc.valeur} — {imc.categorie} (indicatif)
        </p>
      )}

      <ChampTexte label="Contraintes médicales / traitements" value={membre.contraintes} onChange={(v) => onChange(membre.id, "contraintes", v)} placeholder="Ex : sans sel, diabète type 2, genou fragile…" />
      <ChampTexte label="Aime particulièrement" value={membre.aime} onChange={(v) => onChange(membre.id, "aime", v)} placeholder="Ex : pâtes, poisson, randonnée…" />
      <ChampTexte label="N'aime pas / à éviter" value={membre.naimePas} onChange={(v) => onChange(membre.id, "naimePas", v)} placeholder="Ex : champignons, sport en salle…" />
    </div>
  );
}

function ChampMini({ label, value, onChange, type }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: COLORS.inkSoft }}>{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-2 py-1.5 text-sm"
        style={{ borderColor: COLORS.border }}
      />
    </div>
  );
}

function ChampTexte({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: COLORS.inkSoft }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full border rounded-lg px-2 py-1.5 text-sm resize-none"
        style={{ borderColor: COLORS.border }}
      />
    </div>
  );
}

function JourSemaine({ jourKey, famille, meteo, onMeteo, estPresent, togglePresence }) {
  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.card }}>
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1.5" style={{ color: COLORS.inkSoft }}>Météo prévue ce jour</label>
        <div className="flex flex-wrap gap-1.5">
          {METEOS.map((mt) => (
            <button
              key={mt.key}
              onClick={() => onMeteo(mt.key)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border"
              style={
                meteo === mt.key
                  ? { backgroundColor: COLORS.gold, borderColor: COLORS.gold, color: "white" }
                  : { borderColor: COLORS.border, color: COLORS.ink }
              }
            >
              <mt.Icon className="w-3.5 h-3.5" /> {mt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-xs uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Qui est présent à chaque repas ?</label>
        {REPAS.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-2">
            <span className="text-sm w-28 shrink-0" style={{ color: COLORS.ink }}>{r.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {famille.map((m) => {
                const present = estPresent(jourKey, r.key, m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => togglePresence(jourKey, r.key, m.id)}
                    className="px-2.5 py-1 rounded-full text-xs border inline-flex items-center gap-1"
                    style={
                      present
                        ? { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary, color: COLORS.primaryDark }
                        : { borderColor: COLORS.border, color: COLORS.inkSoft, opacity: 0.6 }
                    }
                  >
                    {present ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {m.nom || "Sans nom"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourResultat({ jourKey, jourLabel, statut, erreur, resultat, onRegenerer }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.card }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg" style={{ color: COLORS.primaryDark }}>{jourLabel}</h3>
        <button
          onClick={onRegenerer}
          disabled={statut === "loading"}
          className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full border disabled:opacity-50"
          style={{ borderColor: COLORS.border, color: COLORS.inkSoft }}
        >
          {statut === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Régénérer ce jour
        </button>
      </div>

      {statut === "loading" && !resultat && (
        <div className="flex items-center gap-2 text-sm py-6 justify-center" style={{ color: COLORS.inkSoft }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…
        </div>
      )}

      {statut === "error" && (
        <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ backgroundColor: COLORS.alertSoft, color: COLORS.alert }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erreur || "La génération a échoué."} Cliquez sur « Régénérer ce jour » pour réessayer.</span>
        </div>
      )}

      {resultat && resultat.repas && (
        <div className="space-y-3">
          {REPAS.map((r) => {
            const repas = resultat.repas[r.key];
            return (
              <div key={r.key} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: COLORS.border }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: COLORS.gold }}>{r.label}</p>
                {!repas && <p className="text-sm italic" style={{ color: COLORS.inkSoft }}>Personne présent à ce repas.</p>}
                {repas && (
                  <div>
                    <p className="font-medium text-sm">{repas.titre}</p>
                    {repas.description && <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{repas.description}</p>}
                    {Array.isArray(repas.ingredients) && repas.ingredients.length > 0 && (
                      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>
                        {repas.ingredients.map((ing) => ing.nom).filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="border-t pt-3" style={{ borderColor: COLORS.border }}>
            <p className="text-xs uppercase tracking-wide mb-1.5 inline-flex items-center gap-1" style={{ color: COLORS.primary }}>
              <Dumbbell className="w-3.5 h-3.5" /> Activité physique
            </p>
            {(!resultat.activites || resultat.activites.length === 0) && (
              <p className="text-sm italic" style={{ color: COLORS.inkSoft }}>Personne présent ce jour.</p>
            )}
            {Array.isArray(resultat.activites) && resultat.activites.length > 0 && (
              <div className="space-y-1.5">
                {resultat.activites.map((a, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{a.personne}</span>
                    {" — "}{a.activite}{a.duree ? ` (${a.duree})` : ""}
                    {a.notes && <span style={{ color: COLORS.inkSoft }}> · {a.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListeCourses({ listeCourses, coches, onToggle }) {
  const categoriesAvecArticles = CATEGORIES.filter((c) => listeCourses[c] && listeCourses[c].length > 0);
  if (categoriesAvecArticles.length === 0) {
    return <p className="text-sm" style={{ color: COLORS.inkSoft }}>La liste de courses se remplit au fur et à mesure que les jours sont générés.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {categoriesAvecArticles.map((cat) => (
        <div key={cat} className="rounded-xl border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.card }}>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: COLORS.gold }}>{cat}</p>
          <div className="space-y-1.5">
            {listeCourses[cat].map((article) => (
              <button
                key={article}
                onClick={() => onToggle(article)}
                className="flex items-center gap-2 text-sm w-full text-left"
                style={{ color: coches[article] ? COLORS.inkSoft : COLORS.ink, textDecoration: coches[article] ? "line-through" : "none" }}
              >
                <span
                  className="w-4 h-4 rounded border shrink-0 inline-flex items-center justify-center"
                  style={{ borderColor: COLORS.primary, backgroundColor: coches[article] ? COLORS.primary : "transparent" }}
                >
                  {coches[article] && <Check className="w-3 h-3 text-white" />}
                </span>
                {article}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
