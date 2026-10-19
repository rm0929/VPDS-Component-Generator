# Frozen Phase 2B evaluation protocol

This protocol and the expectations were recorded before changing generation
instructions. The original eleven cases are preserved in `legacy-v1.json` and
checked against their source definitions in tests. Eighteen challenge cases are
independently authored and frozen in `challenge-v1.json`. The aggregate dataset
version is `phase2b-eval-v2`; its SHA-256 is
`97e04137a3089d780d994d29c2700253b5bbcfc4434ae5cae5f0883e807b3d9b`.

The baseline system/example messages, grammar hash, compiler revision and source
hashes are recorded in `backend/evaluation/fixtures/frozen-manifest.json` and
`baseline-prompt-v1.json`. The runner aborts if the compiler, grammar, or dataset
no longer matches the freeze. Prompt experiments alter trusted messages only.

The challenge covers all ten types, literal property values, repeated fields,
direct row/column grouping, sibling order, grouping followed by a lower item,
optional/required flags, negation, UI-only authentication wording, and explicit
unsupported outcomes. The exact profile request is `c-profile`. Its Save Profile
button label is required; its button type is intentionally not prescribed because
the prompt did not specify one. Its row must contain both name controls directly,
in order; email must follow the entire row. A valid alternative with the row and
email directly inside the form is accepted: there is no compulsory column wrapper.

Positive requirements, forbidden components, and composition relationships are
scored separately. Full semantic success requires all positive requirements,
no prohibited components, and all requested relationships. Existing legacy
expectations retain their original semantics. Additional relationships are only
part of the versioned challenge, not retroactive changes to old cases.

Layout metrics count explicit specification layouts only: count, maximum number
of layout ancestors including the layout itself, single-child layouts,
same-direction parent-child edges, and longest same-direction chain. Forms and
renderer-owned label/input wrappers are excluded. Per-case layout budgets are
fixed preference measurements, not Zod constraints or semantic failure rules.
Invalid outputs have unassessed layout metrics, not a zero-complexity score.
No layout is flattened or otherwise modified.

Latency uses elapsed milliseconds per attempt and nearest-rank median/p95.
Failures/timeouts remain in the overall distribution and also get separate
successful/unsuccessful medians. Cold first attempts are retained and identified
by fixed run/case order. These measurements are not an inference microbenchmark.

Baseline and every isolated experiment use the same model digest, Ollama runtime,
grammar/compiler/dataset hashes, temperature 0, seed 0, 8192 context, 2048 output
tokens, 65536 response bytes and a 60000 ms timeout. Run each case twice in fixed
order. Record safe diagnostics and metadata, never prompts, raw responses, or
generated labels/field values. Live inference is manual and excluded from CI.

Experiments will isolate: removal of the duplicate system registration example;
layout/atomic-field/minimal-tree guidance; diverse trusted demonstrations;
and positive-versus-negative requirement guidance. Each is compared to the
frozen baseline, not to expectations modified after seeing its outputs.

Retention requires non-decreasing aggregate structural validity, full semantic
success, requirement coverage, and correct unsupported outcomes, with no new
forbidden violations. Core-case successful counts (registration, contact, simple
login, profile, negated login, UI-only login) must not decrease. Layout count,
depth and unary-wrapper means must not worsen. Latency remains a separate
reported trade-off. If no candidate satisfies these conservative gates, retain
the baseline and report the failed experiments. Any combination of accepted
changes must itself be evaluated before promotion. Two repeats are evidence for
this development decision, not a statistical generalization guarantee.
