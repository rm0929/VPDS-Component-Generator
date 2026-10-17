import { buildPresentation } from './presentation';
import type { PresentationElement, PresentationTag } from './presentation';
import type { UiSpecification } from './uiSpecification';

function stringLiteral(value: string): string {
  // JSON escaping plus HTML-sensitive characters and JS line separators.
  // Every string is emitted inside a JSX expression, never as raw JSX/HTML.
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function serializeElement(element: PresentationElement, depth: number, imports: Set<PresentationTag>): string {
  const indent = '  '.repeat(depth);
  if (element.tag !== 'form') imports.add(element.tag);
  const props = Object.entries(element.props)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}={${typeof value === 'string' ? stringLiteral(value) : String(value)}}`)
    .join('');
  // This handler is fixed application code. No callback comes from the spec.
  const submissionGuard = element.tag === 'form' ? ' onSubmit={(event) => event.preventDefault()}' : '';
  const opening = `${indent}<${element.tag}${props}${submissionGuard}`;
  if (!element.children.length) return `${opening} />`;
  const children = element.children.map(child => typeof child === 'string'
    ? `${indent}  {${stringLiteral(child)}}`
    : serializeElement(child, depth + 1, imports)).join('\n');
  return `${opening}>\n${children}\n${indent}</${element.tag}>`;
}

/** Generate source only; it is never imported or executed by the application. */
export function generateTsx(specification: UiSpecification): string {
  const imports = new Set<PresentationTag>();
  const jsx = serializeElement(buildPresentation(specification), 2, imports);
  const novaImport = imports.size
    ? `import { ${Array.from(imports).sort().join(', ')} } from '@visa/nova-react';\n\n`
    : '';
  return `${novaImport}export default function GeneratedUI() {\n  return (\n${jsx}\n  );\n}\n`;
}
