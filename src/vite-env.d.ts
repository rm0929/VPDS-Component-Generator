/// <reference types="vite/client" />

// Allow importing TSX files as raw text
declare module '*.tsx?raw' {
  const src: string;
  export default src;
}
