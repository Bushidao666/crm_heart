Supabase Auth – visão geral prática

Este documento resume as principais páginas da documentação Supabase Auth. O objetivo é fornecer um guia organizado para agentes RAG, removendo cabeçalhos e histórias irrelevantes e concentrando‑se em práticas, instruções e conceitos. As seções a seguir apresentam resumos concisos e tópicos relevantes para a autenticação, autorização, fluxos de login, integração com provedores externos, configuração, segurança e componentes de UI.

Conceitos básicos

Autenticação vs. autorização
	•	Autenticação confirma a identidade do usuário; autorização define quais recursos podem ser acessados ￼.
	•	A Supabase utiliza JSON Web Tokens (JWT) para autenticação ￼ e integra essas credenciais com a base de dados Postgres para aplicar Row Level Security (RLS) ￼.
	•	Usuários podem se autenticar via senhas, links mágicos, códigos de uso único (OTP), social login, login por telefone e SSO empresarial ￼.  Os tokens são transportados em headers e utilizados pelos SDKs para aplicar RLS nas requisições à API REST automática ￼.

Ecossistema Supabase
	•	Supabase Auth funciona como produto independente, mas integra‑se com outras soluções Supabase: banco de dados, API REST e objetos.
	•	O serviço de autenticação grava informações de usuários em um esquema especial do Postgres; é possível conectar essas tabelas a tabelas do esquema public via chaves estrangeiras ou gatilhos.
	•	A autenticação garante também o acesso seguro à API REST gerada, pois o token do usuário acompanha cada requisição ￼.

Arquitetura de Supabase Auth

Supabase Auth possui quatro camadas principais ￼:
	1.	Camada de cliente – código frontend ou backend que utiliza o SDK para fazer chamadas HTTP e gerenciar tokens.
	2.	Gateway API (Kong) – roteia requisições, adiciona headers e forwarda para os serviços internos.
	3.	Serviço de autenticação (GoTrue) – emite e renova JWTs, gerencia logins e integra‑se com provedores externos.
	4.	Banco de dados Postgres – armazena usuários e sessões no esquema auth.
	•	O acesso à tabela auth.users é protegido por políticas de RLS; usa‑se views ou gatilhos para expor apenas campos necessários. ￼

Usuários, identidades e sessões
	•	Usuário: linha na tabela auth.users. Há dois tipos:
	•	Permanente: associado a informações de identificação pessoal (e‑mail, telefone, provedor social ou SAML).
	•	Anônimo: sem identidade; tem a claim is_anonymous no token.
	•	Ambos utilizam o papel Postgres authenticated; o papel anon é reservado para acessos sem token ￼.
	•	Métodos para recuperar usuários: supabase.auth.getUser() para cliente atual e supabase.auth.admin.getUserById() para admin ￼.
	•	Identidade: método de autenticação associado a um usuário (email, telefone, OAuth ou SAML). Um usuário pode ter várias identidades; as identidades armazenam provider_id, provider, identity_data etc ￼.
	•	Sessão: iniciada após login. Contém access token (JWT) com validade curta (5–60 min) e refresh token sem validade (utilizado uma vez).
	•	O token inclui session_id e aal (Authenticator Assurance Level) usado em MFA ￼.
	•	Supabase oferece políticas de expiração: tempo fixo, tempo de inatividade ou sessão única (Pro Plan).
	•	Sessões terminam com signOut(), troca de senha, expiração ou login em outro dispositivo ￼.

Guia de início rápido

Next.js (SSR)
	•	Crie um projeto com npx create-next-app -e with-supabase.
	•	Defina variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para o URL do projeto e a chave pública.
	•	O template inclui autenticação baseada em cookies, TypeScript e Tailwind CSS ￼.
	•	Para SSR, armazene sessões em cookies (não em localStorage) e use o pacote @supabase/ssr para facilitar a configuração ￼.
	•	Ao usar fluxo PKCE, especifique flow: 'pkce' nos métodos de login; a biblioteca cuida do handshake ￼.

React
	•	Crie projeto com Vite: npm create vite@latest my-app.
	•	Instale @supabase/supabase-js, @supabase/auth-ui-react e @supabase/auth-ui-shared.
	•	Crie o cliente Supabase e utilize o componente <Auth> para renderizar formulários de login quando não houver sessão ￼.

React Native
	•	Crie app Expo: npx create-expo-app.
	•	Instale @supabase/supabase-js, @react-native-async-storage/async-storage e componentes de UI (@rneui/themed, etc.).
	•	Configure lib/supabase.ts para usar AsyncStorage em plataformas não Web e setar processLock para concorrência segura ￼.
	•	Crie componentes de login e gerencie sessões usando useEffect para verificar o estado de autenticação.

Fluxos de autenticação (How‑tos)

Server-Side Rendering (SSR)
	•	Use cookies (HttpOnly e Secure) para armazenar a sessão no SSR; não utilize localStorage.
	•	O pacote @supabase/ssr simplifica a obtenção de sessão do cookie e a inicialização do cliente ￼.
	•	No fluxo PKCE, a biblioteca lida com a troca de código. Defina flow: 'pkce' em signInWithOAuth() ou signInWithOtp().

Autenticação por senha
	•	Habilitar login por email + senha no dashboard ou arquivo de configuração (ativado por padrão).
	•	Fluxos suportados:
	•	Implícito: signUp({ email, password }) cria usuário e retorna access_token após confirmação (caso autoConfirm).
	•	PKCE: signUp() retorna provider_token que deve ser trocado por token via código; usado para apps móveis e SSR.
	•	Para login, use signInWithPassword({ email, password }).
	•	Defina URLs de redirecionamento permitidas no dashboard ou config.
	•	Confirmar email: se a opção “Confirm email” estiver ativada, o usuário deve clicar no link enviado antes de receber um token ￼.

Login sem senha (email)
	•	Links mágicos: envia um link de uso único para o email do usuário.
	•	OTP por email: envia um código numérico.
	•	Ambas melhoram experiência e segurança, eliminando necessidade de senha.
	•	Use supabase.auth.signInWithOtp({ email, options: { shouldCreateUser } }).  Se shouldCreateUser for false, impede que um email novo seja cadastrado automaticamente ￼.
	•	Configure redirect URLs permitidos e personalize o template de email para flows PKCE ￼.

Login por telefone
	•	Envia OTP por SMS ou WhatsApp; código expira em 1 h.
	•	Habilite “Phone auth” no dashboard e configure provedor de SMS (MessageBird, Twilio, Vonage, TextLocal).
	•	Use signInWithOtp({ phone, options }) para iniciar e verifyOtp({ phone, token }) para verificar ￼.
	•	Requer configurar limites de envio e CAPTCHA para reduzir custos e abuso ￼.

Login social (OAuth)
	•	Oferece melhor experiência e segurança.
	•	Supabase suporta provedores como Google, Facebook, Apple, GitHub, Azure, Twitter, etc.
	•	É necessário configurar cada provedor no dashboard (client ID e secret) e registrar URLs de redirecionamento.
	•	Chame signInWithOAuth({ provider }) no cliente e defina redirectTo.
	•	Supabase não armazena tokens de acesso do provedor; se você precisar acessar APIs do provedor, use o token retornado durante a sessão ￼.
	•	Em flows PKCE, especifique flow: 'pkce' para aplicar OAuth com código de autorização.
	•	Para SAML/SSO empresarial, consulte a seção Enterprise SSO.

SSO empresarial (SAML 2.0)
	•	Suporta provedores como Google Workspaces, Okta, Microsoft AD, PingIdentity e OneLogin.
	•	Necessário Pro Plan.
	•	Requer configuração via CLI: habilitar a flag auth.saml, registrar metadados do provedor e registrar URLs de redirecionamento.
	•	Termos importantes: Identity Provider, Service Provider, Assertion, EntityID, NameID ￼ ￼.
	•	Para cada aplicação SAML, configure no provedor de identidade a URL de redirecionamento e defina role: authenticated no token (ver Third‑Party Auth para exemplos de custom claim).

Logins anônimos
	•	Diferenciam‑se do papel anon.  Um login anônimo cria um usuário real na tabela auth.users e adiciona a claim is_anonymous no JWT.
	•	Use signInAnonymously(); o token terá papel authenticated.  Ideal para e‑commerce, demonstrações ou streamings, quando não se deseja pedir email imediatamente ￼.
	•	Para converter para usuário permanente, vincule uma identidade (email ou telefone) usando updateUser() após verificação e ative “manual linking”.
	•	Revise as políticas de RLS para garantir que usuários anônimos tenham acesso apenas a dados apropriados ￼.

Login via Web3 (Solana)
	•	Permite login com carteiras Web3 (atualmente Solana; Ethereum planejado).
	•	Baseia‑se em EIP‑4361: usuário assina uma mensagem, a Supabase verifica e emite um token.
	•	Habilite o provedor Web3 no dashboard e configure via CLI (auth.web3.solana).
	•	Ajuste limites de chamadas e habilite CAPTCHA para evitar abuso ￼.
	•	É necessário registrar URLs de redirecionamento; o login não fornece email/telefone, portanto revise RLS para evitar acesso indevido ￼.

Deep linking móvel
	•	Para apps móveis (Flutter/React Native), configure um esquema de URL personalizado (ex.: com.supabase) e adicione‑o nas configurações de redirecionamento.
	•	Crie manipuladores de deep link para tratativas de confirmações de signup, links mágicos, reset de senha e redirecionamentos OAuth ￼.
	•	Use AuthSession ou similar para monitorar links abertos no app e concluir o fluxo.
	•	Garanta que redirectTo utilize o esquema personalizado no momento de enviar emails ou SMS.

Vinculação de identidades
	•	Vinculação automática: Supabase vincula identidades com o mesmo email quando verificadas; garante unicidade e previne takeover.
	•	Vinculação manual: use linkIdentity() para associar um provedor adicional a um usuário.  Requer habilitar “manual linking” nas configurações ￼.
	•	Desvincular: use getUserIdentities() para listar e unlinkIdentity() para remover uma identidade ￼.
	•	O gerenciamento de identidades SAML não é automático; deve ser vinculado manualmente para evitar tomada de conta.

Multi‑Factor Authentication (MFA)
	•	MFA adiciona uma camada de segurança exigindo algo que o usuário sabe (senha, social login) e algo que o usuário possui (app autenticador ou telefone).
	•	Supabase suporta dois fatores: TOTP (app autenticador) e Phone (SMS/WhatsApp).
	•	O token inclui a claim aal indicando o nível de garantia: aal1 (sem MFA) ou aal2 (MFA verificada) ￼.
	•	A Supabase fornece APIs de Enroll, Challenge e Verify para registrar e verificar fatores ￼.
	•	Fluxos recomendados:
	1.	Enrolar: exibir QR Code ou gerar código e chamar supabase.auth.mfa.enroll(); depois supabase.auth.mfa.challenge() e supabase.auth.mfa.verify() ￼ ￼.
	2.	Desenrolar: permitir que usuário liste fatores (supabase.auth.mfa.listFactors()) e use supabase.auth.mfa.unenroll({ factorId }) ￼.
	3.	Desafiar no login: após login primário, chamar getAuthenticatorAssuranceLevel(); se o nextLevel for aal2, apresentar tela de verificação antes de acessar o app ￼.
	•	Você pode impor MFA a todos os usuários, apenas a novos ou apenas opt‑in ￼.
	•	Para MFA via App Authenticator:
	•	Exibir QR Code para o usuário digitalizar (ou mostrar secret em texto).
	•	Após enroll(), chamar challenge() e verify() para ativar o fator ￼.
	•	Ao fazer login, chame getAuthenticatorAssuranceLevel() e se necessário solicite o código TOTP ￼.
	•	Para MFA via Telefone:
	•	Compartilha a configuração de provedor com o login por telefone; use supabase.auth.mfa.enroll(), challenge() e verify() ￼.
	•	O código é enviado por SMS/WhatsApp; verifique com verify().
	•	Use o Send SMS Hook para alterar provedor ou conteúdo da mensagem ￼.

Signout
	•	Use supabase.auth.signOut() para terminar a sessão.
	•	É possível especificar scope: local (apenas sessão atual), global (todas as sessões) ou others (mantém a sessão atual e remove as demais) ￼.
	•	O refresh token é destruído imediatamente; o access token permanece válido até expirar.
	•	Atualize a interface do usuário após o logout para evitar operações com token expirado.

Depuração e erros

Códigos de erro

A documentação lista erros divididos em tipos:
	•	AuthApiError – erros retornados pelo serviço de autenticação, com status HTTP (403, 422, 429, 500, 501).
	•	CustomAuthError – erros lançados localmente pelo SDK.
	•	O catálogo inclui códigos como invalid_credentials, identity_already_exists, insufficient_aal, erros de MFA (factor_already_activated, factor_not_activated), limite de taxa (rate_limit_error) etc., com descrições resumidas ￼ ￼.
	•	Consulte este catálogo para diagnosticar falhas de login, cadastro e MFA.

Troubleshooting

A seção de troubleshooting apresenta links para artigos de base de conhecimento abordando problemas comuns, como:
	•	Falhas na entrega de emails, configuração de provedores ou chaves.
	•	Erros de invalid_claim ou no_session.
	•	Stale data na UI ou problemas de cache.
	•	Integração com frameworks e libs (ex.: NextAuth).
	•	Mensagens de erro de SAML ou OAuth ￼.

Terceiros (Third‑Party Auth)

Visão geral

Supabase pode aceitar JWTs emitidos por provedores externos (Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS) quando esses tokens são assinados de forma assimétrica e contêm o header kid ￼.
	•	O provedor deve seguir o padrão OIDC; tokens HS256/PS256 não são suportados.
	•	A integração não desativa Supabase Auth; tokens de terceiros são aceitos paralelamente.
	•	A cobrança considera Third‑Party MAU ￼.

Clerk
	•	Configure no Dashboard: fornecer Clerk Issuer URL e Clerk JWKS URL.
	•	Configure supabase/config.toml com [auth.jwt] external_jwt_provider.enabled = true e external_jwt_provider.jwks_url apontando para a chave pública do Clerk ￼.
	•	Adicione claim role ao token do Clerk para que RLS use o papel authenticated.
	•	Exemplo de uso no cliente: obtenha token de sessão do Clerk e passe como accessToken ao criar o cliente Supabase ￼.
	•	Ajuste as políticas de RLS para usar claims personalizadas do Clerk (por exemplo, organization_role) ￼.

Firebase Auth
	•	Adicione integração no dashboard (selecionar projeto Firebase).
	•	Em projetos auto‑hospedados, crie RLS que verifique iss e aud do token para impedir JWTs de outros projetos Firebase ￼.
	•	Defina a claim role: authenticated no token via Cloud Functions (pre‑token generation trigger).
	•	Exemplo de inicialização do cliente: obtenha token via auth.currentUser.getIdToken() do Firebase e forneça a supabaseClient como accessToken ￼.

Auth0
	•	Adicione integração no dashboard.
	•	Crie uma Auth0 Action onExecutePostLogin para adicionar a claim role: authenticated no token; use namespace como https://your-domain.example.com/claims ￼.
	•	No cliente, recupere o token com getAccessTokenSilently() e use‑o como accessToken ao inicializar Supabase.
	•	Algoritmos HS256 e PS256 não são suportados ￼.

AWS Cognito (Amplify)
	•	Informe o User Pool ID e a região no dashboard.
	•	Use um trigger Pre Token Generation (Lambda) para inserir a claim role: authenticated no JWT e adicionar informações adicionais (ex.: username).
	•	Exemplo de lambda: ler event.request.userAttributes e adicionar ao event.response.claimsOverrideDetails ￼.
	•	No cliente, use AWS Amplify para obter accessToken e passá-lo na criação do cliente Supabase.
	•	Em auto‑hospedados, crie RLS que verifique aud e iss do token, semelhante ao Firebase ￼.

WorkOS
	•	Conecte o tenant WorkOS via integração no dashboard.
	•	Personalize o JWT template no WorkOS para inserir a claim role: authenticated e mapear a role do WorkOS para user_role ￼.
	•	Use a biblioteca de autenticação do WorkOS para obter tokens e inicializar o cliente Supabase com accessToken.
	•	A role do WorkOS pode ser recuperada em RLS (auth.jwt()->>'user_role').

Configuração e personalização

Configuração geral

Definições disponíveis no painel ou via arquivo supabase/config.toml ￼:
	1.	Allow Signup – permite ou bloqueia criação de novos usuários.
	2.	Confirm Email – exige verificação de e‑mail antes de ativar conta.
	3.	Allow Anonymous Sign ins – permite login anônimo.
	4.	Allow Manual Linking – ativa a vinculação manual de identidades (necessária para anonimizar ou SAML).
	5.	Auto Confirm e Auto Assign Role (no arquivo config.toml) definem se usuários são confirmados automaticamente e a role default.

Modelos de e‑mail
	•	Personalize os templates para Confirm Signup, Invite User, Magic Link, Change Email e Reset Password.
	•	Variáveis disponíveis:
	•	{{ .ConfirmationURL }}, {{ .Token }}, {{ .TokenHash }}, {{ .SiteURL }}, {{ .RedirectTo }}, {{ .Data }}, {{ .Email }}, {{ .NewEmail }} ￼.
	•	Templates podem ser editados via dashboard, arquivo de configuração ou API de gerenciamento.
	•	Use redirecionamentos (redirectTo) para enviar usuários a páginas específicas após confirmar e‑mail ou redefinir senha; ajuste o template para incluir o link correto. ￼.

URLs de redirecionamento
	•	Parâmetro redirectTo especifica para onde o usuário retorna após login; por padrão, usa SITE_URL configurada.
	•	É possível adicionar multiple redirect URLs na lista de permissões.
	•	Coringas são permitidos apenas no subdomínio (
ex.: https://*.example.com) e são úteis para deploys de preview em Netlify/Vercel ￼.
	•	Para aplicativos móveis, defina esquemas (com.exemplo.app://callback) na lista de redirect e nos templates de email.
	•	Ao lidar com erros de redirecionamento, consulte os parâmetros de query (error, error_description) na URL. ￼

Hooks de autenticação

Hooks permitem executar funções personalizadas antes ou durante a autenticação ￼. São úteis para adicionar claims, validar dados ou integrar serviços externos. Principais hooks:
	1.	Custom Access Token Hook – executado antes de emitir o token; permite adicionar claims adicionais.
	•	Claim obrigatórias: iss, aud, exp, sub, email, email_confirmed_at, phone, phone_confirmed_at e role.
	•	Claims opcionais: jti, nbf, metadata, etc.
	•	Recebe event com campos user_id, claims e authentication_method. Deve retornar o objeto event atualizado com claims modificadas ￼.
	•	Útil para implementar RBAC, inserir user_role ou outras informações no JWT.
	2.	Send SMS Hook – executa antes de enviar SMS de OTP ou MFA; pode integrar provedores regionais ou canais alternativos (WhatsApp).  Recebe user e sms (que contém o código) e permite customizar a mensagem ￼.
	3.	Send Email Hook – executa antes de enviar e‑mail. Controla se a mudança de e‑mail enviará uma ou duas mensagens, dependendo se a alteração é segura (o hash do token coincide com o secret). Pode usar provedores alternativos ou internacionalizar mensagens ￼.
	4.	MFA Verification Hook – executa durante a verificação MFA; permite limitar tentativas ou bloquear usuário após falhas.  Recebe factor_id, factor_type, user_id, valid e retorna decision (reject ou continue) e mensagem opcional. Pode implementar contadores de tentativas e políticas de lockout ￼.
	5.	Password Verification Hook – executa durante login por senha; ideal para aplicar medidas adicionais como limitação de tentativas ou enviar alertas.  Recebe user_id e valid; retorna decision, message e should_logout_user ￼.
	6.	Before User Created Hook – executa antes de criar um usuário; permite rejeitar inscrições com base no email, IP ou outros critérios. Recebe user (preenchido com e‑mail/telefone), meta (request ID, IP, hora) e deve retornar erro caso deseje bloquear o cadastro ￼.

Todos os hooks podem ser implementados como funções Postgres (alta performance) ou endpoints HTTP externos. Para usar no banco, conceda permissões apenas ao papel supabase_auth_admin ￼.

SMTP Personalizado
	•	O servidor SMTP padrão é destinado a testes; possui limites de envio, só envia para emails de membros da equipe e não fornece SLA.
	•	Para produção, configure um provedor SMTP (Resend, AWS SES, Postmark, Mailgun, etc.).
	•	Forneça host, porta, usuário e senha no dashboard ou via API; depois atualize registros DNS (SPF, DKIM).
	•	Com SMTP próprio, você controla velocidade de envio e escala ￼ ￼.

Gerenciamento de usuários
	•	Visualize e gerencie usuários no painel (Dashboard > Auth > Users).
	•	Para consultar e atualizar dados de usuários via API, crie uma tabela profiles no esquema public referenciando auth.users e habilite RLS.
	•	Use um gatilho AFTER INSERT para copiar novos usuários para profiles; defina políticas que permitam aos usuários ver e atualizar apenas sua própria linha ￼.
	•	Para armazenar metadados no cadastro, passe data no signUp(); os dados ficam em raw_user_meta_data.
	•	Para deletar usuário, chame supabase.auth.admin.deleteUser(userId). A exclusão falhará se o usuário possuir objetos de storage; apague os objetos primeiro ￼.
	•	Para exportar usuários, utilize o editor SQL: copy (select * from auth.users) to stdout with csv header. Combine com auth.identities para incluir provedores de login ￼.

Segurança e boas práticas

Força de senha e armazenamento
	•	Exija senhas com comprimento mínimo (>= 8) e caractere numérico, letra maiúscula/minúscula e símbolo especial; isso aumenta exponencialmente a complexidade ￼.
	•	Supabase verifica senhas em listas de senhas vazadas via Have I Been Pwned? (feature do Pro Plan).
	•	Senhas são armazenadas com bcrypt e salt; a coluna encrypted_password no banco não contém a senha original ￼.
	•	Recomende o uso de gerenciadores de senhas e ativação de MFA para usuários sensíveis.

Limites de taxa (Rate Limits)
	•	Envio de e‑mails: limite padrão por hora; customizável apenas com SMTP próprio.
	•	Envio de OTP: por padrão, 30 mensagens/hora por usuário; recomendamos manter abaixo de 100 para evitar fraudes.
	•	Verificação de tokens: limites baseados em IP; protegem endpoints de verify() e token refresh.
	•	Consulte a API de gerenciamento para ver/ajustar esses limites ￼.

Proteção contra bots (CAPTCHA)
	•	Ative hCaptcha ou Cloudflare Turnstile para processos de signup, login e reset de senha ￼.
	•	Faça cadastro no provedor e obtenha as chaves site key e secret key.
	•	Ative a proteção em Authentication > Bot and Abuse Protection no dashboard e insira as chaves.
	•	No frontend, use o componente de CAPTCHA (ex.: <HCaptcha sitekey=... onVerify=... /> no React) e inclua o token retornado no signUp ou signIn ￼.
	•	Ajuste os limites de envio de OTP e email ao ativar CAPTCHA para equilibrar experiência do usuário com segurança.

JSON Web Tokens (JWT)
	•	Um JWT possui três partes: header, payload e signature; a signature é calculada com uma chave secreta ou par de chaves (assimétrica).
	•	Supabase gera novo JWT a cada sessão; tokens contêm claims como iss (emissor), exp (expiração), sub (ID do usuário), role, email, etc. ￼.
	•	O token permite autorização via RLS; cada requisição com token authenticated mapeia para a role authenticated no banco.
	•	Customize claims usando Custom Access Token Hook para incluir papel do usuário (user_role), planos (plan) ou outros metadados ￼.

Chaves de assinatura de JWT
	•	Supabase oferece duas formas de assinar tokens: segredo compartilhado (legacy) e chaves de assinatura (assimétricas ou segredo dedicado).
	•	As chaves de assinatura têm vantagens: desempenho e confiabilidade (uso de Nginx proxy), maior segurança (chave privada nunca sai do servidor), rotação sem downtime, independência de API keys e conformidade regulatória ￼.
	•	Para migrar: importe o segredo atual como nova chave, atualize sua aplicação para usar supabase.auth.getClaims() para validação e clique em “Rotate keys” no dashboard; os tokens antigos continuam válidos até expirar ￼.
	•	Estados das chaves: standby, current, previously used e revoked; tokens emitidos são aceitos por qualquer chave não revogada ￼.
	•	As chaves públicas estão disponíveis em https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json e podem ser armazenadas em cache pelos clientes.
	•	Rotacione as chaves quando houver suspeita de vazamento ou exigência de compliance.

Row Level Security (RLS)
	•	Ative RLS em uma tabela com ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY. Após ativar, nenhuma linha estará acessível sem políticas.
	•	Mapas de roles: o SDK mapeia requisições com token para o papel authenticated, e requisições sem token para anon.
	•	Políticas típicas:
	•	SELECT: permitir que qualquer usuário leia (casos públicos) ou permitir que o usuário leia apenas a própria linha (user_id = auth.uid()) ￼.
	•	INSERT: permitir inserção se a user_id for igual a auth.uid(); para popular user_id automaticamente, crie uma coluna user_id com valor padrão auth.uid() ￼.
	•	UPDATE/DELETE: permitir apenas se a linha pertence ao usuário ou conforme função authorize() no RBAC.
	•	Use funções auth.uid() e auth.role() em políticas para ler claims do token.
	•	Diferencie usuário anônimo de papel anon: usuários anônimos recebem claim is_anonymous, mas ainda estão sob papel authenticated. O papel anon se aplica a requisições sem token e deve ter acesso mínimo ￼.

Column Level Security (CLS)
	•	Permite restringir quais colunas um papel pode ver ou manipular.
	•	É um recurso avançado; recomenda‑se evitá‑lo salvo casos específicos.
	•	Quando habilitado, usuários com restrições não podem usar o operador * (select all); é necessário especificar as colunas permitidas.
	•	Combine RLS e CLS com uma tabela de usuários e papéis dedicados para maior clareza. (Detalhes completos estão na documentação de banco de dados.)

Custom Claims & RBAC
	•	Claims personalizadas permitem armazenar atributos (ex.: papel do usuário, plano, nível, grupo) dentro do JWT para usar em RLS ou lógica de aplicação.
	•	Use o Custom Access Token Hook para inserir claims antes de emitir o token ￼.
	•	Exemplo de RBAC:
	1.	Criar enums app_role e app_permission e tabelas user_roles e role_permissions para associar usuários a papéis e permissões ￼.
	2.	Criar função public.custom_access_token_hook(event jsonb) em PL/pgSQL para ler o papel de user_roles e inserir user_role no claims ￼.
	3.	Criar função authorize(requested_permission) que lê auth.jwt()->>'user_role' e verifica se o papel possui determinada permissão ￼.
	4.	Usar authorize() em políticas RLS, por exemplo, permitir DELETE em channels somente se authorize('channels.delete') retornar true ￼.
	5.	No cliente, decodifique o JWT (jwtDecode(session.access_token)) para acessar user_role ￼.

Componentes de UI (Auth UI)

Auth UI (Deprecated)
	•	Biblioteca React descontinuada em 7 de fevereiro de 2024; a equipe recomenda usar a Supabase UI Library com blocos prontos de autenticação ￼.
	•	Ainda pode ser usada instalando @supabase/supabase-js, @supabase/auth-ui-react e @supabase/auth-ui-shared.
	•	Para utilizar:
	•	Crie o cliente Supabase (createClient(url, anonKey)) e passe para <Auth supabaseClient={supabase} />.
	•	Use o prop appearance.theme para aplicar temas como ThemeSupa e o prop providers para adicionar provedores sociais (google, facebook, twitter etc.) ￼.
	•	Personalize redirecionamentos com queryParams (por exemplo, prompt: 'consent', access_type: 'offline') ￼.
	•	O componente suporta views pré‑definidas: email login, magic link, social login, update password e esqueci senha ￼.
	•	Customização:
	•	Use temas predefinidos ou crie o próprio tema via appearance.theme e variables para definir cores e estilos ￼ ￼.
	•	É possível alternar entre variações default e dark via prop theme ￼.
	•	Override variáveis de tema passando variables: { default: { colors: { brand: 'red', brandAccent: 'darkred' } } } ￼.
	•	Crie temas customizados com diferentes variações e forneça via appearance={{ theme: customTheme }} ￼.
	•	Para design avançado, adicione classes CSS customizadas ou estilos inline para elementos como botão, container, âncora, input e mensagem ￼.

Flutter Auth UI
	•	Pacote Flutter com widgets pré‑construídos para autenticação.
	•	Adicione ao pubspec.yaml: flutter pub add supabase_auth_ui ￼.
	•	Inicialize o Supabase na função main() com URL e chave anônima antes de rodar o app ￼.
	•	Widgets disponíveis:
	•	SupaEmailAuth – formulário para login/cadastro por email e senha; aceita metadataFields para coletar dados extras ￼.
	•	SupaMagicAuth – formulário para login via link mágico ￼.
	•	SupaResetPassword – formulário de reset de senha, requer accessToken ￼.
	•	SupaPhoneAuth – formulário para login por telefone, define authAction (signIn ou signUp) ￼.
	•	SupaSocialsAuth – lista de botões para provedores sociais; suporta OAuthProvider.apple, OAuthProvider.google, etc., e personalização de cor e redirectUrl ￼.
	•	A customização de tema pode ser feita utilizando as capacidades normais do Flutter; os widgets são construídos com componentes padrão e se adaptam ao tema do seu aplicativo ￼.

Conclusão

Supabase Auth oferece um conjunto abrangente de ferramentas para autenticar e autorizar usuários, integrando‑se perfeitamente ao banco de dados Postgres e às APIs geradas. Este resumo serve como guia prático para configurar fluxos de login, aplicar políticas de segurança (RLS, MFA, rate limits), integrar provedores externos e personalizar a experiência de autenticação em aplicações web e mobile.