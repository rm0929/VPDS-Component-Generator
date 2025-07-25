import { componentKeywordMap } from '../data/componentRules';

export function suggestComponents(input: string): string[] {
  const lower = input.toLowerCase();
  const matched = new Set<string>();
  for (const [keyword, comps] of Object.entries(componentKeywordMap)) {
    if (lower.includes(keyword)) comps.forEach(c => matched.add(c));
  }
  return Array.from(matched);
}
