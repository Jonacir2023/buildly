# BUILDLy

Plataforma de gestão de obra. Banco: Supabase (projeto P3).
Publicada pelo GitHub Pages a partir da raiz deste repositório.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Entrar, painel da obra, escolher obra, cadastrar obra |
| `estilo.css` | Paleta Terra (claro e escuro) e todo o desenho |
| `app.js` | Consultas ao Supabase e a lógica da tela |
| `.nojekyll` | Impede o GitHub de reprocessar os arquivos |

## Publicar

Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)`.

Endereço: <https://jonacir2023.github.io/buildly/>

## A chave do Supabase é pública de propósito

A chave em `app.js` é a *publishable key*. Quem protege o dado são as
políticas de acesso (RLS) do banco, não o segredo da chave: sem login, o
banco responde vazio. Senha nenhuma fica no código.

## Isolamento

Tudo que o app guarda no navegador leva o prefixo `p3::`. Os apps ficam na
mesma origem (`jonacir2023.github.io`) e, sem prefixo, dividiriam o mesmo
armazenamento — dado de um aparecendo no outro.

## O painel

Uma consulta a `vw_status_obra` traz a obra inteira; uma segunda pergunta
se o RDO de **hoje** já existe (`dias_sem_rdo` não serve: no primeiro dia
da obra ele vem vazio, e vazio não é atraso). `vw_alertas` traz os prazos
de experiência e viagem já com os dias restantes.

## Ainda não pronto

Os módulos estão desabilitados e marcados "em construção" — a tabela
existe no banco, a tela ainda não. Ordem prevista: Efetivo, depois RDO.
