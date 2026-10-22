import { Typography, Utility } from '@visa/nova-react';
import registrationJson from '@vpds/ui-specification/fixtures/registration-form.json?raw';
import { uiSpecificationSchema } from '@vpds/ui-specification/uiSpecification';
import { UiSpecificationPreview } from '@vpds/ui-specification/UiSpecificationPreview';
import { generateTsx } from '@vpds/ui-specification/generateTsx';
import LivePreview from '../components/LivePreview';
import OutputPanel from '../components/OutputPanel';

const specification = uiSpecificationSchema.parse(JSON.parse(registrationJson));
const code = generateTsx(specification);

export default function SpecificationDemo() {
  return (
    <Utility id="generator" tag="section" vFlex vFlexCol vGap={16} vAlignItems="center" vPadding={24}>
      <Typography tag="h2" variant="headline-2">UI specification demo</Typography>
      <Typography>This sample form is a local preview. It does not create an account or send form data.</Typography>
      <a href="?#generator">Back to AI generator</a>
      <LivePreview><UiSpecificationPreview specification={specification} /></LivePreview>
      <OutputPanel code={code} />
    </Utility>
  );
}
