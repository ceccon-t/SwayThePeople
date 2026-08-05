/** Build-time constants injected by Vite (see electron.vite.config.ts). */
declare const __APP_VERSION__: string;

/** Image imports resolve to their bundled URL. */
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
