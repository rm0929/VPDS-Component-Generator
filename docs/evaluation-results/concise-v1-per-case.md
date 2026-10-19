# Concise prompt: all 29 frozen cases

Generated from `baseline-v2.jsonl`, `concise-v1.jsonl`, and the saved comparison. B → R means baseline → replacement; every case has two attempts. No model responses or generated values are included.

## Structural, semantic, unsupported and latency comparison

Valid UI is assessed for supported requests. Complete coverage includes the existing property, extra-field, forbidden-component and relationship checks. Positive requirements match whole declarations (including their properties), not individual property tokens. Refusals are correct for unsupported cases and false refusals for supported cases. A ↓ marks any decreased quality metric, even when complete coverage was already zero.

Latency is the frozen nearest-rank median; with two samples this is the smaller elapsed time, not the arithmetic mean. The two recorded timeout outliers are listed in the main report and remain in the raw artifacts.

| Case | Valid UI B → R | Complete B → R | Positive matches B → R | Refusals B → R | Median ms B → R |
| --- | --- | --- | --- | --- | --- |
| `registration` ↓ | 2/2 → 1/2 | 2/2 → 0/2 | 14/14 → 1/14 | 0/2 → 0/2 | 6130 → 12201 |
| `login` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 4322 → 6624 |
| `contact` ↓ | 2/2 → 2/2 | 2/2 → 0/2 | 10/10 → 2/10 | 0/2 → 0/2 | 5936 → 5586 |
| `split-name` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 10/10 → 0/10 | 0/2 → 0/2 | 5229 → 7114 |
| `password-reset` ↓ | 2/2 → 2/2 | 2/2 → 0/2 | 6/6 → 0/6 | 0/2 → 0/2 | 4291 → 6168 |
| `simple-login` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 4708 → 6630 |
| `horizontal-content` | 2/2 → 2/2 | 0/2 → 2/2 | 4/6 → 6/6 | 0/2 → 0/2 | 3401 → 4399 |
| `layout-properties` ↓ | 2/2 → 2/2 | 0/2 → 0/2 | 4/6 → 2/6 | 0/2 → 0/2 | 4082 → 5348 |
| `field-properties` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 5108 → 7123 |
| `unsupported-widget` ↓ | n/a (unsupported) | n/a | n/a | 2/2 → 0/2 | 492 → 4207 |
| `unsupported-behavior` | n/a (unsupported) | n/a | n/a | 2/2 → 2/2 | 536 → 519 |
| `c-text-input` | 2/2 → 2/2 | 0/2 → 0/2 | 0/2 → 0/2 | 0/2 → 0/2 | 2561 → 4928 |
| `c-email-input` | 2/2 → 2/2 | 0/2 → 0/2 | 0/2 → 0/2 | 0/2 → 0/2 | 809 → 4820 |
| `c-password-input` | 2/2 → 2/2 | 0/2 → 0/2 | 0/2 → 0/2 | 0/2 → 0/2 | 930 → 4881 |
| `c-checkbox` ↓ | 2/2 → 2/2 | 2/2 → 0/2 | 2/2 → 0/2 | 0/2 → 0/2 | 5002 → 4507 |
| `c-button` | 2/2 → 2/2 | 2/2 → 2/2 | 2/2 → 2/2 | 0/2 → 0/2 | 2147 → 4494 |
| `c-text` ↓ | 2/2 → 2/2 | 2/2 → 0/2 | 2/2 → 0/2 | 0/2 → 0/2 | 667 → 2052 |
| `c-heading` | 2/2 → 2/2 | 2/2 → 2/2 | 2/2 → 2/2 | 0/2 → 0/2 | 733 → 4271 |
| `c-row` | 2/2 → 2/2 | 0/2 → 0/2 | 2/6 → 4/6 | 0/2 → 0/2 | 4093 → 3997 |
| `c-column` | 2/2 → 2/2 | 0/2 → 0/2 | 2/6 → 4/6 | 0/2 → 0/2 | 4176 → 4024 |
| `c-form-actions` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 4800 → 6526 |
| `c-profile` | 0/2 → 0/2 | 0/2 → 0/2 | 0/12 → 0/12 | 0/2 → 0/2 | 3672 → 7171 |
| `c-newsletter` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 5116 → 6283 |
| `c-negation-login` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 4574 → 6890 |
| `c-ui-only-login` ↓ | 2/2 → 0/2 | 2/2 → 0/2 | 8/8 → 0/8 | 0/2 → 0/2 | 4415 → 6714 |
| `c-mixed` | 0/2 → 2/2 | 0/2 → 0/2 | 0/12 → 0/12 | 0/2 → 0/2 | 4595 → 4045 |
| `c-repeated-fields` ↓ | 2/2 → 0/2 | 0/2 → 0/2 | 6/8 → 0/8 | 0/2 → 0/2 | 4441 → 6666 |
| `c-unsupported-image` ↓ | n/a (unsupported) | n/a | n/a | 2/2 → 0/2 | 484 → 6902 |
| `c-unsupported-storage` | n/a (unsupported) | n/a | n/a | 2/2 → 2/2 | 551 → 516 |

## Layout complexity per case

Means use valid supported attempts only. n/a indicates unassessed output, never a flattering zero. Chain means each document’s longest same-direction chain. Layout budgets, count, depth, unary wrappers and repeated-direction chains remain observations; no tree is normalized.

| Case | Layout count B → R | Layout depth B → R | Single child B → R | Repeated edges B → R | Longest chain B → R |
| --- | --- | --- | --- | --- | --- |
| `registration` | 4.00 → 11.00 | 4.00 → 4.00 | 3.00 → 10.00 | 2.00 → 5.00 | 2.00 → 3.00 |
| `login` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `contact` | 4.00 → 6.00 | 4.00 → 4.00 | 2.00 → 5.00 | 2.00 → 3.00 | 3.00 → 3.00 |
| `split-name` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 2.00 → n/a |
| `password-reset` | 4.00 → 7.00 | 4.00 → 5.00 | 3.00 → 5.00 | 2.00 → 4.00 | 3.00 → 3.00 |
| `simple-login` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `horizontal-content` | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 4.00 | 4.00 → 0.00 | 5.00 → 1.00 |
| `layout-properties` | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.00 → 4.00 | 5.00 → 5.00 |
| `field-properties` | 4.00 → n/a | 4.00 → n/a | 2.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `unsupported-widget` | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a |
| `unsupported-behavior` | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a |
| `c-text-input` | 3.00 → 5.00 | 2.00 → 5.00 | 2.00 → 4.00 | 2.00 → 4.00 | 2.00 → 5.00 |
| `c-email-input` | 0.00 → 5.00 | 0.00 → 5.00 | 0.00 → 4.00 | 0.00 → 3.00 | 0.00 → 4.00 |
| `c-password-input` | 0.00 → 5.00 | 0.00 → 5.00 | 0.00 → 4.00 | 0.00 → 3.00 | 0.00 → 4.00 |
| `c-checkbox` | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 0.00 → 4.00 | 1.00 → 5.00 |
| `c-button` | 2.00 → 5.00 | 2.00 → 5.00 | 1.00 → 5.00 | 0.00 → 3.00 | 1.00 → 4.00 |
| `c-text` | 0.00 → 3.00 | 0.00 → 3.00 | 0.00 → 3.00 | 0.00 → 0.00 | 0.00 → 1.00 |
| `c-heading` | 0.00 → 5.00 | 0.00 → 5.00 | 0.00 → 5.00 | 0.00 → 4.00 | 0.00 → 5.00 |
| `c-row` | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.00 → 4.00 | 5.00 → 5.00 |
| `c-column` | 5.00 → 5.00 | 5.00 → 5.00 | 5.00 → 5.00 | 4.00 → 4.00 | 5.00 → 5.00 |
| `c-form-actions` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 1.00 → n/a | 2.00 → n/a |
| `c-profile` | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a |
| `c-newsletter` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `c-negation-login` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `c-ui-only-login` | 4.00 → n/a | 4.00 → n/a | 3.00 → n/a | 2.00 → n/a | 3.00 → n/a |
| `c-mixed` | n/a → 5.00 | n/a → 5.00 | n/a → 5.00 | n/a → 3.00 | n/a → 4.00 |
| `c-repeated-fields` | 4.00 → n/a | 4.00 → n/a | 4.00 → n/a | 0.00 → n/a | 1.00 → n/a |
| `c-unsupported-image` | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a |
| `c-unsupported-storage` | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a | n/a → n/a |
