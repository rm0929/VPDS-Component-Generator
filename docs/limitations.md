# Limitations and evidence

Supported capability does not guarantee correct LLM selection. Qwen3 can return the wrong component, omit disabled/dismissal/label properties, miss adjacent horizontal grouping, or classify a supported request as unsupported. A schema-valid specification and compilable TSX establish structural correctness, not semantic requirement coverage.

The flat contract has one optional form, default vertical blocks and adjacent rows, with at most 20 selections. It does not support arbitrary nested application layouts, data tables, application routing, remote data, authentication or persistence. Complex requests may fail; simplify or name a supported component directly. There is no semantic-confidence detector or silent keyword correction.

Payment-card fields are illustrative labeled inputs, not processing, full validation, formatting or network detection. Do not enter real card information. Copied UI requires React, React DOM, Nova React, Nova Styles and icons at compatible installed versions; import Nova Styles and a Visa theme in the consuming application. Generated code includes fixed interaction handlers where needed, but no business backend behavior.

## Selected evidence

See the [evaluation guide](evaluation/README.md) for the frozen cases, retained inputs/results/raw responses, historical per-case failures, and reproduction boundaries. These records describe their recorded catalog/settings, not a fresh benchmark of this cleanup.

Only representative aggregate records and original responses are retained. Duplicate per-attempt TSX/spec files, superseded diagnosis passes, rejected prompt comparisons and repetitive progress reports were removed. Retained result data and frozen expectations were not edited to improve scores.

The [desktop](screenshots/desktop-light.png) and [mobile](screenshots/mobile-dark.png) screenshots show the current interface using a handcrafted fixture. Browser fixture checks and mock HTTP tests establish application behavior, not model accuracy. No new model benchmark was run for cleanup. The old Vercel demo is distinct from the local AI application. No production deployment or public-service hardening is claimed.
