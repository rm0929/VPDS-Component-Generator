import type { SelectionPoc } from './selection';

export type SelectionExpectation = {
  components: { type: string; props: Record<string, string | number | boolean | undefined> }[];
  rows: number[][];
  formLabel: string | null;
  forbiddenTypes?: string[];
};
const normalize = (text: string) => text.trim().toLowerCase();

/** Evaluation-only: comparisons emit booleans/indexes, never model labels or values. */
export function assessSelection(selection: Pick<SelectionPoc, 'components' | 'unsupported'>, expected: SelectionExpectation, formEnabled: boolean) {
  const used = new Set<number>();
  const propertyMatches = (component: SelectionPoc['components'][number], props: SelectionExpectation['components'][number]['props']) => {
    const actual = new Map<string, unknown>(Object.entries(component.props));
    return Object.fromEntries(Object.entries(props).map(([key, value]) => {
      const selected = actual.get(key) ?? (key === 'required' || key === 'disabled' ? false : undefined);
      return [key, key === 'label' && typeof selected === 'string' && typeof value === 'string'
        ? normalize(selected) === normalize(value) : selected === value];
    }));
  };
  const matches = expected.components.map((requirement, expectedIndex) => {
    const candidates = selection.components.map((component, index) => ({ component, index }))
      .filter(({ component, index }) => !used.has(index) && component.type === requirement.type);
    const found = candidates.find(({ component }) => Object.values(propertyMatches(component, requirement.props)).every(Boolean)) ?? candidates[0];
    if (!found) return { expectedIndex, selectedIndex: -1, typeCorrect: false, properties: {} as Record<string, boolean> };
    used.add(found.index);
    return { expectedIndex, selectedIndex: found.index, typeCorrect: true, properties: propertyMatches(found.component, requirement.props) };
  });
  const allFound = matches.every(match => match.typeCorrect);
  const extras = selection.components.map((_, index) => index).filter(index => !used.has(index));
  const rows: number[][] = [];
  selection.components.forEach((component, index) => {
    if (!component.besidePrevious) return;
    const last = rows.at(-1);
    if (last?.at(-1) === index - 1) last.push(index);
    else rows.push([index - 1, index]);
  });
  const expectedRows = expected.rows.map(row => row.map(index => matches[index]?.selectedIndex ?? -1));
  const rowsCorrect = allFound && JSON.stringify(rows) === JSON.stringify(expectedRows);
  const orderCorrect = allFound && matches.every((match, index) => !index || matches[index - 1].selectedIndex < match.selectedIndex);
  const forbidden = selection.components.filter(component => expected.forbiddenTypes?.includes(component.type)).length;
  const componentsCorrect = !selection.unsupported.length && allFound && !extras.length && !forbidden
    && matches.every(match => Object.values(match.properties).every(Boolean));
  return { selectedTypes: selection.components.map(component => component.type),
    actions: selection.components.flatMap((component, index) => component.type === 'button' ? [{ index, type: component.props.type }] : []),
    matches, extraIndexes: extras, forbiddenCount: forbidden,
    componentsCorrect, orderCorrect, rows, rowsCorrect, formCorrect: formEnabled === (expected.formLabel !== null),
    layoutCorrect: rowsCorrect && orderCorrect && formEnabled === (expected.formLabel !== null) };
}

// Independent expectations for the three approved requests, not generation templates.
export const feasibilityExpectations: readonly SelectionExpectation[] = [
  { components: [{ type: 'emailInput', props: {} }], rows: [], formLabel: null },
  { components: [{ type: 'emailInput', props: { label: 'Email' } }, { type: 'passwordInput', props: { label: 'Password' } },
    { type: 'checkbox', props: { label: 'Remember me' } }, { type: 'button', props: {} }], rows: [], formLabel: 'any valid label' },
  { components: [{ type: 'textInput', props: { label: 'First name' } }, { type: 'textInput', props: { label: 'Last name' } },
    { type: 'emailInput', props: { label: 'Email' } }, { type: 'button', props: { label: 'Save Profile' } }], rows: [[0, 1]], formLabel: 'any valid label' },
];
