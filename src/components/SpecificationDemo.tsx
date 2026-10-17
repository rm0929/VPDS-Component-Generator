import { Typography, Utility } from '@visa/nova-react';
import registrationJson from '../specification/fixtures/registration-form.json?raw';
import { uiSpecificationSchema } from '../specification/uiSpecification';
import { UiSpecificationPreview } from '../specification/UiSpecificationPreview';
import { generateTsx } from '../specification/generateTsx';
import LivePreview from './LivePreview';
import OutputPanel from './OutputPanel';

const specification = uiSpecificationSchema.parse(JSON.parse(registrationJson));
const code = generateTsx(specification);

export default function SpecificationDemo() {
  return (
    <Utility id="generator" tag="section" vFlex vFlexCol vGap={16} vAlignItems="center" vPadding={24}>
      <Typography tag="h2" variant="headline-2">UI specification demo</Typography>
      <Typography>This sample form is a local preview. It does not create an account or send form data.</Typography>
      <a href="?">Back to keyword generator</a>
      <LivePreview><UiSpecificationPreview specification={specification} /></LivePreview>
      <OutputPanel code={code} />
    </Utility>
  );
}
