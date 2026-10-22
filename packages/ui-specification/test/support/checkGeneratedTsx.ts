import ts from 'typescript';
import { resolve } from 'node:path';

/** Parse/type-check as data against installed React/Nova; never emit or execute code. */
export function checkGeneratedTsx(sources: string[]) {
  const files = new Map(sources.map((source, index) => [resolve(__dirname, `__poc_generated_${index}.tsx`), source]));
  const options: ts.CompilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    strict: true, noUnusedLocals: true, noUnusedParameters: true, skipLibCheck: true, noEmit: true, types: ['react', 'react-dom'] };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => {
    const source = files.get(filename);
    return source === undefined ? original(filename, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(filename, source, languageVersion, true, ts.ScriptKind.TSX);
  };
  return ts.getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host));
}
