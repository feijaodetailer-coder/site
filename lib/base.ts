/** Prefixo do GitHub Pages (ex.: "/site"); vazio em desenvolvimento local e em domínio próprio. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** Endereço de arquivos de `public/` e de páginas, que o Next não prefixa sozinho em <a>/<img>. */
export const withBase = (path: string) => `${BASE_PATH}${path}`;
