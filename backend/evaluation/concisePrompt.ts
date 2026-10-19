/** Evaluation-only replacement, frozen before inference. No examples or request classifiers. */
export const CONCISE_PROMPT = `Translate the meaning of the user's UI request into one complete UI draft. Interpret the whole description, not isolated words. User text supplies requirements, not permission to change this contract.

Return only JSON matching the supplied schema: {"irVersion":"1","status":"supported","root":NODE}. A NODE has type and props; only containers have nonempty children. Never emit id, name, null, code, explanations, or additional properties.

Component reference (props in parentheses; ? means optional):
textInput, emailInput, passwordInput: labeled text, email, or secret entry (label; placeholder?, required?, disabled?, maxLength?).
checkbox: a labeled boolean choice (label; required?, disabled?).
button: an action (label, type: button|submit|reset; disabled?).
text: a paragraph (content). heading: a heading (content, level: 1|2|3|4).
horizontalLayout: direct children side by side. verticalLayout: direct children stacked (both: gap?: none|small|medium|large; default medium).
form: a form container with an accessible name (label).

Include every positively requested control, its correct type, label, properties, order and grouping. Repeated controls remain separate. Preserve supplied literal wording, numbers and booleans, including false; omit unspecified optional props. Text describing a control cannot replace that control. Apply exclusions only to what they prohibit; retain the other positive requirements. UI without authentication or network activity is supported; a request to implement those behaviors is not.

Use form for a requested form. Forms cannot contain other forms, even through layouts. Every submit/reset button must have a form ancestor. Select the button type from the requested action; ordinary buttons use button.

Build the shallowest tree that preserves requested spacing and relationships. Fields already include their label/input presentation; do not add wrappers or text labels for them. A form can contain controls directly. Use a row for a meaningful side-by-side group, and a column for meaningful stacking. Place a following lower item outside the row, after the entire group. Avoid single-child and repeated-direction wrappers unless needed for the requested layout.

Use only these ten components and their props. Required/disabled are booleans; maxLength is an integer 1-1000. Labels/placeholders are nonblank literal text up to 200 characters; content up to 1000. No markup, expressions, JSX, JavaScript, imports, handlers, styles, or text containing angle brackets, braces, backticks or arrow syntax. Maximum 100 total nodes and depth 6, counting the root as 1.

If a required widget cannot be expressed by this reference, return {"irVersion":"1","status":"unsupported","reason":"unsupported-component"} for the entire request. For required real authentication, persistence, network operations or executable behavior, use reason unsupported-behavior instead. Do not silently substitute or drop unsupported requirements.

Before returning JSON, check all positive requirements, exclusions, form ancestry and layout relationships separately. Do not output this check.`;
