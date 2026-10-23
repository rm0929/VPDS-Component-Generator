import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';
import type { UiNode } from '@vpds/ui-specification/componentRegistry';
import { matchesCoverageRequirement } from './requirementCoverage';
import { scoreGeneration } from './evaluateGeneration';
import type { BenchmarkCase } from './challengeCases';

const layout = (node: UiNode) => node.type === 'horizontalLayout' || node.type === 'verticalLayout';

export function analyzeComposition(testCase: BenchmarkCase, output: unknown) {
  const parsed = uiSpecificationSchema.safeParse(output);
  if (!parsed.success) return null;
  const indexed: { node: UiNode; start: number; end: number }[] = [];
  let count = 0, depth = 0, singleChild = 0, repeatedEdges = 0, longestChain = 0;
  const walk = (node: UiNode, layoutDepth: number, chain: number) => {
    const entry = { node, start: indexed.length, end: 0 };
    indexed.push(entry);
    const nextDepth = layoutDepth + Number(layout(node));
    if (layout(node)) {
      count++; depth = Math.max(depth, nextDepth); longestChain = Math.max(longestChain, chain);
      if (node.children?.length === 1) singleChild++;
    }
    for (const child of node.children ?? []) {
      const repeated = layout(node) && node.type === child.type;
      if (repeated) repeatedEdges++;
      walk(child, nextDepth, repeated ? chain + 1 : 1);
    }
    entry.end = indexed.length - 1;
  };
  walk(parsed.data.root, 0, 1);
  const requirements = testCase.expected === 'supported' ? testCase.expectation.requirements : [];
  const candidates = (key: string) => {
    const requirement = requirements.find(item => item.key === key);
    return requirement ? indexed.filter(item => matchesCoverageRequirement(item.node, requirement)) : [];
  };
  const relationships = (testCase.relationships ?? []).map(rule => {
    let passed: boolean;
    if (rule.kind === 'before') {
      // A whole group must finish before the next item, not merely begin before it.
      passed = candidates(rule.first).some(first => candidates(rule.second).some(second => first.end < second.start));
    } else {
      passed = candidates(rule.parent).some(({ node }) => {
        const children = node.children ?? [];
        const used = new Set<number>();
        let last = -1;
        return rule.children.every(key => {
          const requirement = requirements.find(item => item.key === key);
          const index = children.findIndex((child, position) => !used.has(position)
            && (!rule.ordered || position > last) && requirement && matchesCoverageRequirement(child, requirement));
          if (index < 0) return false;
          used.add(index); last = index; return true;
        });
      });
    }
    return { key: rule.key, passed };
  });
  const forbidden = (testCase.forbidden ?? []).filter(rule => indexed.some(({ node }) => matchesCoverageRequirement(node, rule))).map(rule => rule.key);
  return {
    layout: { count, depth, singleChild, repeatedDirectionEdges: repeatedEdges, longestSameDirectionChain: count ? longestChain : 0 },
    layoutWithinBudget: !testCase.layoutBudget || (count <= testCase.layoutBudget.count && depth <= testCase.layoutBudget.depth),
    failedRelationships: relationships.filter(item => !item.passed).map(item => item.key),
    relationshipCount: relationships.length, forbiddenViolations: forbidden,
  };
}

export function scoreBenchmark(testCase: BenchmarkCase, output: unknown, errorCode?: string) {
  const semantic = scoreGeneration(testCase, output, errorCode);
  const composition = analyzeComposition(testCase, output);
  const relationshipsPassed = composition ? composition.failedRelationships.length === 0 : false;
  const forbiddenPassed = composition ? composition.forbiddenViolations.length === 0 : false;
  const complete = semantic.completeCoverage && relationshipsPassed && forbiddenPassed;
  return { ...semantic, completeCoverage: complete,
    passed: testCase.expected === 'unsupported' ? semantic.passed : complete,
    composition,
  };
}
