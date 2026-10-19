import { uiSpecificationSchema } from '../../src/specification/uiSpecification';
import type { ComponentType, UiNode } from '../../src/specification/componentRegistry';

export type FieldRole = 'name' | 'first-name' | 'last-name' | 'email' | 'password' | 'confirm-password' | 'terms' | 'message';
export type CoverageRequirement = {
  key: string; type: ComponentType; fieldRole?: FieldRole;
  buttonType?: 'submit' | 'reset' | 'button'; buttonLabel?: string; required?: boolean;
  properties?: Record<string, string | number | boolean>;
  within?: ComponentType;
};
export type CoverageExpectation = {
  scope: 'form' | 'general'; requirements: readonly CoverageRequirement[];
  /** Offline evaluations can flag copied example fields. Runtime extraction is conservative. */
  forbidExtraFields?: boolean;
};

const fieldTypes = {
  name: 'textInput', 'first-name': 'textInput', 'last-name': 'textInput', email: 'emailInput',
  password: 'passwordInput', 'confirm-password': 'passwordInput', terms: 'checkbox', message: 'textInput',
} as const;

// Conventional form-submit labels, not templates for complete form responses.
// Canonical labels are developer-owned; raw prompt fragments never enter the checklist.
const namedSubmitButton = /\b(log[ -]?in|sign[ -]in|register|sign[ -]up)\s+button\b/g;
const submitActions: Record<string, { key: string; label: string }> = {
  login: { key: 'login', label: 'Login' }, signin: { key: 'sign-in', label: 'Sign in' },
  register: { key: 'register', label: 'Register' }, signup: { key: 'sign-up', label: 'Sign up' },
};
function namedActions(fields: string): CoverageRequirement[] {
  return [...fields.matchAll(namedSubmitButton)].map(match => {
    const action = submitActions[match[1].replace(/[ -]/g, '')];
    return { key: action.key, type: 'button', buttonType: 'submit', buttonLabel: action.label };
  });
}

/** Optional offline evaluation aid only. Never used to select a grammar or reject API output. */
export function deriveFormExpectation(prompt: string): CoverageExpectation {
  const input = prompt.toLowerCase();
  // Abstain on negatives, conditional requests, and descriptions instead of imposing a wrong plan.
  if (!/\bform\b/.test(input) || /\b(?:no|not|without|omit|exclude|excluding|if|describe|explain)\b|don['’]t/.test(input)) {
    return { scope: 'general', requirements: [] };
  }
  // Only extract an explicit field list. "Password reset form" is a form title,
  // not evidence that the user requested a password input.
  const listMarker = /\b(?:with|containing|include|including|fields?)\b\s*:?/.exec(input);
  const fields = listMarker ? input.slice(listMarker.index + listMarker[0].length) : '';
  const roles: FieldRole[] = [];
  if (/\bfirst[ -]name\b/.test(fields)) roles.push('first-name');
  if (/\blast[ -]name\b/.test(fields)) roles.push('last-name');
  const withoutSplitNames = fields.replace(/\b(?:first|last)[ -]name\b/g, '');
  if (/\bname\b/.test(withoutSplitNames)) roles.push('name');
  if (/\be-?mail\b/.test(fields)) roles.push('email');
  const confirmation = /\b(?:confirm(?:ation)?[ -]password|password[ -]confirmation|repeat[ -]password)\b/g;
  const hasConfirmation = confirmation.test(fields);
  if (/\bpassword\b/.test(fields.replace(confirmation, ''))) roles.push('password');
  if (hasConfirmation) roles.push('confirm-password');
  if (/\bterms\b/.test(fields)) roles.push('terms');
  if (/\bmessage\b/.test(fields)) roles.push('message');
  const requirements: CoverageRequirement[] = [
    { key: 'form', type: 'form' },
    ...roles.map(role => ({ key: role, type: fieldTypes[role], fieldRole: role })),
  ];
  if (/\bsubmit\b/.test(fields)) requirements.push({ key: 'submit', type: 'button', buttonType: 'submit' });
  if (/\breset[ -]button\b/.test(fields)) requirements.push({ key: 'reset', type: 'button', buttonType: 'reset' });
  for (const action of namedActions(fields)) {
    if (!requirements.some(item => item.key === action.key)) requirements.push(action);
  }
  return { scope: 'form', requirements };
}

function flatten(node: UiNode): UiNode[] {
  return [node, ...(node.children?.flatMap(flatten) ?? [])];
}

function matchesRole(node: UiNode, role: FieldRole): boolean {
  const text = `${'name' in node.props ? node.props.name : ''} ${'label' in node.props ? node.props.label : ''}`
    .replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[-_]/g, ' ');
  const confirm = /\b(?:confirm|confirmation|repeat|retype)\b|confirmpassword/.test(text);
  switch (role) {
    case 'name': return /\bname\b/.test(text) && !/\b(?:first|last)\s*name\b/.test(text);
    case 'first-name': return /\bfirst\s*name\b|\bfirstname\b/.test(text);
    case 'last-name': return /\blast\s*name\b|\blastname\b/.test(text);
    case 'email': return /\be\s?mail\b/.test(text);
    case 'password': return /\bpassword\b/.test(text) && !confirm;
    case 'confirm-password': return (/\bpassword\b|confirmpassword/.test(text)) && confirm;
    case 'terms': return /\bterms\b/.test(text);
    case 'message': return /\bmessage\b/.test(text);
  }
}

export function matchesCoverageRequirement(node: UiNode, requirement: CoverageRequirement): boolean {
  const values = new Map(Object.entries(node.props));
  return node.type === requirement.type
    && (!requirement.fieldRole || matchesRole(node, requirement.fieldRole))
    && (!requirement.buttonType || (node.type === 'button' && node.props.type === requirement.buttonType))
    && (!requirement.buttonLabel || (node.type === 'button' && node.props.label.trim().toLowerCase() === requirement.buttonLabel.toLowerCase()))
    && (requirement.required === undefined || (values.get('required') ?? false) === requirement.required)
    && Object.entries(requirement.properties ?? {}).every(([key, value]) => {
      const actual = values.get(key) ?? (key === 'disabled' || key === 'required' ? false : key === 'gap' ? 'medium' : undefined);
      return actual === value;
    });
}

export type CoverageReport = {
  schemaValid: boolean; assessed: boolean; passed: boolean; coverage: number | null;
  matched: string[]; missing: string[]; unexpectedFieldIds: string[];
};

/** Separate quality measurement: it never repairs output or weakens structural validation. */
export function evaluateCoverage(output: unknown, expectation: CoverageExpectation): CoverageReport {
  const parsed = uiSpecificationSchema.safeParse(output);
  const assessed = expectation.requirements.length > 0;
  const invalid: CoverageReport = { schemaValid: false, assessed, passed: false, coverage: assessed ? 0 : null,
    matched: [], missing: expectation.requirements.map(item => item.key), unexpectedFieldIds: [] };
  if (!parsed.success) return invalid;
  const all = flatten(parsed.data.root);
  const ancestors = new Map<UiNode, readonly ComponentType[]>();
  const collect = (node: UiNode, parents: readonly ComponentType[]) => {
    ancestors.set(node, parents);
    node.children?.forEach(child => collect(child, [...parents, node.type]));
  };
  collect(parsed.data.root, []);
  // Form requirements must occur together, not be scattered across unrelated forms.
  const forms = all.filter(node => node.type === 'form');
  const candidates = expectation.scope === 'form' ? forms.map(flatten) : [all];
  if (!candidates.length) candidates.push([]);
  const reports = candidates.map(nodes => {
    const used = new Set<UiNode>();
    const matched: string[] = [];
    const missing: string[] = [];
    for (const requirement of expectation.requirements) {
      const found = nodes.find(node => !used.has(node) && matchesCoverageRequirement(node, requirement)
        && (!requirement.within || ancestors.get(node)?.includes(requirement.within)));
      if (found) { used.add(found); matched.push(requirement.key); }
      else missing.push(requirement.key);
    }
    const unexpectedFieldIds = expectation.forbidExtraFields
      ? all.filter(node => 'name' in node.props && !used.has(node)).map(node => node.id) : [];
    return { schemaValid: true, assessed, passed: assessed && !missing.length && !unexpectedFieldIds.length,
      coverage: assessed ? matched.length / expectation.requirements.length : null, matched, missing, unexpectedFieldIds };
  });
  return reports.sort((a, b) => b.matched.length - a.matched.length || a.unexpectedFieldIds.length - b.unexpectedFieldIds.length)[0];
}
