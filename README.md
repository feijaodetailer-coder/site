# Feijão Detailer — site no GitHub Pages + Supabase

Site estático (Next.js exportado) hospedado no **GitHub Pages**. O banco de dados, o login e os anexos ficam no **Supabase**:

| Peça | Onde roda |
| --- | --- |
| Páginas (`out/`) | GitHub Pages — `https://feijaodetailer-coder.github.io/site/` |
| Regras de negócio (agenda, OS, financeiro, planos…) | Edge Function `api` em [supabase/functions/api](supabase/functions/api) |
| Banco de dados | Postgres do Supabase — esquema em [supabase/migrations](supabase/migrations) |
| Login do cliente (WhatsApp + senha) | Supabase Auth (e-mail/senha) |
| Login da gestão | Supabase Auth com **Google** |
| Anexos e cópias de segurança diárias | Supabase Storage (buckets privados `attachments` e `backups`) |

O navegador **nunca** acessa as tabelas diretamente: todas têm RLS ligado e nenhuma política, então a chave pública (anon) não lê nem escreve nada. Todo acesso passa pela função `api`, que confere quem está logado e se é o administrador (e-mail em `OWNER_EMAIL`).

## 1. Configurar o Supabase (uma vez)

Pré-requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` ou `npx supabase`) e login com `supabase login`.

```bash
supabase link --project-ref SEU-PROJECT-REF      # o código aparece na URL do projeto
supabase db push                                  # cria as tabelas e os buckets de arquivos
supabase secrets set OWNER_EMAIL=seu-email@gmail.com
supabase secrets set ALLOWED_ORIGINS=https://feijaodetailer-coder.github.io   # opcional, recomendado
supabase functions deploy api                     # config.toml já desliga a verificação de JWT (o site público é anônimo)
```

`OWNER_EMAIL` é o e-mail Google do administrador (aceita vários, separados por vírgula). `ALLOWED_ORIGINS` limita quais sites podem chamar a função (acrescente `http://localhost:3000` para testar localmente).

No painel do Supabase:

1. **Authentication → Providers → Google**: ative e informe o *Client ID/Secret* criados no [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo *Aplicativo da Web*). Em *URIs de redirecionamento autorizados* use a *Callback URL* mostrada pelo Supabase (`https://SEU-PROJETO.supabase.co/auth/v1/callback`).
2. **Authentication → URL Configuration**: *Site URL* = `https://feijaodetailer-coder.github.io/site/` e, em *Redirect URLs*, adicione `https://feijaodetailer-coder.github.io/site/**` (e `http://localhost:3000/**` para testes).
3. **Authentication → Providers → Email**: deixe o e-mail/senha ativo e **desligue "Confirm email"**. Os clientes entram com WhatsApp + senha, usando um e-mail técnico (`cliente-<telefone>@auth.feijaodetailer.invalid`) que não recebe mensagens.

O catálogo de serviços é criado automaticamente no primeiro acesso (banco começa vazio, só com o catálogo padrão). A primeira entrada da gestão (botão **Acesso da gestão**) deve ser feita com o e-mail definido em `OWNER_EMAIL`.

## 2. Informar o projeto ao site

Preencha o endereço do projeto e a chave **pública** (Project Settings → API → *anon* / *publishable*) em [lib/supabase-config.ts](lib/supabase-config.ts), ou use as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (veja [.env.example](.env.example)). Essa chave é feita para ficar no navegador; **jamais** coloque a `service_role` no site.

## 3. Publicar no GitHub Pages

Repositório de destino: `feijaodetailer-coder/site` (publicação manual).

- **Com GitHub Actions** (recomendado): em *Settings → Pages*, escolha *Source: GitHub Actions* e crie as *Variables* `SUPABASE_URL` e `SUPABASE_ANON_KEY` em *Settings → Secrets and variables → Actions*. O workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) roda os testes, gera o site e publica a cada push na `main`.
- **Manual**: `npm ci && npm run build` gera a pasta `out/` (já com `.nojekyll`); publique o conteúdo dela na branch usada pelo Pages.

O build usa o prefixo `/site` (nome do repositório). Em outro endereço, defina `NEXT_PUBLIC_BASE_PATH` (vazio para domínio próprio).

## Desenvolvimento

```bash
npm ci
npm run dev          # http://localhost:3000 (sem prefixo; usa o Supabase configurado)
npm run typecheck
npm test             # lib/ + a Edge Function inteira contra um Postgres em memória (PGlite)
npm run build        # gera out/
```

Os testes de [supabase/tests](supabase/tests) executam o roteador e todos os handlers da função `api` sobre o esquema real das migrações, cobrindo agendamento público, conflitos de horário, OS, financeiro, planos, anexos e isolamento entre clientes.

## Estrutura

- `app/`, `components/`, `lib/` — interface (cliente). `lib/api.ts` chama a função `api`; `lib/supabase.ts` é o cliente de login.
- `supabase/functions/api/` — rotas (`workflow`, `data`, `public`, `finance`, `files`, `backups`, `site-settings`, `session`, `customer-auth`).
- `supabase/functions/_shared/` — regras puras usadas pelo site **e** pela função (financeiro, agenda, campanhas, catálogo). `lib/*.ts` apenas reexporta esses arquivos.
- `supabase/migrations/` — esquema do banco.

## Observações de segurança

- Dados pessoais ficam só no Supabase; o repositório público contém apenas código e a chave pública.
- Cada cliente enxerga apenas os próprios registros; a gestão só abre para o e-mail em `OWNER_EMAIL` com login Google confirmado.
- Anexos são privados e baixados pela função com o login do usuário (não há links públicos).
