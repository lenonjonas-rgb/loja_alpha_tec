# Alpha Tec

Projeto inicial da loja Alpha Tec — scaffold Next.js + TypeScript + Tailwind.

Passos para rodar localmente (requer Node.js e npm/yarn):

```bash
npm install
npm run dev
```

Se `npx`/`create-next-app` não estiver disponível no ambiente, este scaffold já fornece os arquivos principais; instale dependências localmente.

## Publicação na Vercel

1. Envie este projeto para um repositório no GitHub.
2. Importe o repositório em https://vercel.com/new.
3. Na Vercel, abra **Settings > Environment Variables** e cadastre as variáveis de `.env.example`.
4. Faça um novo deploy.

O envio automático dos orçamentos usa SMTP e envia para os destinatários configurados em `lib/store-config.ts`. Sem as variáveis SMTP, o PDF continua funcionando, mas o e-mail não é enviado.

O login com Google usa OAuth. No Google Cloud Console, crie uma credencial **OAuth Client ID** do tipo aplicação Web e adicione os callbacks `http://localhost:3000/api/auth/callback/google` e `https://SEU-DOMINIO.vercel.app/api/auth/callback/google`. Cadastre `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL` e `NEXTAUTH_SECRET` nas variáveis da Vercel.

## Código de acesso por e-mail

O cadastro e o login usam código de uso único (OTP). No Supabase, configure um SMTP em `Project Settings > Authentication > SMTP Settings` e confirme que o remetente está autorizado. Depois abra `Authentication > Emails > Email Templates > Magic Link` e mantenha `{{ .Token }}` no corpo do e-mail, por exemplo: `Seu código Alpha Tec é {{ .Token }}`. Sem `{{ .Token }}`, o Supabase pode enviar somente o link e a tela não terá um código numérico para confirmar. Verifique também spam/lixo eletrônico e o limite de envio em `Authentication > Rate Limits`.

## Fluxo de compra

O cliente pode abrir um produto, adicionar ao carrinho, informar o CEP para cotar o frete, revisar o pedido e preencher o checkout em `/checkout`. O fluxo de pagamento agora inclui uma opção Stripe para cartão, com fallback para PIX e cartão em modo de teste caso o gateway não esteja habilitado. Para levar a compra para produção, configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NEXT_PUBLIC_APP_URL` na Vercel e valide o checkout em ambiente real.

Antes do primeiro deploy, substitua as imagens externas por imagens reais em `public/` e confirme as coordenadas de atendimento em `lib/store-config.ts`. O domínio próprio precisa ser comprado e conectado na Vercel; ele não pode ser criado automaticamente pelo projeto.

## Imagens de produtos

Coloque as imagens originais em `images-inbox/`. Formatos aceitos: JPG, JPEG, PNG e WEBP.

Para processar as imagens uma vez:

```bash
npm run images:process
```

As versões otimizadas serão salvas automaticamente em `public/images/products/`, com largura ou altura máxima de 1200 px, correção de orientação e formato WEBP. Para deixar o processamento observando a pasta enquanto você trabalha:

```bash
npm run images:watch
```

As imagens originais permanecem em `images-inbox/`; não coloque senhas ou documentos pessoais nessa pasta.

Para cadastrar automaticamente uma peça no catálogo, use este padrão no nome do arquivo:

```text
Nome da peça (equipamento compatível 1, equipamento compatível 2) {Descrição detalhada da peça}.png
```

Exemplo:

```text
Inversor Movement (Esteira Movement, Esteira LX) {Componente eletrônico para controle de velocidade e potência}.png
```

O nome, os equipamentos compatíveis e a descrição serão exibidos no catálogo e na página de detalhes. Depois de colocar o arquivo em `images-inbox/`, execute `npm run images:process`.
