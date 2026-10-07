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

### Domínio próprio e produção

Depois do primeiro deploy:

1. Na Vercel, abra **Project > Settings > Domains**, adicione o domínio e siga exatamente os registros DNS exibidos para o domínio raiz e para `www`.
2. No registrador do domínio, remova registros conflitantes e mantenha apenas os registros indicados pela Vercel. O HTTPS é provisionado automaticamente após a validação do DNS.
3. Defina `NEXT_PUBLIC_APP_URL` como a URL canônica final, por exemplo `https://www.seudominio.com.br`, e faça novo deploy. Essa URL é usada nos retornos do checkout e nas notificações de pagamento.
4. No Supabase, em **Authentication > URL Configuration**, defina **Site URL** para a mesma URL e adicione as URLs de redirecionamento usadas pelo site, incluindo `https://www.seudominio.com.br/**`.
5. Em **Authentication > SMTP Settings**, configure um SMTP autorizado pelo domínio. Use o mesmo remetente em `SMTP_FROM` e publique no DNS os registros SPF, DKIM e DMARC fornecidos pelo provedor de e-mail.
6. No Mercado Pago, configure a URL de notificações como `https://www.seudominio.com.br/api/mercadopago-webhook` e mantenha `MP_ACCESS_TOKEN` apenas nas variáveis da Vercel. Se o painel fornecer uma assinatura de webhook, salve-a em `MP_WEBHOOK_SECRET`.
7. No Stripe, se ele estiver habilitado, configure o endpoint `https://www.seudominio.com.br/api/stripe-webhook`, habilite os eventos usados pelo checkout e salve o segredo de assinatura em `STRIPE_WEBHOOK_SECRET`.
8. Execute `scripts/commerce.sql` e `scripts/leads.sql` no SQL Editor do projeto Supabase antes de testar cadastro, carrinho, pedidos, cupons, avaliações e leads. Se a loja já estiver em produção, execute novamente o `scripts/commerce.sql` atualizado para adicionar os campos de tipo de peça e Part Number do fabricante ao catálogo. Classifique os produtos já cadastrados na edição de cada produto; os novos campos não alteram a classificação automaticamente.
9. Se for usar etiquetas, preencha as credenciais de produção dos Correios e confirme a autenticação em `https://www.seudominio.com.br/api/correios-status` usando uma sessão administrativa.

#### Variáveis mínimas

Para o site abrir e o catálogo funcionar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALPHA_MASTER_USER`, `ALPHA_MASTER_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_WHATSAPP_NUMBER`.

Para a operação completa, acrescente as variáveis SMTP, Mercado Pago e Correios listadas em `.env.example`. As chaves `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, segredos de webhook e senha do administrador nunca devem receber o prefixo `NEXT_PUBLIC_`.

#### Teste de aceite antes de divulgar o domínio

- abrir o domínio com HTTPS e testar também `www` e o domínio raiz;
- cadastrar, entrar, sair e recuperar a senha de um cliente;
- cadastrar produto no admin e confirmar estoque, imagem e preço no catálogo;
- cotar CEP, montar carrinho e criar um pedido de teste;
- confirmar o retorno e o webhook do gateway escolhido;
- criar um cupom, enviar um orçamento e verificar o recebimento do e-mail;
- conferir o status dos Correios e o rastreio, caso essa integração esteja contratada.

Não coloque `.env.local`, tokens ou documentos de clientes no GitHub. O domínio pode ser comprado no registrador de sua preferência, mas a hospedagem e o DNS precisam apontar para o projeto correto na Vercel.

O envio automático dos orçamentos usa SMTP e envia para os destinatários configurados em `lib/store-config.ts`. Sem as variáveis SMTP, o PDF continua funcionando, mas o e-mail não é enviado.

O acesso do cliente usa e-mail e senha pelo Supabase. A recuperação de senha envia um código temporário por SMTP; configure as variáveis SMTP na Vercel e execute a tabela `password_reset_codes` do `scripts/commerce.sql` no Supabase.

## Código de acesso por e-mail

O cadastro e o login usam código de uso único (OTP). No Supabase, configure um SMTP em `Project Settings > Authentication > SMTP Settings` e confirme que o remetente está autorizado. Depois abra `Authentication > Emails > Email Templates > Magic Link` e mantenha `{{ .Token }}` no corpo do e-mail, por exemplo: `Seu código Alpha Tec é {{ .Token }}`. Sem `{{ .Token }}`, o Supabase pode enviar somente o link e a tela não terá um código numérico para confirmar. Verifique também spam/lixo eletrônico e o limite de envio em `Authentication > Rate Limits`.

## Fluxo de compra

### Pagamentos e avaliações na vitrine

A página inicial apresenta Pix e cartão de crédito depois das peças em destaque. Os meios de pagamento também aparecem junto à compra na página do produto, no carrinho, no checkout e em uma coluna própria do rodapé. São as opções atuais do checkout, sem prometer aprovação, bandeiras ou certificações não verificadas.

O banner usa somente os produtos marcados como **Banner** no admin, com navegação manual acessível (sem troca automática). A mensagem de suporte permanece visível ao lado; sem produtos selecionados, o banner explica como identificar a peça. Os destaques continuam respeitando a seleção **Destaque** no admin. Vitrine e catálogo compartilham cards com foto inteira sobre fundo branco, preço, estoque, referência do fabricante quando cadastrada e resumo de compatibilidade. Falhas de carregamento exibem erro e nova tentativa; fotos ausentes ou quebradas não são substituídas pelo logotipo como se fosse uma peça.

Os filtros de equipamento e tipo de peça no catálogo podem ser combinados com a busca. A classificação continua dependendo dos campos cadastrados no admin; não é inferida pelo nome da peça.

A página inicial consulta `/api/reviews?scope=store` e mostra até seis avaliações recentes de pedidos entregues, incluindo as fotos enviadas pelos compradores. O total inclui todos os pedidos entregues avaliados, sem selecionar apenas notas positivas. Os nomes são abreviados e não são publicados IDs de pedidos nem contatos dos clientes. Se não houver avaliações, a loja informa isso e convida compradores a avaliar; em caso de erro, exibe uma mensagem com opção de tentar novamente.

O cliente pode abrir um produto, adicionar ao carrinho, informar o CEP para cotar o frete, revisar o pedido e preencher o checkout em `/checkout`. O fluxo de pagamento agora inclui uma opção Stripe para cartão, com fallback para PIX e cartão em modo de teste caso o gateway não esteja habilitado. Para levar a compra para produção, configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NEXT_PUBLIC_APP_URL` na Vercel e valide o checkout em ambiente real.

Antes do primeiro deploy, substitua as imagens externas por imagens reais em `public/` e confirme as coordenadas de atendimento em `lib/store-config.ts`. O domínio próprio precisa ser comprado e conectado na Vercel; ele não pode ser criado automaticamente pelo projeto.

## Imagens de produtos

### Favicon e ícone da loja

O símbolo simplificado está em `public/brand-mark.svg`. Execute `npm run icons:generate` após alterar esse desenho para regenerar PNGs de 48, 96, 192 e 512 px, o Apple Touch Icon de 180 px e o ICO com imagens de 16, 32 e 48 px. A vitrine declara o PNG de 192 px como favicon; o logotipo completo permanece no cabeçalho. Os ícones do aplicativo administrativo são independentes e não foram alterados.

Após publicar, solicite nova indexação da página inicial no Google Search Console, tanto para o domínio raiz quanto para `www` se ambos forem usados. O arquivo do favicon deve continuar acessível ao Googlebot-Image, com URL estável. A atualização no Google pode levar dias ou semanas e não é garantida imediatamente. Referência: https://developers.google.com/search/docs/appearance/favicon-in-search.

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
