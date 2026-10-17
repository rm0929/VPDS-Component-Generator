import type { ReactElement } from 'react';
import { Button, Checkbox, Input, InputContainer, Label, Typography, Utility } from '@visa/nova-react';
import { buildPresentation } from './presentation';
import type { PresentationElement } from './presentation';
import type { UiSpecification } from './uiSpecification';

function renderElement(element: PresentationElement, key = 'root'): ReactElement {
  const children = element.children.map((child, index) =>
    typeof child === 'string' ? child : renderElement(child, String(index)));

  // Only trusted imports and props constructed after validation reach React.
  switch (element.tag) {
    case 'Utility': return <Utility key={key} {...element.props}>{children}</Utility>;
    case 'Label': return <Label key={key} {...element.props}>{children}</Label>;
    case 'InputContainer': return <InputContainer key={key}>{children}</InputContainer>;
    case 'Input': return <Input key={key} {...element.props} />;
    case 'Checkbox': return <Checkbox key={key} {...element.props} />;
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
