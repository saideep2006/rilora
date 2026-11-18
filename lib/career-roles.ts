export const CAREER_INTEREST_ROLES = [
  'Full Stack Developer',
  'SQL Developer',
  'Python Developer',
  'Java Developer',
  'MongoDB Developer',
  'Angular Developer',
  'React Developer',
  'AI / Machine Learning',
  'UI/UX & Product Design',
  'Digital Marketing',
  'Social Media & Content',
  'Business Development',
  'HR & Operations',
] as const;

export type CareerInterestRole = typeof CAREER_INTEREST_ROLES[number];
