import React, { useState } from 'react';
import {
  Utility,
  Label,
  InputContainer,
  Input,
  Button,
  SectionMessage,
  SectionMessageIcon,
  SectionMessageContent,
  SectionMessageCloseButton,
  Typography,
  UtilityFragment,
} from '@visa/nova-react';

interface Props {
  showDate: boolean;
  showTime: boolean;
}

const DateTimePreview: React.FC<Props> = ({ showDate, showTime }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const [dateSet, setDateSet] = useState(false);
  const [timeSet, setTimeSet] = useState(false);

  const handleSet = () => {
    
    if (showDate && date) setDateSet(true);
    if (showTime && time) setTimeSet(true);
  };

  return (
    <Utility vFlex vFlexCol vGap={16} style={{ width: '100%', maxWidth: '400px' }}>
      {/* Date selector */}
      {showDate && (
        <Utility vFlex vFlexCol vGap={4}>
          <Label htmlFor="dt-date">Date (required)</Label>
          <InputContainer>
            <Input
              id="dt-date"
              type="date"
              value={date}
              onChange={(e) => setDate((e.target as HTMLInputElement).value)}
            />
          </InputContainer>
        </Utility>
      )}

      {/* Time selector */}
      {showTime && (
        <Utility vFlex vFlexCol vGap={4}>
          <Label htmlFor="dt-time">Time (required)</Label>
          <InputContainer>
            <Input
              id="dt-time"
              type="time"
              value={time}
              onChange={(e) => setTime((e.target as HTMLInputElement).value)}
            />
          </InputContainer>
        </Utility>
      )}

      {/* Set button */}
      <Button
        buttonSize="large"
        onClick={handleSet}
        disabled={(showDate && !date) || (showTime && !time)}
      >
        Set
      </Button>

      {/* Date confirmation */}
      {dateSet && (
        <SectionMessage>
          <SectionMessageIcon />
          <UtilityFragment vPaddingLeft={2} vPaddingBottom={2}>
            <SectionMessageContent>
              <Typography>Date has been set to {date}.</Typography>
            </SectionMessageContent>
          </UtilityFragment>
          <SectionMessageCloseButton onClick={() => setDateSet(false)} />
        </SectionMessage>
      )}

      {/* Time confirmation */}
      {timeSet && (
        <SectionMessage>
          <SectionMessageIcon />
          <UtilityFragment vPaddingLeft={2} vPaddingBottom={2}>
            <SectionMessageContent>
              <Typography>Time has been set to {time}.</Typography>
            </SectionMessageContent>
          </UtilityFragment>
          <SectionMessageCloseButton onClick={() => setTimeSet(false)} />
        </SectionMessage>
      )}
    </Utility>
  );
};

export default DateTimePreview;