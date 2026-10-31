// Liste des formations disponibles
export const FORMATIONS = {
  LUS: [
    'Génie Informatique',
    'Génie Électrique',
    'Génie Mécanique',
    'Génie Civil',
    'Sciences Économiques et Gestion',
    'Mathématiques et Informatique',
    'Sciences de la Vie',
    'Physique-Chimie',
    'Droit',
    'Langues Étrangères Appliquées'
  ],
  MUS: [
    'Master Génie Logiciel',
    'Master Intelligence Artificielle',
    'Master Systèmes Embarqués',
    'Master Finance et Comptabilité',
    'Master Management des Organisations',
    'Master Sciences des Données',
    'Master Énergies Renouvelables',
    'Master Droit des Affaires'
  ]
};

// Liste des professeurs responsables
export const PROFESSEURS = [
  'Pr. Mohamed Benali',
  'Pr. Fatima Zahra Elhaddadi',
  'Pr. Ahmed Taoufik',
  'Pr. Khadija Mouline',
  'Pr. Youssef Berrada',
  'Pr. Laila Amrani',
  'Pr. Hassan El Moussaoui',
  'Pr. Nadia Benmoussa',
  'Pr. Rachid Ouahbi',
  'Pr. Samira El Idrissi'
];

// Années universitaires
export const getAnneeUniversitaires = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  
  for (let i = -3; i <= 1; i++) {
    const startYear = currentYear + i;
    years.push(`${startYear}-${startYear + 1}`);
  }
  
  return years.reverse();
};
