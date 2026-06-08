// apps/mobile/data/medications.ts

export interface MedicationEntry {
  dci: string
  commercial: string[]
  category: string
  defaultDosages: string[]
  defaultFrequencies: string[]
}

export const MEDICATIONS_DB: MedicationEntry[] = [
  // Analgésiques / Antipyrétiques
  { dci: 'Paracétamol', commercial: ['Doliprane', 'Efferalgan', 'Dafalgan', 'Perfalgan'], category: 'Analgésique', defaultDosages: ['500mg', '1000mg'], defaultFrequencies: ['3×/jour', '4×/jour'] },
  { dci: 'Ibuprofène', commercial: ['Advil', 'Nurofen', 'Brufen'], category: 'AINS', defaultDosages: ['200mg', '400mg', '600mg'], defaultFrequencies: ['3×/jour'] },
  { dci: 'Aspirine', commercial: ['Aspegic', 'Aspro'], category: 'Analgésique/Antiagrégant', defaultDosages: ['100mg', '500mg', '1g'], defaultFrequencies: ['1×/jour', '3×/jour'] },
  { dci: 'Diclofénac', commercial: ['Voltarène', 'Diclofénac'], category: 'AINS', defaultDosages: ['25mg', '50mg', '75mg'], defaultFrequencies: ['2×/jour', '3×/jour'] },
  { dci: 'Kétoprofène', commercial: ['Profénid', 'Bi-Profénid'], category: 'AINS', defaultDosages: ['100mg', '200mg'], defaultFrequencies: ['2×/jour'] },

  // Antibiotiques
  { dci: 'Amoxicilline', commercial: ['Amoxil', 'Clamoxyl', 'Flemoxine'], category: 'Antibiotique', defaultDosages: ['250mg', '500mg', '1g'], defaultFrequencies: ['3×/jour'] },
  { dci: 'Amoxicilline-Acide clavulanique', commercial: ['Augmentin', 'Amoxiclav'], category: 'Antibiotique', defaultDosages: ['500mg/125mg', '875mg/125mg'], defaultFrequencies: ['2×/jour', '3×/jour'] },
  { dci: 'Azithromycine', commercial: ['Zithromax', 'Azadose'], category: 'Antibiotique', defaultDosages: ['250mg', '500mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Ciprofloxacine', commercial: ['Ciflox', 'Cipro'], category: 'Antibiotique', defaultDosages: ['250mg', '500mg', '750mg'], defaultFrequencies: ['2×/jour'] },
  { dci: 'Métronidazole', commercial: ['Flagyl', 'Métronidazole'], category: 'Antiparasitaire/Antibiotique', defaultDosages: ['250mg', '500mg'], defaultFrequencies: ['3×/jour'] },
  { dci: 'Cotrimoxazole', commercial: ['Bactrim', 'Sulfamide'], category: 'Antibiotique', defaultDosages: ['480mg', '960mg'], defaultFrequencies: ['2×/jour'] },
  { dci: 'Doxycycline', commercial: ['Vibramycine', 'Tolexine'], category: 'Antibiotique', defaultDosages: ['100mg'], defaultFrequencies: ['1×/jour', '2×/jour'] },
  { dci: 'Érythromycine', commercial: ['Erythrocine', 'Ery-Tab'], category: 'Antibiotique', defaultDosages: ['250mg', '500mg'], defaultFrequencies: ['4×/jour'] },
  { dci: 'Ceftriaxone', commercial: ['Rocéphine', 'Ceftriaxone'], category: 'Antibiotique', defaultDosages: ['1g', '2g'], defaultFrequencies: ['1×/jour'] },

  // Antipaludéens
  { dci: 'Artemether-Luméfantrine', commercial: ['Coartem', 'Riamet'], category: 'Antipaludéen', defaultDosages: ['20/120mg'], defaultFrequencies: ['2×/jour pendant 3 jours'] },
  { dci: 'Artésunate', commercial: ['Artesiane', 'Arsumax'], category: 'Antipaludéen', defaultDosages: ['50mg', '100mg', '200mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Chloroquine', commercial: ['Nivaquine', 'Aralen'], category: 'Antipaludéen', defaultDosages: ['100mg', '250mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Méfloquine', commercial: ['Lariam'], category: 'Antipaludéen', defaultDosages: ['250mg'], defaultFrequencies: ['1×/semaine'] },

  // Cardiovasculaires
  { dci: 'Amlodipine', commercial: ['Amlor', 'Norvasc'], category: 'Antihypertenseur', defaultDosages: ['5mg', '10mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Losartan', commercial: ['Cozaar', 'Hyzaar'], category: 'Antihypertenseur', defaultDosages: ['25mg', '50mg', '100mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Ramipril', commercial: ['Triatec', 'Altace'], category: 'IEC', defaultDosages: ['2.5mg', '5mg', '10mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Bisoprolol', commercial: ['Cardensiel', 'Concor'], category: 'Bêta-bloquant', defaultDosages: ['2.5mg', '5mg', '10mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Atorvastatine', commercial: ['Tahor', 'Lipitor'], category: 'Hypolipémiant', defaultDosages: ['10mg', '20mg', '40mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Simvastatine', commercial: ['Zocor', 'Simvastatine'], category: 'Hypolipémiant', defaultDosages: ['10mg', '20mg', '40mg'], defaultFrequencies: ['1×/jour'] },

  // Diabète / Métabolisme
  { dci: 'Metformine', commercial: ['Glucophage', 'Stagid'], category: 'Antidiabétique', defaultDosages: ['500mg', '850mg', '1000mg'], defaultFrequencies: ['2×/jour', '3×/jour'] },
  { dci: 'Glibenclamide', commercial: ['Daonil', 'Glucovance'], category: 'Antidiabétique', defaultDosages: ['2.5mg', '5mg'], defaultFrequencies: ['1×/jour', '2×/jour'] },

  // Gastro-entérologie
  { dci: 'Oméprazole', commercial: ['Mopral', 'Losec', 'Prilosec'], category: 'IPP', defaultDosages: ['20mg', '40mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Pantoprazole', commercial: ['Eupantol', 'Protonix'], category: 'IPP', defaultDosages: ['20mg', '40mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Ranitidine', commercial: ['Azantac', 'Zantac'], category: 'Anti-H2', defaultDosages: ['150mg', '300mg'], defaultFrequencies: ['2×/jour'] },
  { dci: 'Métoclopramide', commercial: ['Primpéran', 'Reglan'], category: 'Antiémétique', defaultDosages: ['10mg'], defaultFrequencies: ['3×/jour'] },

  // Pneumologie / Allergologie
  { dci: 'Salbutamol', commercial: ['Ventoline', 'Salbutamol'], category: 'Bronchodilatateur', defaultDosages: ['100µg/dose', '2mg', '4mg'], defaultFrequencies: ['3-4×/jour'] },
  { dci: 'Prednisolone', commercial: ['Solupred', 'Cortancyl'], category: 'Corticoïde', defaultDosages: ['5mg', '20mg', '40mg'], defaultFrequencies: ['1×/jour matin'] },
  { dci: 'Béclométasone', commercial: ['Becotide', 'Qvar'], category: 'Corticoïde inhalé', defaultDosages: ['100µg', '200µg', '400µg'], defaultFrequencies: ['2×/jour'] },
  { dci: 'Cétirizine', commercial: ['Zyrtec', 'Reactine'], category: 'Antihistaminique', defaultDosages: ['10mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Loratadine', commercial: ['Clarityne', 'Claritin'], category: 'Antihistaminique', defaultDosages: ['10mg'], defaultFrequencies: ['1×/jour'] },

  // Neurologie / Psychiatrie
  { dci: 'Diazépam', commercial: ['Valium', 'Diazépam'], category: 'Benzodiazépine', defaultDosages: ['2mg', '5mg', '10mg'], defaultFrequencies: ['1-3×/jour'] },
  { dci: 'Haloperidol', commercial: ['Haldol', 'Haloperidol'], category: 'Antipsychotique', defaultDosages: ['1mg', '5mg', '10mg'], defaultFrequencies: ['1-2×/jour'] },
  { dci: 'Amitriptyline', commercial: ['Laroxyl', 'Elavil'], category: 'Antidépresseur tricyclique', defaultDosages: ['10mg', '25mg', '50mg'], defaultFrequencies: ['1-3×/jour'] },
  { dci: 'Fluoxétine', commercial: ['Prozac', 'Fluoxétine'], category: 'ISRS', defaultDosages: ['20mg'], defaultFrequencies: ['1×/jour matin'] },
  { dci: 'Sertraline', commercial: ['Zoloft', 'Lustral'], category: 'ISRS', defaultDosages: ['25mg', '50mg', '100mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Carbamazépine', commercial: ['Tegretol', 'Mazépine'], category: 'Antiépileptique', defaultDosages: ['200mg', '400mg'], defaultFrequencies: ['2×/jour'] },

  // Suppléments / Vitamines
  { dci: 'Fer ferreux', commercial: ['Tardyferon', 'Ferrostrane'], category: 'Supplément', defaultDosages: ['50mg', '80mg'], defaultFrequencies: ['1×/jour', '2×/jour'] },
  { dci: 'Acide folique', commercial: ['Folacine', 'Spéciafoldine'], category: 'Vitamine', defaultDosages: ['0.4mg', '1mg', '5mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Vitamine C', commercial: ['Laroscorbine', 'Redoxon'], category: 'Vitamine', defaultDosages: ['250mg', '500mg', '1000mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Zinc', commercial: ['Granions de Zinc', 'Azinc'], category: 'Oligo-élément', defaultDosages: ['15mg', '45mg'], defaultFrequencies: ['1×/jour'] },
  { dci: 'Calcium + Vitamine D', commercial: ['Cacit D3', 'Orocal D3'], category: 'Supplément', defaultDosages: ['500mg/400UI'], defaultFrequencies: ['1-2×/jour'] },
]

// Helper: search by DCI or commercial name
export function searchMedications(query: string): MedicationEntry[] {
  if (query.length < 2) return []
  const q = query.toLowerCase()
  return MEDICATIONS_DB.filter(
    (m) =>
      m.dci.toLowerCase().includes(q) ||
      m.commercial.some((c) => c.toLowerCase().includes(q))
  ).slice(0, 6)
}
