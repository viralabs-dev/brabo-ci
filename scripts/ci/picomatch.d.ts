// Sem @types/picomatch (evita dependência nova): só o que a seleção usa.
declare module 'picomatch' {
  export default function picomatch(glob: string | string[], opcoes?: { dot?: boolean }): (arquivo: string) => boolean;
}
