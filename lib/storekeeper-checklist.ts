import {
  addChecklistItem,
  countChecklistProgress,
  deleteChecklistGroup,
  deleteChecklistItem,
  deleteChecklistSection,
  toggleChecklistItem,
  type ChecklistGroup,
  type ChecklistItem,
  type ChecklistSection,
  type ChecklistState,
} from "./reconditioning-checklist";

export type {
  ChecklistGroup,
  ChecklistItem,
  ChecklistSection,
  ChecklistState,
};

export {
  addChecklistItem,
  countChecklistProgress,
  deleteChecklistGroup,
  deleteChecklistItem,
  deleteChecklistSection,
  toggleChecklistItem,
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

export function createDefaultStorekeeperChecklist(): ChecklistState {
  return {
    sections: [
      section("s0", "Réception du dossier atelier", [
        group("s0", "Dossier reçu", [
          "Check-list mécanicien complète reçue",
          "Photos du véhicule reçues",
          "Photos des défauts reçues",
          "Diagnostic électronique reçu",
          "Essai routier reçu",
          "Devis estimatif reçu",
        ]),
      ]),
      section("s1", "1. ANALYSE DES PIÈCES MÉCANIQUES À COMMANDER", [
        group("s1", "Moteur", [
          "Huile moteur",
          "Filtre à huile",
          "Filtre à air",
          "Bougie(s)",
          "Joint(s)",
          "Batterie",
          "Autres pièces moteur",
        ]),
        group("s1", "Moteur — Validation", [
          "Pièces identifiées",
          "Disponibilité vérifiée",
          "Référence validée",
        ]),
        group("s1", "Freinage", [
          "Plaquettes avant",
          "Plaquettes arrière",
          "Disque avant",
          "Disque arrière",
          "Liquide frein",
          "Durite",
          "Kit réparation étrier",
        ]),
        group("s1", "Freinage — Validation", ["Références validées"]),
        group("s1", "Transmission — Moto", [
          "Kit chaîne",
          "Couronne",
          "Pignon",
          "Attache rapide",
        ]),
        group("s1", "Transmission — Scooter", [
          "Courroie",
          "Galets",
          "Guides variateur",
          "Embrayage",
          "Cloche",
        ]),
        group("s1", "Roues", [
          "Pneu avant",
          "Pneu arrière",
          "Valve",
          "Roulement avant",
          "Roulement arrière",
        ]),
        group("s1", "Suspension", [
          "Joint spi fourche",
          "Cache poussière",
          "Huile fourche",
          "Amortisseur arrière",
        ]),
      ]),
      section("s2", "2. ANALYSE DES PIÈCES ESTHÉTIQUES", [
        group("s2", "Face avant — État relevé", [
          "Rayure",
          "Fissure",
          "Cassure",
          "Patte cassée",
          "Déformation",
        ]),
        group("s2", "Face avant — Décision magasinier", [
          "🟢 Réutilisation",
          "🟠 Réparation — Ponçage",
          "🟠 Réparation — Soudure plastique",
          "🟠 Réparation — Réfection peinture",
          "🟠 Réparation — Réfection fixation",
          "🔴 Remplacement",
        ]),
        group("s2", "Face avant — Justification", [
          "Réparation économiquement viable",
          "Réparation non viable",
        ]),
        group("s2", "Critères — Réparable (🟠)", [
          "Rayure profonde",
          "Vernis abîmé",
          "Patte de fixation cassée",
          "Plastique fissuré localement",
          "Défaut peinture",
          "Petit enfoncement",
        ]),
        group("s2", "Critères — Remplacement (🔴)", [
          "Cassé en plusieurs morceaux",
          "Déformation importante",
          "Plusieurs fixations arrachées",
          "Réparation ancienne défectueuse",
          "Temps réparation excessif",
        ]),
      ]),
      section("s3", "3. CALCUL ÉCONOMIQUE RÉPARER / REMPLACER", [
        group("s3", "Coût réparation", [
          "Main d'œuvre renseignée",
          "Matière renseignée",
          "Peinture renseignée",
          "Total réparation calculé",
        ]),
        group("s3", "Coût remplacement", [
          "Pièce renseignée",
          "Peinture renseignée",
          "Total remplacement calculé",
        ]),
        group("s3", "Décision économique", [
          "Décision : réparation",
          "Décision : remplacement",
          "Réparer si coût ≤ 50 % du remplacement",
          "Soumettre à validation si 50 % – 80 %",
          "Remplacer si > 80 %",
        ]),
      ]),
      section("s4", "4. OPTIONS ET ÉQUIPEMENTS SIGNALÉS PAR LE MÉCANICIEN", [
        group("s4", "État des options", [
          "Option fonctionnelle",
          "Option défectueuse",
        ]),
        group("s4", "Si option défectueuse — recherche", [
          "Recherche pièce nécessaire",
          "Recherche faisceau",
          "Recherche capteur",
          "Recherche actionneur",
          "Recherche module électronique",
        ]),
      ]),
      section("s5", "5. PIÈCES DE FINITION", [
        group("s5", "Finition", [
          "Rétroviseur",
          "Poignée",
          "Embout guidon",
          "Levier",
          "Repose-pied",
          "Bulle",
          "Selle",
          "Cache plastique",
          "Autocollants",
          "Logos",
          "Visserie visible",
          "Clips",
          "Agrafes",
        ]),
      ]),
      section("s6", "6. CONSOMMABLES À PRÉPARER POUR L'ATELIER", [
        group("s6", "Consommables", [
          "Huile moteur",
          "Huile transmission",
          "Liquide refroidissement",
          "Liquide frein",
          "Graisse chaîne",
          "Graisse roulements",
          "Nettoyant frein",
          "Nettoyant injection",
          "Frein filet",
          "Joints",
        ]),
      ]),
      section("s7", "7. VALIDATION MAGASINIER", [
        group("s7", "Actions par anomalie", [
          "Toutes les anomalies ont une action associée",
          "Réparer",
          "Remplacer",
          "Contrôler de nouveau",
        ]),
        group("s7", "Validation finale dossier", [
          "Toutes les pièces identifiées",
          "Toutes les références validées",
          "Toutes les pièces disponibles ou commandées",
          "Tous les consommables préparés",
          "Dossier prêt pour lancement atelier",
        ]),
      ]),
      section("s8", "Contrôle final anti-oubli", [
        group("s8", "Questions obligatoires (répondre OUI)", [
          "Chaque défaut signalé possède-t-il une solution ?",
          "Chaque solution possède-t-elle une pièce ou opération associée ?",
          "Toutes les pièces sont-elles en stock ou commandées ?",
          "Le technicien pourra-t-il terminer sans attendre une pièce supplémentaire ?",
        ]),
      ]),
    ],
  };
}

export function parseStorekeeperChecklistState(raw: unknown): ChecklistState {
  if (
    raw &&
    typeof raw === "object" &&
    "sections" in raw &&
    Array.isArray((raw as ChecklistState).sections)
  ) {
    return raw as ChecklistState;
  }
  return createDefaultStorekeeperChecklist();
}

/** Fallback if reconditioning default is needed elsewhere */
export { createDefaultChecklist } from "./reconditioning-checklist";
