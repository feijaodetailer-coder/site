# Como preparar a publicacao no Vercel

Este guia vale para a copia atual do projeto. Ela precisa estar no repositorio do GitHub antes de importar o projeto no Vercel.

## Na tela New Project

- Repositorio: `feijaodetailer-coder/site`
- Nome do projeto: pode deixar `site`
- Root Directory: `./`
- Application Preset: `Next.js`
- Build Command: deixe o valor detectado pelo Vercel (`npm run build`)
- Output Directory: deixe a deteccao automatica

Antes de criar o projeto, expanda **Environment Variables** e cadastre as duas variaveis abaixo para **Production** e **Preview**:

| Nome | Onde copiar o valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> projeto Feijao Detailer Login -> Project Settings -> API -> Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase -> Project Settings -> API Keys -> publishable key (comeca com `sb_publishable_`) |

A chave publishable pode ser usada no navegador; nao copie chaves chamadas `secret` ou `service_role`. As variaveis `NEXT_PUBLIC_*` sao incluidas no site durante o build, entao so devem conter valores que podem ser publicos.

## Depois da primeira publicacao

1. Copie o dominio de producao atribuido pelo Vercel.
2. No Supabase, ajuste **Authentication -> URL Configuration** para usar esse dominio como Site URL e permita o endereco de retorno do dominio.
3. Atualize o segredo `ALLOWED_ORIGINS` da Edge Function `api` no Supabase para incluir exatamente `https://SEU-DOMINIO.vercel.app`.
4. A Edge Function `api` precisa estar publicada antes de usar agendamentos, login da gestao, anexos e outras funcoes que salvam dados. A publicacao esta pendente de preparar e revisar o codigo do backend.

## Atencao ao GitHub Pages

O projeto tambem conserva o workflow do GitHub Pages. Ele define `/site` automaticamente; o Vercel publica o mesmo conteudo na raiz do dominio. Alteracoes feitas somente na copia local ainda precisam ser enviadas ao GitHub para o Vercel recebe-las.
