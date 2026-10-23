import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { coverageCases } from './coverageCases';
import { evaluateCoverage } from './requirementCoverage';

const [caseId, filename] = process.argv.slice(2);
const testCase = coverageCases.find(item => item.id === caseId);
if (!testCase || !filename) {
  console.error(`Usage: npm run eval:coverage --workspace @vpds/backend -- <${coverageCases.map(item => item.id).join('|')}> <absolute-json-file>`);
  process.exitCode = 2;
} else {
  try {
    if (statSync(filename).size > 1024 * 1024) throw new Error('Evaluation input is too large');
    const input: unknown = JSON.parse(readFileSync(filename, 'utf8'));
    const apiEnvelope = z.object({ data: z.object({ specification: z.unknown() }) }).safeParse(input);
    const output = apiEnvelope.success ? apiEnvelope.data.data.specification : input;
    const report = evaluateCoverage(output, testCase.expectation);
    console.log(JSON.stringify({ caseId, ...report }, null, 2));
    process.exitCode = report.passed ? 0 : 1;
  } catch {
    console.error('Could not evaluate the JSON file. Check its path, size, and JSON syntax.');
    process.exitCode = 2;
  }
}
