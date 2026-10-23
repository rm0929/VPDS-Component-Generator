import React from 'react';
import {
  ScreenReader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Utility,
  InputContainer,
  Input,
  Label,
  Button,
} from '@visa/nova-react';

interface TablePreviewProps {
  initialRows?: number;
  initialCols?: number;
}

const TablePreview: React.FC<TablePreviewProps> = ({
  initialRows = 3,
  initialCols = 4,
}) => {
  const [rows, setRows] = React.useState(initialRows);
  const [cols, setCols] = React.useState(initialCols);
  const [submitted, setSubmitted] = React.useState(false);

  // Helpers to parse & constrain input
  const parseNumber = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 1 ? fallback : n;
  };

  const handleGenerateTable = () => {
    setRows(parseNumber((document.getElementById('num-rows') as HTMLInputElement).value, rows));
    setCols(parseNumber((document.getElementById('num-cols') as HTMLInputElement).value, cols));
    setSubmitted(true);
  };

  const headers = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const body = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => `R${r + 1}C${c + 1}`)
  );

  return (
    <Utility vFlex vFlexCol vGap={16} style={{ width: '100%', maxWidth: 600 }}>
      <Utility vFlex vFlexRow vGap={8}>
        <Utility style={{ width: '50%' }}>
          <Label htmlFor="num-rows">Number of Rows</Label>
          <InputContainer>
            <Input id="num-rows" type="number" defaultValue={initialRows} min={1} />
          </InputContainer>
        </Utility>
        <Utility style={{ width: '50%' }}>
          <Label htmlFor="num-cols">Number of Columns</Label>
          <InputContainer>
            <Input id="num-cols" type="number" defaultValue={initialCols} min={1} />
          </InputContainer>
        </Utility>
      </Utility>
      <Button buttonSize="large" onClick={handleGenerateTable}>
        Generate Table
      </Button>

      {submitted && (
        <>
          <Table alternate>
            <ScreenReader tag="caption">
              Table {rows}×{cols}
            </ScreenReader>
            <Thead>
              <Tr>
                {headers.map((h) => (
                  <Th key={h} scope="col">
                    {h}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {body.map((rowData, ri) => (
                <Tr key={ri}>
                  {rowData.map((cell, ci) => (
                    <Td key={ci}>{cell}</Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </>
      )}
    </Utility>
  );
};

export default TablePreview;