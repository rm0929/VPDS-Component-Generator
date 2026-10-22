import type { ReactElement } from 'react';
import { Footer, InputControl, Badge, Button, Checkbox, ContentCard, ContentCardBody, ContentCardTitle, Divider, Input, InputContainer, Label, Link, ProgressLabel, ProgressLinear, Radio, Select, Switch, SwitchLabel, Textarea, Typography, Utility } from '@visa/nova-react';
import { VisaCardGenericLow } from '@visa/nova-icons-react';
import { DialogExample } from './interactions/DialogExample';
import { FlagExample } from './interactions/FlagExample';
import { buildPresentation } from './presentation';
import type { PresentationElement } from './presentation';
import type { UiSpecification } from './uiSpecification';

function renderElement(element: PresentationElement, key = 'root'): ReactElement {
  const children = element.children.map((child, index) =>
    typeof child === 'string' ? child : renderElement(child, String(index)));

  // Only trusted imports and props constructed after validation reach React.
  switch (element.tag) {
    case 'DialogExample': return <DialogExample key={key} {...element.props} />;
    case 'FlagExample': return <FlagExample key={key} {...element.props} />;
    case 'Footer': return <Footer key={key} {...element.props}>{children}</Footer>;
    case 'InputControl': return <InputControl key={key}>{children}</InputControl>;
    case 'VisaCardGenericLow': return <VisaCardGenericLow key={key} {...element.props} />;
    case 'details': return <details key={key}>{children}</details>;
    case 'summary': return <summary key={key}>{children}</summary>;
    case 'nav': return <nav key={key} {...element.props}>{children}</nav>;
    case 'ul': return <ul key={key}>{children}</ul>;
    case 'li': return <li key={key}>{children}</li>;
    case 'Utility': return <Utility key={key} {...element.props}>{children}</Utility>;
    case 'Label': return <Label key={key} {...element.props}>{children}</Label>;
    case 'InputContainer': return <InputContainer key={key}>{children}</InputContainer>;
    case 'Input': return <Input key={key} {...element.props} />;
    case 'Checkbox': return <Checkbox key={key} {...element.props} />;
    case 'Textarea': return <Textarea key={key} {...element.props} />;
    case 'Select': return <Select key={key} {...element.props}>{children}</Select>;
    case 'option': return <option key={key} {...element.props}>{children}</option>;
    case 'fieldset': return <fieldset key={key} {...element.props}>{children}</fieldset>;
    case 'legend': return <legend key={key}>{children}</legend>;
    case 'Radio': return <Radio key={key} {...element.props} />;
    case 'ContentCard': return <ContentCard key={key} {...element.props}>{children}</ContentCard>;
    case 'ContentCardBody': return <ContentCardBody key={key}>{children}</ContentCardBody>;
    case 'ContentCardTitle': return <ContentCardTitle key={key} {...element.props}>{children}</ContentCardTitle>;
    case 'ProgressLabel': return <ProgressLabel key={key} {...element.props}>{children}</ProgressLabel>;
    case 'ProgressLinear': return <ProgressLinear key={key} {...element.props} />;
    case 'Switch': return <Switch key={key} {...element.props} />;
    case 'SwitchLabel': return <SwitchLabel key={key} {...element.props}>{children}</SwitchLabel>;
    case 'Badge': return <Badge key={key} {...element.props}>{children}</Badge>;
    case 'Divider': return <Divider key={key} {...element.props} />;
    // Preview containment only. Copied TSX retains its validated destination
    // without these fixed handlers, so it behaves as a normal link in a host app.
    case 'Link': return <Link key={key} {...element.props} onClick={event => event.preventDefault()}
      onAuxClick={event => event.preventDefault()}>{children}</Link>;
    case 'Button': return <Button key={key} {...element.props}>{children}</Button>;
    case 'Typography': return <Typography key={key} {...element.props}>{children}</Typography>;
    case 'form':
      return <form key={key} {...element.props} onSubmit={event => event.preventDefault()}>{children}</form>;
    default: {
      const unsupported: never = element;
      throw new Error(`Unsupported presentation element: ${String(unsupported)}`);
    }
  }
}

export function UiSpecificationPreview({ specification }: { specification: UiSpecification }): ReactElement {
  return renderElement(buildPresentation(specification));
}
