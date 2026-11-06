# Alpha Tec

Projeto inicial da loja Alpha Tec — scaffold Next.js + TypeScript + Tailwind.

Passos para rodar localmente (requer Node.js e npm/yarn):

```bash
npm install
npm run dev
```

Se `npx`/`create-next-app` não estiver disponível no ambiente, este scaffold já fornece os arquivos principais; instale dependências localmente.

## Posts para Instagram

Para produto único, o modelo padrão “Foto ampliada + logo + site” mostra a foto preenchendo um quadro quadrado, a logo e a chamada para a loja. Quando um cupom cadastrado e ativo é informado, a arte e a legenda incluem “Use o cupom” com o código, o benefício e o limite de clientes cadastrado; o quadro da foto reserva espaço para essa chamada. Sem cupom válido, o modelo permanece limpo. A foto mantém as proporções; bordas de imagens não quadradas podem ser recortadas para preencher o quadro. Uma imagem válida é obrigatória para exportar esse modelo. O modelo “Produto com informações técnicas” continua disponível no seletor.

As artes de feed do painel administrativo usam a logo de `public/brand-logo.svg` nos formatos 1080×1350 e 1080×1080. Posts de produto e de categoria não exibem preços na arte nem na legenda gerada; a chamada “Confira no site” direciona para www.lojaalphatec.com.br. Cupons cadastrados continuam disponíveis. A geração aguarda o carregamento da logo, e falhas são informadas no painel. Reels e vídeos para o site mantêm seu comportamento.

Em **Posts > Reel de produto**, escolha **Enviar vídeo** ou **Editar para site**.
Envie o arquivo, selecione início e fim do corte em segundos e ajuste ampliação
e posição horizontal/vertical. A prévia repete o trecho escolhido; a exportação
grava somente esse trecho, sem áudio e em tempo real. Mantenha a tela aberta.
O arquivo pode incluir um breve quadro inicial de preparação do codificador;
a duração final pode, portanto, superar a duração do trecho selecionado.
O formato de saída é 1080×1920 para Reels ou 1200×1200 para o site.
MP4 depende do suporte do navegador/WebView; quando somente WebM estiver
disponível, converta para MP4 antes de publicar no Instagram.
O arquivo não é vinculado automaticamente ao cadastro do produto.

## Editor de mídia para cadastro de produtos

Em **Editor de mídia** (níveis Administrativo e Master), envie a foto ou o
vídeo original da peça para gerar a mídia padronizada 1200×1200 usada no
cadastro: produto centralizado com proporções preservadas, fundo cinza
técnico e sombra suave — o mesmo padrão do vídeo de produto para o site.
Para fotos, a opção **Trocar fundo com IA** (ligada por padrão) recorta o
produto com um modelo de IA que roda no próprio navegador/app (biblioteca
carregada de cdn.jsdelivr.net e modelo de staticimgly.com; o primeiro uso
baixa ~40 MB, depois fica em cache; sem custo por imagem) e o posiciona
sobre o fundo padrão da marca (`public/product-backdrop.jpg`: cinza-claro
com desenhos técnicos em grafite e ferramentas em vermelho escuro) com
sombra suave. Desligando a opção, a foto original é apenas enquadrada.
Para vídeos, ligue **Trocar fundo com IA** e use **Processar trecho com IA**:
a IA recorta o produto quadro a quadro (12 qps, trecho de até 10 s, de
preferência em aparelho com GPU/WebGPU) e a prévia e a exportação passam a
usar o fundo padrão da marca com as mesmas sombras. Alterar o corte exige
novo processamento; o processamento deve ser feito com a tela aberta.
Ajuste ampliação (1×–2,6×) e posição horizontal/vertical; para vídeos,
selecione início e fim do corte em segundos e a velocidade (normal, 0,75×,
0,5× ou 0,25× para câmera lenta — o vídeo final fica proporcionalmente mais
longo). Fotos são exportadas em PNG e
vídeos são gravados em tempo real, sem áudio (MP4 quando o navegador
suportar; caso contrário, WebM). Fotos padronizadas podem ser salvas
diretamente em um produto cadastrado, como foto principal (substitui a
atual) ou na galeria; vídeos continuam sendo exportados como arquivo.

## Galeria de fotos do produto

Cada produto tem uma foto principal e até 5 fotos adicionais. Na aba
**Produtos**, edite o produto para enviar várias fotos de uma vez, remover
fotos da galeria ou promover uma foto adicional a principal. Na página do
produto, as fotos aparecem como miniaturas clicáveis abaixo da foto em
destaque. A galeria usa a coluna `extra_image_urls`; execute
`scripts/commerce.sql` no Supabase para criá-la em bancos existentes.

No navegador, PNG e vídeos são baixados. No app atualizado, abre-se o
compartilhamento nativo para escolher onde salvar/enviar (máximo de 32 MB
por arquivo). APKs antigos mostram uma orientação para atualizar, sem
simular sucesso. A nova integração exige publicar o painel e instalar um
novo APK; atualizar apenas o site não adiciona módulos nativos ao app.

**Ideias para posts mais atrativos** oferece sugestões de close de detalhes,
manutenção e produto em movimento. **Usar ideia** preenche a chamada e o
gancho do Reel e acrescenta um gancho à legenda do feed, sem alterar o layout
da foto nem inventar especificações ou descontos.
Testes: `node --test tests/admin-promotions.test.cjs tests/promotion-media.test.cjs`.

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

#### Entrega automática pelos Correios (Webhook)

O endpoint `POST /api/correios-webhook` recebe avisos `wh-rastro` de entrega
(`BDE-1`, `BDI-1`, `BDR-1`). Valida `x-correios-signature` com HMAC SHA-256
sobre o corpo original e exige o contrato de `CORREIOS_CONTRATO`.
Pedidos com transportadora Correios, rastreio correspondente e status
confirmado, em separação ou enviado passam para entregue. Pedidos cancelados
ou já entregues não são alterados; pagamento não é modificado.
A data informada pelos Correios é preservada. Datas sem fuso são interpretadas
como UTC-03:00. Atualização e notificação ao cliente são transacionais;
reenvios não repetem notificações.

Ativação em produção:

O contrato precisa ter o serviço **85863**, vinculado à API **534 — SRO -
Rastro - Async**. Acesso à documentação ou à consulta de `wh-rastro` no CWS
não comprova essa habilitação. Se o cadastro retornar `HOO-154`, solicite aos
Correios a inclusão do serviço no contrato antes de prosseguir.

1. Execute [scripts/correios-delivery.sql](scripts/correios-delivery.sql) no SQL
   Editor do Supabase, após o schema de comércio. A função só pode ser
   executada por `service_role`.
2. Gere um segredo aleatório forte de 40 caracteres (por exemplo, 20 bytes
   aleatórios em hexadecimal); os Correios aceitam de 8 a 40 caracteres.
   Configure `CORREIOS_WEBHOOK_SECRET` apenas no servidor da Vercel, junto de
   `CORREIOS_CONTRATO`. Publique novamente após definir ou alterar o segredo.
3. Com token de contrato no CWS, consulte
   `GET /webhook/v1/servicos/wh-rastro/assinaturas` antes de criar uma assinatura,
   para não duplicar integrações existentes.
4. Cadastre uma assinatura pelo
   `POST /webhook/v1/servicos/wh-rastro/assinaturas`, com descrição, e-mail
   responsável, `language: "PT"` e `enderecos` contendo `nome`, a URL HTTPS
   canônica `https://SEU-DOMINIO/api/correios-webhook`, o mesmo `secret` e
   `tipoEventos: [{"tipo":"BDE-1"},{"tipo":"BDI-1"},{"tipo":"BDR-1"}]`.
   Não use URLs que redirecionam, nem exponha o segredo em links ou no Git.
5. Execute o teste oficial da assinatura e confira o payload recebido antes
   de considerar a integração ativa. O parser aceita lista de objetos SRO
   (direta ou no campo `objetos`), com `codObjeto` e `eventos` contendo
   `codigo`, `tipo` e `dtHrCriado`. Formatos inesperados geram log e HTTP 500
   para permitir retentativas; não são confirmados silenciosamente.
6. Valide uma entrega de teste, incluindo a data, a notificação e o reenvio
   do mesmo evento. Confirme resposta HTTP 200 sem corpo em até 2 segundos,
   conforme exigido pelos Correios. Monitore erros e latência na hospedagem.

O serviço cobre objetos vinculados ao contrato; não consulta retroativamente
entregas anteriores à assinatura. Rastreios precisam estar cadastrados nos
pedidos. Testes locais: `node --test tests/correios-delivery.test.cjs`.
Referência: [documentação oficial Webhook](https://api.correios.com.br/webhook/v3/api-docs).

#### Mensagens de pedido pelo WhatsApp

Nos detalhes de cada pedido, o botão WhatsApp prepara uma mensagem conforme
o status salvo: pendente, confirmado, em separação, enviado, entregue ou
cancelado. A mensagem de envio inclui a transportadora, o código e o link de
rastreio quando disponíveis. Funciona também em pedidos manuais e acrescenta
o DDI 55 a telefones brasileiros com DDD sem código de país.

O botão pode ser usado novamente a qualquer momento e **não envia sozinho**:
é necessário conferir e enviar no aplicativo. Confirmação agradece a compra;
separação informa a preparação; entrega convida clientes cadastrados a avaliar
com foto, com os pontos definidos no programa (independentemente da nota).
Pedidos manuais sem conta vinculada não prometem pontos inacessíveis.

Na recuperação de carrinhos, "WhatsApp + cupom COMPRA10" libera o código
**COMPRA10** para a conta do cliente, para uma única compra, válido por 7
dias, com desconto de 10% nos produtos (não no frete). Cada cliente tem sua
própria validade e controle de uso, sem depender de um limite global.
A conta precisa ter recebido a oferta para aplicar o código.
"Reabrir mensagem" reutiliza a mensagem já preparada sem criar outro cupom.
Novo clique reutiliza uma oferta válida sem estender seu prazo; uma oferta
expirada e não usada pode ser renovada por mais 7 dias. Uma oferta usada não
é renovada. Cupons antigos continuam válidos até o uso ou vencimento.
A mensagem informa a validade restante em dias, sem data/hora ou observação
sobre frete. O sistema não confirma o envio no aplicativo.

Antes de habilitar a recuperação, execute
[scripts/commerce.sql](scripts/commerce.sql), depois
[scripts/cart-recovery.sql](scripts/cart-recovery.sql) e, por último,
[scripts/compra10.sql](scripts/compra10.sql) no Supabase. Reaplique o último
se reinstalar os scripts anteriores. O RPC de emissão é exclusivo
de `service_role`; a API exige administrador com papel administrativo ou
master. A propriedade do cupom é verificada pela sessão do cliente na
validação e nos dois caminhos de checkout, com proteção adicional no banco.
As ofertas por cliente são privadas (RLS e acesso somente por `service_role`).
O consumo na confirmação do pagamento é transacional, inclusive quando o
administrador marca o pagamento como pago. O identificador do pedido que
usou o cupom é preservado mesmo se o pedido for excluído.

Carrinhos sem itens ou com pedido iniciado/concluído após sua última
atualização não recebem oferta. Pedidos com pagamento pendente continuam
distintos de carrinhos não concluídos: não recebem cupom pelo botão do pedido.
Um cupom novo não altera Pix ou boleto emitido anteriormente.
A contagem da aba Pendente soma os carrinhos exibidos e os pedidos pendentes;
o resumo discrimina cada tipo. A seleção em lote continua exclusiva de pedidos.

O WhatsApp não permite transformar um texto isolado em link com rótulo:
a mensagem de envio mostra o código e a URL clicável do canal oficial.
Transportadoras cujo site exige documento ou nota fiscal abrem a página
oficial, sem prometer preenchimento automático do código. Não há URL de
rastreio inventada para transportadoras desconhecidas.

Testes: `node --test tests/order-whatsapp.test.cjs tests/cart-recovery.test.cjs`.
Para validar as regras transacionais no SQL Editor, execute
[tests/compra10.sql](tests/compra10.sql); os dados sintéticos são
revertidos no final, sem envio de mensagens ou cobranças.

### Avisos de carrinho pendente

O aviso push aos administradores é enviado apenas após **3 horas sem mudança
nos produtos/quantidades e sem pagamento concluído**. O Supabase Cron verifica
a cada 5 minutos, mesmo sem ninguém com o site aberto. Atrasos de execução ou
de entrega push podem aumentar esse intervalo.

Login, logout, ordem dos itens e atualizações de nome/preço não reiniciam o
prazo nem repetem um aviso já enviado. Mudar produto, modelo ou quantidade
inicia novas 3 horas e permite outro aviso. Esvaziar o carrinho ou confirmar
o pagamento cancela o aviso; uma mudança posterior inicia um novo ciclo.
Visitantes só entram nessa regra ao entrar na conta e salvar o carrinho.
Os carrinhos anteriores à migração são tratados como já avisados, evitando
reenvio dos antigos alertas imediatos. Alertas de pedidos efetivamente criados
e de pagamento aprovado mantêm suas regras anteriores.

Execute [scripts/cart-notifications.sql](scripts/cart-notifications.sql) depois
de commerce.sql. Configure um segredo aleatório de pelo menos 32 caracteres
em `CART_NOTIFICATIONS_SECRET` na Vercel (Production) e o mesmo valor no Vault
do Supabase com nome `cart_notifications_secret`. Após publicar a aplicação,
execute [scripts/cart-notifications-cron.sql](scripts/cart-notifications-cron.sql).
Nunca registre o segredo no Git. O endpoint aceita somente POST autenticado.

A reserva transacional impede execuções concorrentes de repetir avisos.
Se nenhum dispositivo for alcançado, o aviso é liberado para nova tentativa;
com entrega parcial não se repete para evitar duplicar nos dispositivos já
alcançados. A reserva é feita antes do envio: uma interrupção abrupta da função
pode perder aquele aviso, em vez de arriscar duplicá-lo. Os retornos HTTP e os
logs da função/cron permitem acompanhar falhas.

Testes: `node --test tests/cart-notifications.test.cjs` e
[tests/cart-notifications.sql](tests/cart-notifications.sql) (rollback).

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

A divulgação de Pix e cartão de crédito aparece somente em uma coluna própria do rodapé, sem blocos adicionais na página inicial, no produto, no carrinho ou no checkout. A seleção efetiva do pagamento no checkout permanece inalterada, sem prometer aprovação, bandeiras ou certificações não verificadas.

O rodapé organiza atendimento, categorias, pagamentos e segurança em colunas, com os dados legais da empresa abaixo. Visa, Mastercard, Elo e American Express foram verificadas como ativas pela consulta autenticada de leitura a `GET https://api.mercadopago.com/v1/payment_methods`; o formulário de cartão não exclui essas bandeiras. A disponibilidade final e a aprovação dependem do checkout. Os logotipos locais em `public/payment-brands/` foram obtidos dos links `secure_thumbnail` retornados pelo Mercado Pago, sem redesenhar as marcas. Reconfirme as bandeiras se o gateway ou sua configuração mudar; boleto não é divulgado porque não está disponível como opção na interface atual.

Os indicadores de segurança são desenhos próprios, não certificados de terceiros: conexão HTTPS (apresentada quando a URL oficial usa HTTPS) e processamento de Pix/cartão pelo Mercado Pago. Não há selo Google Safe Browsing, garantia de compra ou alegação de certificação externa.

O banner usa somente os produtos marcados como **Banner** no admin, com foto preenchendo a área e informações sobrepostas em degradê escuro. Com dois ou mais produtos, troca automaticamente a cada 2 segundos e pausa enquanto o mouse ou o foco do teclado estiverem no banner; ao sair, inicia um novo intervalo de 2 segundos. A navegação manual permanece disponível. A mensagem de suporte permanece visível ao lado; sem produtos selecionados, o banner explica como identificar a peça. Os destaques continuam respeitando a seleção **Destaque** no admin. Vitrine e catálogo compartilham cards com foto inteira sobre fundo branco, preço, estoque, referência do fabricante quando cadastrada e resumo de compatibilidade. Falhas de carregamento exibem erro e nova tentativa; fotos ausentes ou quebradas não são substituídas pelo logotipo como se fosse uma peça.

Os filtros de equipamento e tipo de peça no catálogo podem ser combinados com a busca. A classificação continua dependendo dos campos cadastrados no admin; não é inferida pelo nome da peça.

A página inicial consulta `/api/reviews?scope=store` e mostra até seis avaliações recentes de pedidos entregues, incluindo as fotos enviadas pelos compradores. O total inclui todos os pedidos entregues avaliados, sem selecionar apenas notas positivas. Os nomes são abreviados e não são publicados IDs de pedidos nem contatos dos clientes. Se não houver avaliações, a loja informa isso e convida compradores a avaliar; em caso de erro, exibe uma mensagem com opção de tentar novamente.

O cliente pode abrir um produto, adicionar ao carrinho, informar o CEP para cotar o frete, revisar o pedido e preencher o checkout em `/checkout`. O fluxo de pagamento agora inclui uma opção Stripe para cartão, com fallback para PIX e cartão em modo de teste caso o gateway não esteja habilitado. Para levar a compra para produção, configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NEXT_PUBLIC_APP_URL` na Vercel e valide o checkout em ambiente real.

Antes do primeiro deploy, substitua as imagens externas por imagens reais em `public/` e confirme as coordenadas de atendimento em `lib/store-config.ts`. O domínio próprio precisa ser comprado e conectado na Vercel; ele não pode ser criado automaticamente pelo projeto.

## Imagens de produtos

### Favicon e ícone da loja

A assinatura horizontal está em `public/brand-logo.svg`: ALPHA TEC em uma linha, com o primeiro A em escala 2× e sua base alinhada às demais letras, sem símbolo separado à direita. O A mantém o triângulo vermelho, sem chave de boca. O símbolo isolado em `public/brand-mark.svg` usa a mesma geometria do A e os mesmos gradientes sobre fundo escuro. Execute `npm run icons:generate` após alterar esses desenhos para regenerar PNGs de 48, 96, 192 e 512 px, o Apple Touch Icon de 180 px, o ICO com imagens de 16, 32 e 48 px e `public/logo-header-uniform.jpg`. O cabeçalho usa o SVG; o JPG conserva compatibilidade com compartilhamento social, pagamentos e documentos de assistência/expedição. A vitrine declara o PNG de 192 px como favicon. Os ícones do aplicativo administrativo são independentes e não foram alterados.

Após publicar, solicite nova indexação da página inicial no Google Search Console, tanto para o domínio raiz quanto para `www` se ambos forem usados. O arquivo do favicon deve continuar acessível ao Googlebot-Image, com URL estável. A atualização no Google pode levar dias ou semanas e não é garantida imediatamente. Referência: https://developers.google.com/search/docs/appearance/favicon-in-search.

O sitemap em `/sitemap.xml` consulta os produtos atuais do Supabase, com paginação,
e inclui somente produtos ativos, além das páginas públicas e categorias, sem URLs
duplicadas. Produtos do catálogo estático são preservados quando não substituídos
pelo banco. Falhas na consulta retornam HTTP 503 para não publicar um sitemap
incompleto. Não são inventadas datas de alteração a cada leitura.
Envie o endereço do sitemap no Search Console e acompanhe a indexação; o envio
e a solicitação de rastreio não garantem indexação nem posição para palavras-chave.
Teste: `node --test tests/sitemap.test.cjs`.

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
