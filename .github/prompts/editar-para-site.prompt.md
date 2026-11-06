---
name: "Editar para site"
description: "Edita a foto de produto anexada trocando o fundo original pelo padrão técnico Alpha Tec (fundo cinza-claro com detalhes em grafite e vermelho escuro, sombra suave, 1200×1200) e, quando pedido, gera vídeo a partir da imagem editada."
argument-hint: "Anexe a foto (ou vídeo) do produto e diga se quer também o vídeo para site ou Reel"
---
Você vai editar a mídia de produto anexada aplicando o padrão visual de e-commerce da Alpha Tec (www.lojaalphatec.com.br). Siga exatamente este processo.

## Padrão técnico e visual (aplicar sempre)

1. **Enquadramento e proporções**: formato quadrado 1200×1200 px, produto perfeitamente centralizado ocupando ~75% do quadro, com margem de segurança para telas de celular e cards de produto.
2. **Fidelidade total ao produto**: preservação exata de materiais, texturas, soldas, parafusos, cores, formatos e proporções originais. NÃO alterar, inventar nem remover peças, logotipos ou marcações do produto.
3. **Fundo profissional (substituir o original)**: remover completamente o fundo original da foto e substituir por fundo limpo em tom cinza-claro neutro, com detalhes sutis em grafite (desenhos técnicos/blueprint de peças fitness levemente desfocados) e toques discretos em vermelho escuro (ex.: cabos de ferramentas desfocados no alto), inspirado em ambiente de assistência técnica/loja fitness.
4. **Acabamento técnico**: sombra suave e realista sob o produto para dar profundidade, iluminação uniforme de estúdio, alta nitidez e recorte limpo, sem halos nem contornos serrilhados.
5. Sem textos, preços, marcas d'água ou logos adicionados na arte.

## Processo para FOTO

1. Use a ferramenta de geração/edição de imagem com a foto anexada como imagem de entrada e o padrão acima como instrução de edição. Reforce no prompt: "manter o produto idêntico ao original, substituir apenas o fundo".
2. Gere em formato quadrado. Se o resultado distorcer ou alterar o produto, gere novamente reforçando a fidelidade — não entregue um resultado com o produto modificado.
3. Salve o PNG final na pasta indicada pelo usuário (padrão: raiz do projeto) com o nome `produto-site-<nome>.png`.
4. Mostre o resultado e pergunte se deseja ajuste (mais zoom, outro ângulo de sombra, fundo mais claro/escuro).

## Processo para VÍDEO

O vídeo é gerado a partir da imagem já editada (animação), pois a troca de fundo quadro a quadro não é suportada:

- **Vídeo para o site (1200×1200, 12 s, sem áudio)**:
  `ffmpeg -loop 1 -i produto-site-<nome>.png -vf "scale=2400:2400,zoompan=z='min(zoom+0.0008,1.12)':d=360:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1200x1200:fps=30" -t 12 -an -c:v libx264 -pix_fmt yuv420p produto-site-<nome>.mp4`
- **Reel (1080×1920, 12 s, sem áudio)**: mesma técnica com saída `s=1080x1920`, recortando o quadrado ao centro:
  `ffmpeg -loop 1 -i produto-site-<nome>.png -vf "scale=3840:3840,crop=2160:3840,zoompan=z='min(zoom+0.0008,1.12)':d=360:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30" -t 12 -an -c:v libx264 -pix_fmt yuv420p reel-<nome>.mp4`

Se o usuário anexar um **vídeo** como origem: extraia o melhor quadro com `ffmpeg -i video.mp4 -ss <segundo> -frames:v 1 quadro.png`, aplique o processo de FOTO nesse quadro e gere o vídeo final a partir da imagem editada. Avise que o movimento original do vídeo não é preservado na troca de fundo.

## Regras

- NÃO exibir preços na arte (padrão dos posts de feed da Alpha Tec).
- NÃO publicar nada automaticamente; apenas gerar e salvar os arquivos.
- Sempre informe o caminho dos arquivos gerados ao final.
