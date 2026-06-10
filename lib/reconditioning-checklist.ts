export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type ChecklistGroup = {
  id: string;
  title: string;
  items: ChecklistItem[];
};

export type ChecklistSection = {
  id: string;
  title: string;
  groups: ChecklistGroup[];
};

export type ChecklistState = {
  sections: ChecklistSection[];
};

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function item(sectionId: string, groupId: string, label: string): ChecklistItem {
  return {
    id: `${sectionId}--${groupId}--${slug(label)}`,
    label,
    checked: false,
  };
}

function group(sectionId: string, title: string, labels: string[]): ChecklistGroup {
  const gid = slug(title);
  return {
    id: gid,
    title,
    items: labels.map((l) => item(sectionId, gid, l)),
  };
}

function section(id: string, title: string, groups: ChecklistGroup[]): ChecklistSection {
  return { id, title, groups };
}

export function createDefaultChecklist(): ChecklistState {
  return {
    sections: [
      section("s1", "1. CONTRÔLE INITIAL", [
        group("s1", "Inspection générale", [
          "État général du véhicule",
          "Recherche de traces de chute",
          "Recherche de déformation cadre",
          "Recherche de déformation bras oscillant",
          "Contrôle alignement roue AV / AR",
          "Contrôle alignement guidon",
          "Contrôle fixations générales",
          "Contrôle visserie manquante",
        ]),
      ]),
      section("s2", "2. MOTEUR", [
        group("s2", "Fonctionnement", [
          "Démarrage à froid",
          "Démarrage à chaud",
          "Ralenti stable",
          "Montée en régime fluide",
          "Absence de trous à l'accélération",
          "Absence de cognement moteur",
          "Absence de claquement distribution",
          "Absence de bruit de bielle",
          "Absence de bruit anormal",
        ]),
        group("s2", "Étanchéité", [
          "Carter moteur",
          "Couvre-culasse",
          "Joints spi moteur",
          "Pompe à eau",
          "Circuit refroidissement",
          "Circuit carburant",
        ]),
        group("s2", "Entretien préventif", [
          "Vidange moteur",
          "Remplacement filtre à huile",
          "Contrôle crépine",
          "Remplacement bougie(s)",
          "Contrôle compression moteur",
        ]),
      ]),
      section("s3", "3. ADMISSION / INJECTION", [
        group("s3", "Admission", [
          "Boîte à air propre",
          "Filtre à air remplacé ou nettoyé",
          "Durites admission en bon état",
          "Absence de prise d'air",
        ]),
        group("s3", "Injection", [
          "Contrôle pompe à carburant",
          "Contrôle injecteur(s)",
          "Nettoyage injecteur(s)",
          "Contrôle pression carburant",
          "Contrôle capteurs moteur",
        ]),
        group("s3", "Carburation (anciens modèles)", [
          "Nettoyage carburateur",
          "Contrôle gicleurs",
          "Contrôle membranes",
          "Réglage richesse",
          "Synchronisation carburateurs",
        ]),
      ]),
      section("s4", "4. REFROIDISSEMENT", [
        group("s4", "Refroidissement", [
          "Contrôle radiateur",
          "Contrôle ailettes radiateur",
          "Contrôle ventilateur",
          "Contrôle sonde température",
          "Contrôle thermostat",
          "Contrôle durites",
          "Contrôle colliers",
          "Remplacement liquide refroidissement",
          "Contrôle étanchéité complète",
        ]),
      ]),
      section("s5", "5. TRANSMISSION", [
        group("s5", "Moto — Kit chaîne", [
          "Contrôle usure chaîne",
          "Contrôle tension chaîne",
          "Contrôle points durs",
          "Contrôle couronne",
          "Contrôle pignon sortie de boîte",
          "Nettoyage chaîne",
          "Lubrification chaîne",
        ]),
        group("s5", "Moto — Boîte de vitesses", [
          "Passage de tous les rapports",
          "Absence de saut de vitesse",
          "Contrôle sélecteur",
        ]),
        group("s5", "Moto — Embrayage", [
          "Contrôle garde",
          "Contrôle câble ou hydraulique",
          "Contrôle patinage",
          "Contrôle disques si nécessaire",
        ]),
        group("s5", "Scooter — Variateur", [
          "Contrôle galets",
          "Contrôle guides",
          "Contrôle rampes",
        ]),
        group("s5", "Scooter — Courroie", [
          "Contrôle largeur",
          "Contrôle usure",
          "Contrôle fissures",
        ]),
        group("s5", "Scooter — Embrayage centrifuge", [
          "Contrôle garnitures",
          "Contrôle ressorts",
          "Contrôle cloche",
        ]),
        group("s5", "Scooter — Transmission finale", [
          "Contrôle huile de transmission",
          "Vidange transmission",
        ]),
      ]),
      section("s6", "6. FREINAGE", [
        group("s6", "Avant", [
          "Contrôle disque(s)",
          "Mesure épaisseur disque",
          "Contrôle voile disque",
          "Contrôle plaquettes",
          "Contrôle étriers",
          "Contrôle pistons",
          "Contrôle durites",
          "Purge liquide frein",
        ]),
        group("s6", "Arrière", [
          "Contrôle disque ou tambour",
          "Contrôle plaquettes ou mâchoires",
          "Contrôle étrier",
          "Contrôle durites",
          "Purge liquide frein",
        ]),
        group("s6", "ABS", [
          "Contrôle capteurs ABS",
          "Contrôle couronnes ABS",
          "Essai fonctionnement ABS",
        ]),
      ]),
      section("s7", "7. ROUES", [
        group("s7", "Pneus", [
          "Contrôle usure",
          "Contrôle date DOT",
          "Contrôle pression",
          "Contrôle déformation",
          "Contrôle coupures",
          "Contrôle réparation ancienne",
        ]),
        group("s7", "Jantes", [
          "Contrôle voile",
          "Contrôle fissures",
          "Contrôle impacts",
          "Contrôle corrosion",
        ]),
        group("s7", "Roulements", [
          "Roulements roue avant",
          "Roulements roue arrière",
        ]),
      ]),
      section("s8", "8. SUSPENSIONS", [
        group("s8", "Fourche", [
          "Contrôle tubes",
          "Contrôle rayures",
          "Contrôle fuite joints spi",
          "Contrôle cache-poussière",
          "Contrôle bagues",
          "Remplacement huile fourche si nécessaire",
        ]),
        group("s8", "Amortisseur arrière", [
          "Contrôle fuite",
          "Contrôle détente",
          "Contrôle compression",
          "Contrôle silentblocs",
          "Contrôle réglages",
        ]),
      ]),
      section("s9", "9. DIRECTION", [
        group("s9", "Direction", [
          "Contrôle jeu colonne direction",
          "Contrôle roulements direction",
          "Contrôle point dur",
          "Contrôle butées direction",
        ]),
      ]),
      section("s10", "10. PARTIE CYCLE", [
        group("s10", "Cadre", [
          "Contrôle fissures",
          "Contrôle corrosion",
          "Contrôle déformation",
        ]),
        group("s10", "Bras oscillant", [
          "Contrôle jeu",
          "Contrôle roulements",
          "Contrôle axe",
        ]),
        group("s10", "Béquilles", [
          "Contrôle latérale",
          "Contrôle centrale",
          "Contrôle ressorts",
          "Contrôle contacteur sécurité",
        ]),
      ]),
      section("s11", "11. ÉLECTRICITÉ", [
        group("s11", "Batterie", [
          "Test tension repos",
          "Test démarrage",
          "Test charge",
        ]),
        group("s11", "Charge", [
          "Contrôle alternateur",
          "Contrôle régulateur",
        ]),
        group("s11", "Faisceau", [
          "Contrôle connecteurs",
          "Contrôle oxydation",
          "Contrôle réparations anciennes",
        ]),
      ]),
      section("s12", "12. ÉCLAIRAGE", [
        group("s12", "Éclairage", [
          "Feu de croisement",
          "Feu de route",
          "Veilleuse",
          "Feu arrière",
          "Feu stop",
          "Clignotants avant",
          "Clignotants arrière",
          "Éclairage plaque",
          "Klaxon",
        ]),
      ]),
      section("s13", "13. COMMANDES", [
        group("s13", "Commandes", [
          "Poignée accélérateur",
          "Retour accélérateur",
          "Levier frein avant",
          "Levier embrayage",
          "Sélecteur vitesse",
          "Pédale frein arrière",
          "Commodo gauche",
          "Commodo droit",
        ]),
      ]),
      section("s14", "14. ÉCHAPPEMENT", [
        group("s14", "Échappement", [
          "Contrôle collecteur",
          "Contrôle silencieux",
          "Contrôle fixation",
          "Contrôle corrosion",
          "Contrôle fuite échappement",
        ]),
      ]),
      section("s15", "15. ESTHÉTIQUE", [
        group("s15", "Carénages", [
          "Contrôle rayures",
          "Contrôle fissures",
          "Contrôle pattes de fixation",
          "Contrôle clips et agrafes",
          "Réparation ou remplacement si nécessaire",
        ]),
        group("s15", "Peinture", [
          "Contrôle impacts",
          "Contrôle vernis",
          "Contrôle différence de teinte",
          "Polissage si nécessaire",
        ]),
        group("s15", "Réservoir", [
          "Contrôle bosses",
          "Contrôle rayures",
          "Contrôle corrosion interne",
        ]),
        group("s15", "Selle", [
          "Contrôle déchirures",
          "Contrôle couture",
          "Contrôle fixation",
        ]),
        group("s15", "Rétroviseurs", [
          "Contrôle état",
          "Contrôle réglage",
        ]),
        group("s15", "Poignées", [
          "Contrôle usure",
          "Contrôle déchirure",
        ]),
        group("s15", "Repose-pieds", [
          "Contrôle usure",
          "Contrôle caoutchouc",
        ]),
      ]),
      section("s16", "16. FINITION PREMIUM", [
        group("s16", "Finition premium", [
          "Nettoyage moteur",
          "Nettoyage jantes",
          "Nettoyage transmission",
          "Décontamination peinture",
          "Polissage peinture",
          "Traitement plastiques",
          "Traitement métaux",
          "Lubrification serrures",
          "Remplacement visserie oxydée visible",
          "Remplacement éléments cosmétiques dégradés",
          "Véhicule sans rayure majeure visible à 1 mètre",
          "Véhicule sans voyant défaut",
          "Essai routier final validé",
        ]),
      ]),
      section("s17", "Points souvent oubliés (SAV)", [
        group("s17", "Points critiques SAV", [
          "Roulements de direction",
          "Roulements de bras oscillant",
          "Silentblocs moteur",
          "Durites de carburant craquelées",
          "Capuchons de valve manquants",
          "Contacteur de béquille",
          "Contacteur de frein avant/arrière",
          "Supports de carénage cassés",
          "Clips et agrafes manquants",
          "Éclairage de plaque",
          "Graissage axes de leviers",
          "Graissage béquilles",
          "Test batterie sous charge réelle",
          "Contrôle du faisceau sous les carénages",
          "Contrôle de toutes les vis de sécurité au couple constructeur",
        ]),
      ]),
      section("s18", "17. DIAGNOSTIC ÉLECTRONIQUE ET VOYANTS", [
        group("s18", "Lecture des défauts", [
          "Passage à la valise diagnostic",
          "Lecture de tous les codes défauts présents",
          "Analyse des défauts actifs",
          "Analyse des défauts historiques",
        ]),
        group("s18", "Réparation", [
          "Réparation de la cause racine des défauts détectés",
          "Contrôle des capteurs concernés",
          "Contrôle du faisceau concerné",
          "Contrôle des connecteurs concernés",
        ]),
        group("s18", "Validation", [
          "Effacement des codes défauts",
          "Redémarrage du véhicule",
          "Contrôle après cycle moteur complet",
          "Contrôle après essai routier",
        ]),
        group("s18", "Voyants tableau de bord", [
          "Voyant moteur éteint",
          "Voyant ABS éteint",
          "Voyant batterie éteint",
          "Voyant pression d'huile éteint",
          "Voyant température éteint",
          "Aucun voyant d'alerte actif",
        ]),
        group("s18", "Important", [
          "Aucun voyant masqué, neutralisé ou effacé sans réparation effective",
        ]),
      ]),
      section("s19", "18. TEST DE TOUTES LES OPTIONS ET ÉQUIPEMENTS", [
        group("s19", "Tableau de bord", [
          "Écran LCD/TFT fonctionnel",
          "Affichage kilométrage",
          "Affichage vitesse",
          "Affichage régime moteur",
          "Affichage température moteur",
          "Affichage jauge carburant",
          "Réglage luminosité",
        ]),
        group("s19", "Commandes au guidon", [
          "Tous les boutons fonctionnent",
          "Navigation menus fonctionnelle",
          "Retour automatique des commandes",
        ]),
        group("s19", "Éclairage options", [
          "Appel de phare",
          "Feux de route",
          "Feux de croisement",
          "Feux de jour (DRL)",
          "Feux antibrouillard (si équipés)",
        ]),
        group("s19", "Électronique embarquée", [
          "ABS fonctionnel",
          "Antipatinage (TCS) fonctionnel",
          "Modes de conduite fonctionnels",
          "Régulateur de vitesse fonctionnel",
          "Quickshifter fonctionnel",
          "Shifter descente fonctionnel",
          "Suspensions électroniques fonctionnelles",
          "Contrôle pression pneus (TPMS) fonctionnel",
        ]),
        group("s19", "Confort", [
          "Poignées chauffantes",
          "Selle chauffante",
          "Pare-brise électrique",
          "Prise USB fonctionnelle",
          "Prise 12V fonctionnelle",
        ]),
        group("s19", "Connectivité", [
          "Bluetooth fonctionnel",
          "Connexion smartphone fonctionnelle",
          "Navigation intégrée fonctionnelle",
          "Commandes vocales fonctionnelles",
        ]),
        group("s19", "Sécurité", [
          "Antidémarrage électronique fonctionnel",
          "Alarme fonctionnelle",
          "Keyless fonctionnel",
          "Détection de clé correcte",
        ]),
        group("s19", "Scooter", [
          "Ouverture selle électrique",
          "Éclairage coffre",
          "Frein de parking",
          "Smart Key fonctionnelle",
        ]),
      ]),
      section("s20", "19. ESSAI ROUTIER DE VALIDATION FINALE", [
        group("s20", "Essai routier", [
          "Démarrage à froid validé",
          "Montée en température validée",
          "Aucune vibration anormale",
          "Aucune dérive de trajectoire",
          "Freinage validé",
          "Accélération validée",
          "Boîte de vitesses validée",
          "Toutes les options testées en roulant",
          "Aucun voyant après essai routier",
          "Nouveau scan diagnostic après essai",
        ]),
      ]),
      section("s21", "CRITÈRES DE SORTIE ATELIER", [
        group("s21", "Critères de sortie", [
          "Aucun défaut mécanique critique",
          "Aucun défaut de sécurité",
          "Aucun voyant moteur ou défaut actif",
          "Aucune fuite",
          "Toutes les options fonctionnent à 100 %",
          "Tous les équipements d'origine sont opérationnels",
          "Esthétique conforme au standard défini",
          "Essai routier validé",
          "Diagnostic final sans défaut actif",
          "Contrôle qualité final validé",
        ]),
      ]),
    ],
  };
}

export function parseChecklistState(raw: unknown): ChecklistState {
  if (
    raw &&
    typeof raw === "object" &&
    "sections" in raw &&
    Array.isArray((raw as ChecklistState).sections)
  ) {
    return raw as ChecklistState;
  }
  return createDefaultChecklist();
}

export function countChecklistProgress(state: ChecklistState): {
  checked: number;
  total: number;
} {
  let checked = 0;
  let total = 0;
  for (const sec of state.sections) {
    for (const grp of sec.groups) {
      for (const it of grp.items) {
        total += 1;
        if (it.checked) checked += 1;
      }
    }
  }
  return { checked, total };
}

export function toggleChecklistItem(
  state: ChecklistState,
  sectionId: string,
  groupId: string,
  itemId: string,
  checked: boolean
): ChecklistState {
  return {
    sections: state.sections.map((sec) =>
      sec.id !== sectionId
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp) =>
              grp.id !== groupId
                ? grp
                : {
                    ...grp,
                    items: grp.items.map((it) =>
                      it.id === itemId ? { ...it, checked } : it
                    ),
                  }
            ),
          }
    ),
  };
}

export function addChecklistItem(
  state: ChecklistState,
  sectionId: string,
  groupId: string,
  label: string
): ChecklistState {
  const trimmed = label.trim();
  if (!trimmed) return state;
  const newItem: ChecklistItem = {
    id: `custom-${crypto.randomUUID()}`,
    label: trimmed,
    checked: false,
  };
  return {
    sections: state.sections.map((sec) =>
      sec.id !== sectionId
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp) =>
              grp.id !== groupId
                ? grp
                : { ...grp, items: [...grp.items, newItem] }
            ),
          }
    ),
  };
}

export function deleteChecklistItem(
  state: ChecklistState,
  sectionId: string,
  groupId: string,
  itemId: string
): ChecklistState {
  return {
    sections: state.sections.map((sec) =>
      sec.id !== sectionId
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp) =>
              grp.id !== groupId
                ? grp
                : { ...grp, items: grp.items.filter((it) => it.id !== itemId) }
            ),
          }
    ),
  };
}
