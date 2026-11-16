# Etapa 2 · aplicar no Supabase da Oddwork (ydikcvrdpziwtgjabhnx)

Tudo é novo e tem o prefixo `incomum_`. Não altera nada da Oddwork.

## 1. Base de dados (SQL Editor → New query)
1. Colar e correr `01-esquema.sql`. Cria as tabelas, as regras (RLS), a função que marca a encomenda como paga e a vista de clientes.
2. Colar e correr `02-catalogo.sql`. Cria os 227 produtos e as 896 variantes, com o stock inicial a 1 nas disponíveis e a 0 nas esgotadas (os donos acertam no painel).
3. Dar acesso ao painel aos donos:
   - **Authentication → Users → Add user**: o e-mail deles e uma palavra-passe escolhida por ti ou por eles.
   - Depois, no SQL Editor:
     `insert into public.incomum_equipa (email, nome) values ('email@dos-donos', 'Nome');`
   - A equipa da Oddwork (tabela `equipa`) também tem acesso.

## 2. Edge Functions (Edge Functions → Deploy a new function → Via editor)
| Nome | Ficheiro | Verify JWT |
|---|---|---|
| `incomum-checkout` | `functions/incomum-checkout/index.ts` | **desligado** (a loja é pública) |
| `incomum-webhook` | `functions/incomum-webhook/index.ts` | **desligado** (o Stripe assina) |

Segredos já guardados: `STRIPE_INCOMUM_KEY` e `STRIPE_INCOMUM_WEBHOOK`.
Não usam `STRIPE_SECRET_KEY` nem `STRIPE_WEBHOOK_SECRET`, que são da Oddwork.

## 3. Teste
O perfil `oddwork` do Stripe CLI nesta máquina aponta para a conta do Bom Vinho (`acct_1UTJ5O…`), por isso não foi usado.
Com as chaves live, uma compra de teste é dinheiro real. Pode fazer-se uma compra pequena e reembolsá-la no Stripe.

## Fase 3 — pagamento embutido, obrigado, e-mail e conta do cliente (16/11/2026)

Já aplicado: `03-conta.sql` (estado "Em preparação", token de acompanhamento, RLS do cliente, Realtime) e as duas funções novas.

Falta (o utilizador faz, porque envolve palavras-passe):
1. **Palavra-passe de aplicação** do geral@theoddwork.com: https://myaccount.google.com/apppasswords → nome "Incomum loja" → copiar os 16 carateres.
   (Precisa da verificação em 2 passos ligada nessa conta.)
2. **Segredos das funções** (Edge Functions → Secrets → Add new secret):
   - `INCOMUM_SMTP_USER` = geral@theoddwork.com
   - `INCOMUM_SMTP_PASS` = a palavra-passe de aplicação
3. **SMTP do Auth** (Authentication → Emails → SMTP Settings → Enable custom SMTP):
   host `smtp.gmail.com`, porta `465`, utilizador geral@theoddwork.com, palavra-passe = a mesma de aplicação,
   remetente geral@theoddwork.com, nome "Incomum.eu". (O Auth é partilhado com a Oddwork: o painel da Oddwork entra por palavra-passe, por isso quase não envia e-mails.)
4. **Modelo "Magic Link"** (Authentication → Emails → Templates): assunto "Entra na tua conta · Incomum.eu" e o HTML de `email-link-magico.html`.
5. **URLs permitidos** (Authentication → URL Configuration → Redirect URLs): `http://localhost:5191/conta.html` e o endereço final de `conta.html`.

Segurança: as inscrições livres ficam DESLIGADAS. A conta do cliente é criada pelo webhook quando a encomenda fica paga (e-mail já confirmado); a página conta.html pede o link com `shouldCreateUser: false`.

Notas (16/11): a conta geral@theoddwork.com tem a verificação em 2 passos DESLIGADA, por isso o Google não deixa criar a palavra-passe de aplicação. Ligar primeiro.
`_email-preview.html` na raiz é só a pré-visualização do e-mail (http://localhost:5191/_email-preview.html). NÃO publicar.
