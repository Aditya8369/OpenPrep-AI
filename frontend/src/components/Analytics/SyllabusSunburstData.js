// Default syllabus hierarchy with historical PYQ weightage & mock mastery
export const DEFAULT_SYLLABUS = [
  {
    id: 'subj-phy',
    name: 'Physics',
    weightage: 35,
    mastery: 68,
    children: [
      {
        id: 'chap-phy-mech',
        name: 'Mechanics',
        weightage: 18,
        mastery: 74,
        children: [
          { id: 'top-phy-laws', name: 'Laws of Motion', weightage: 6, mastery: 85, pyqFrequency: 'Appeared in 9 of last 10 years', questionsPracticed: 45, accuracy: 82 },
          { id: 'top-phy-work', name: 'Work, Power & Energy', weightage: 6, mastery: 72, pyqFrequency: 'Appeared in 8 of last 10 years', questionsPracticed: 38, accuracy: 70 },
          { id: 'top-phy-rot', name: 'Rotational Motion', weightage: 6, mastery: 55, pyqFrequency: 'Appeared in 10 of last 10 years (High Yield)', questionsPracticed: 52, accuracy: 52 },
        ],
      },
      {
        id: 'chap-phy-em',
        name: 'Electrodynamics',
        weightage: 17,
        mastery: 62,
        children: [
          { id: 'top-phy-electro', name: 'Electrostatics', weightage: 7, mastery: 65, pyqFrequency: 'Appeared in 9 of last 10 years', questionsPracticed: 40, accuracy: 65 },
          { id: 'top-phy-current', name: 'Current Electricity', weightage: 6, mastery: 78, pyqFrequency: 'Appeared in 10 of last 10 years', questionsPracticed: 60, accuracy: 80 },
          { id: 'top-phy-mag', name: 'Magnetism & EMI', weightage: 4, mastery: 42, pyqFrequency: 'Appeared in 7 of last 10 years', questionsPracticed: 25, accuracy: 44 },
        ],
      },
    ],
  },
  {
    id: 'subj-chem',
    name: 'Chemistry',
    weightage: 33,
    mastery: 72,
    children: [
      {
        id: 'chap-chem-org',
        name: 'Organic Chemistry',
        weightage: 18,
        mastery: 60,
        children: [
          { id: 'top-chem-goc', name: 'General Organic Chemistry', weightage: 8, mastery: 80, pyqFrequency: 'Appeared in 10 of last 10 years', questionsPracticed: 70, accuracy: 85 },
          { id: 'top-chem-hydro', name: 'Hydrocarbons', weightage: 5, mastery: 58, pyqFrequency: 'Appeared in 8 of last 10 years', questionsPracticed: 34, accuracy: 58 },
          { id: 'top-chem-aldehydes', name: 'Aldehydes & Ketones', weightage: 5, mastery: 42, pyqFrequency: 'Appeared in 9 of last 10 years', questionsPracticed: 28, accuracy: 40 },
        ],
      },
      {
        id: 'chap-chem-phys',
        name: 'Physical Chemistry',
        weightage: 15,
        mastery: 84,
        children: [
          { id: 'top-chem-thermo', name: 'Thermodynamics', weightage: 8, mastery: 88, pyqFrequency: 'Appeared in 10 of last 10 years', questionsPracticed: 55, accuracy: 90 },
          { id: 'top-chem-kinetics', name: 'Chemical Kinetics', weightage: 7, mastery: 80, pyqFrequency: 'Appeared in 8 of last 10 years', questionsPracticed: 42, accuracy: 82 },
        ],
      },
    ],
  },
  {
    id: 'subj-math',
    name: 'Mathematics',
    weightage: 32,
    mastery: 54,
    children: [
      {
        id: 'chap-math-calc',
        name: 'Calculus',
        weightage: 18,
        mastery: 50,
        children: [
          { id: 'top-math-diff', name: 'Differential Calculus', weightage: 9, mastery: 58, pyqFrequency: 'Appeared in 10 of last 10 years', questionsPracticed: 65, accuracy: 60 },
          { id: 'top-math-int', name: 'Integral Calculus', weightage: 9, mastery: 42, pyqFrequency: 'Appeared in 10 of last 10 years (High Yield)', questionsPracticed: 80, accuracy: 42 },
        ],
      },
      {
        id: 'chap-math-alg',
        name: 'Algebra',
        weightage: 14,
        mastery: 60,
        children: [
          { id: 'top-math-matrix', name: 'Matrices & Determinants', weightage: 7, mastery: 75, pyqFrequency: 'Appeared in 8 of last 10 years', questionsPracticed: 44, accuracy: 78 },
          { id: 'top-math-prob', name: 'Probability', weightage: 7, mastery: 45, pyqFrequency: 'Appeared in 9 of last 10 years', questionsPracticed: 36, accuracy: 45 },
        ],
      },
    ],
  },
];

/**
 * Returns a color representing student mastery from Red (0%) to Yellow (50%) to Emerald Green (100%)
 */
export function getMasteryColor(mastery) {
  const m = Math.max(0, Math.min(100, Number(mastery) || 0));
  if (m < 50) {
    const factor = m / 50;
    const r = Math.round(239 + (245 - 239) * factor);
    const g = Math.round(68 + (158 - 68) * factor);
    const b = Math.round(68 + (11 - 68) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const factor = (m - 50) / 50;
    const r = Math.round(245 + (16 - 245) * factor);
    const g = Math.round(158 + (185 - 158) * factor);
    const b = Math.round(11 + (129 - 11) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
