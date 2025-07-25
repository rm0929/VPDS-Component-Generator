import React, { useCallback, useState, useRef } from 'react';
import {
  Button,
  ProgressLabel,
  ProgressLinear,
  UtilityFragment,
  Utility,
} from '@visa/nova-react';

const id = 'determinate-linear-progress';

const DeterminateProgressPreview: React.FC = () => {
  const [value, setValue] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  const countingRef = useRef(false);

  const startCountUp = useCallback(async () => {
    setValue(0);
    countingRef.current = true;
    setTimeout(() => setLoadingMsg('Loading...'), 500);

    for (let i = 0; i < 100; i++) {
      if (!countingRef.current) {
        resetCount();
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
      setValue((prev) => prev + 1);
    }
    setLoadingMsg('Loading complete');
    countingRef.current = false;
  }, []);

  const resetCount = () => {
    countingRef.current = false;
    setValue(0);
    setLoadingMsg('');
  };

  return (
    <Utility vFlex vFlexCol vGap={12} style={{ width: '100%', maxWidth: 400 }}>
      {/* The linear bar */}
      <UtilityFragment vMarginVertical={8}>
        <ProgressLinear id={id} max={100} value={value} />
      </UtilityFragment>

      {/* Label beneath */}
      <ProgressLabel htmlFor={id}>
        <span>Filename.jpg</span>
        <span>{value}%</span>
        <span role="alert" className="v-sr">
          {loadingMsg}
        </span>
      </ProgressLabel>

      {/* Controls */}
      <Utility vMarginVertical={12} vFlex vGap={12}>
        <Button onClick={startCountUp}>Start</Button>
        <Button colorScheme="secondary" onClick={resetCount}>
          Reset
        </Button>
      </Utility>
    </Utility>
  );
};

export default DeterminateProgressPreview;