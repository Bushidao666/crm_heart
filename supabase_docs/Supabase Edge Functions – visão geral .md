Supabase Edge Functions – visão geral completa

Esta visão geral resume todo o conteúdo prático das páginas da documentação de Supabase Functions (Edge Functions). O objetivo é fornecer um material organizado para recuperação de conhecimento (RAG), removendo cabeçalhos, metadados e histórias, e concentrando‑se em instruções práticas, conceitos e exemplos.

Visão geral

Supabase Edge Functions são funções server‑side escritas em TypeScript/JavaScript que executam no runtime Deno e são distribuídas globalmente. Elas se comportam como um CDN para lógica de negócios: você escreve uma função e ela é executada no edge mais próximo do usuário. As funções são estateless, seguem a semântica HTTP e retornam respostas JSON por padrão. A interface é familiar a quem usa fetch no navegador (Deno.serve((req) => … )). As principais características são:
	•	Aberto e portátil – código open‑source, executado em Deno (é possível executar localmente ou em qualquer infraestrutura que suporte Web Assembly ou Deno).
	•	TypeScript‑first – suporte a tipagem estática, importação de pacotes do ecossistema npm, módulos JSR/deno.land e APIs Node compatíveis.
	•	Distribuição global – funções são implantadas nas regiões Supabase (ex.: us‑east‑1, eu‑west‑1, ap‑southeast‑1) e chamadas são roteadas automaticamente para a região mais próxima do cliente.
	•	Integração com Supabase – acesso às APIs de Auth, Postgres e Storage com privilégios adequados, suporte a Row Level Security (RLS) via JWT, secrets gerenciados, logging e monitoramento integrados.

Como criar e implantar funções

Quickstart via Dashboard
	1.	No Painel Supabase, abra Functions → Edge Functions e clique em Create Function. Defina um nome para a função.
	2.	Edite o código da função. Um exemplo simples usa Deno.serve para retornar { message: 'Hello World' }.
	3.	Clique em Deploy; a função ficará acessível via URL no formato https://<PROJECT_ID>.functions.supabase.co/<function-name>.
	4.	Para chamar a função a partir de um cliente, envie uma requisição HTTP à URL incluindo o cabeçalho apikey com a public API key ou, se a função exigir autenticação, o cabeçalho Authorization: Bearer <JWT>.

Quickstart via CLI
	1.	Instale o Supabase CLI (npm i -g supabase).
	2.	Inicialize um projeto local: supabase init <project-name>.
	3.	Crie uma nova função: supabase functions new hello --template hello-world.
	4.	Execute localmente com supabase functions serve e teste via curl http://localhost:54321/functions/v1/hello.
	5.	Faça login (supabase login), vincule ao seu projeto (supabase link --project-ref <project_ref>), defina secrets se necessário (supabase functions secrets set <KEY>), e implante: supabase functions deploy hello.
	6.	A função fica disponível via https://<PROJECT_ID>.functions.supabase.co/hello.
	7.	Armazene secrets sensíveis usando supabase secrets set ou via dashboard; recupere‑os com Deno.env.get().

Configuração do ambiente de desenvolvimento
	•	Runtime: as funções utilizam o runtime Deno. É recomendado instalar o Deno CLI para testar funções localmente.
	•	Editor: configure o VS Code com a extensão “Deno” para suporte a import maps e type‑checking.
	•	Estrutura de projeto: mantenha um diretório supabase/functions para as funções, supabase/migrations para migrações SQL e um arquivo .env para variáveis locais.
	•	Comandos úteis: supabase start inicia os serviços locais (Postgres + Auth), supabase functions serve inicia o servidor de funções, supabase functions deploy implanta para a nuvem.

Variáveis de ambiente e secrets

Edge Functions expõem algumas variáveis padrão via Deno.env:
	•	SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_URL – fornecem URL do projeto, chave pública, chave de serviço e cadeia de conexão. Acessam‑se com Deno.env.get('SUPABASE_URL').
	•	Você pode definir secrets personalizados com supabase functions secrets set KEY=valor ou armazená‑los em .env. Esses secrets ficam disponíveis apenas durante o build/deploy.
	•	No Dashboard, é possível definir secrets por função ou globais.

Gerenciando dependências

As funções suportam importação de:
	•	Pacotes npm (Node) – Deno agora suporta npm: imports. É possível usar módulos Node integrados (node:) ou bibliotecas do ecossistema.
	•	Módulos JSR/Deno.land – importações no estilo jsr:@supabase/supabase-js ou https://deno.land/std@… continuam funcionando.
	•	Import Map – defina aliases em deno.json para simplificar importações, especialmente ao usar supabase-js e outras libs.
	•	Pacotes privados – use variáveis NPM_TOKEN ou DENO_AUTH_TOKENS para autenticação; registre um NPM_CONFIG_REGISTRY se usar registry personalizado.

Configuração de cada função

As opções de configuração ficam no arquivo supabase/config.toml dentro do diretório da função. Algumas configurações comuns:
	•	verify_jwt – defina false para desabilitar verificação de JWT (útil para webhooks como Stripe).
	•	import_map e node_compat – especifique caminhos de import map ou ative compatibilidade Node para funções específicas.
	•	timeout_ms – altere o tempo máximo de execução (padrão ~150 s).
	•	entrypoint – defina o arquivo principal se diferir de index.ts.
O exemplo abaixo desativa JWT de um webhook e define import map e Node compat para outra função:
[[functions]]
  name = "stripe-webhook"
  verify_jwt = false

[[functions]]
  name = "image-processor"
  import_map = "./import_map.json"
  node_compat = true
  Tratamento de erros e logging
	•	Dentro de Deno.serve recomenda‑se encapsular a lógica em try/catch e retornar status HTTP apropriado (por exemplo, 500 para erros internos) com mensagem JSON.
	•	Do lado do cliente, use try/catch em fetch para capturar falhas.
	•	Logging: Utilize console.log() para logs simples ou gere logs estruturados (JSON) para melhor pesquisa. Logs estão disponíveis no Dashboard em Edge Functions → Invocations/Logs.
	•	Evite registrar dados sensíveis como tokens ou PII.

Roteamento e organização de funções

Embora cada função seja um endpoint, pode ser vantajoso consolidar múltiplas rotas numa única função para reduzir cold starts. Abordagens:
	•	Switch/case: verifique req.method e new URL(req.url).pathname dentro de uma função para executar diferentes caminhos.
	•	Frameworks Deno: use Hono, Oak ou Ultra para definir rotas no estilo Express; lembre‑se de prefixar a rota com o nome da função (/my-func/hello).
	•	URLPattern API: o Deno traz a API URLPattern para combinar padrões com captura de parâmetros (ex.: /tasks/:id). Ela permite extrair parâmetros sem dependências externas.
	•	Para WebSockets ou rotas customizadas, consulte a seção adequada.

Testes e depuração local
	•	Testes unitários: escreva testes em arquivos .test.ts dentro de supabase/functions/tests e execute com deno test --allow-net --allow-read .... Utilize o Deno test runner para validar handlers e funções puras.
	•	Depuração: rode supabase functions serve --inspect-mode brk e abra chrome://inspect no navegador para anexar o DevTools e depurar com breakpoints.
	•	Logs locais: supabase functions serve exibe logs no terminal, incluindo solicitações e prints de console.

Limites e regionais
	•	Recursos: Edge Functions têm 256 MB de memória, tempo de vida de 150 s no plano gratuito ou 400 s nos pagos; CPU limitada a 2 s por requisição; idle timeout de 150 s.
	•	Tamanho do pacote: o bundle pós‑processamento não deve exceder 20 MB.
	•	Número de funções: planos Gratuito/Pro/Team limitam 100/500/1000 funções por projeto; Enterprise ilimitado.
	•	Execução regional: por padrão as funções rodam na região mais próxima do usuário. Para forçar uma região (ex.: mesma do banco) use region: FunctionRegion.<REGION> ao instanciar o cliente ou defina o cabeçalho x-region na requisição. O cabeçalho de resposta x-sb-edge-region informa a região real.
	•	Status codes: 2xx sucesso, 401 sem auth, 404 função inexistente, 405 método não permitido, 500 erro interno, 503 serviço indisponível, 504 tempo esgotado, 546 limite de recursos.

Custos
	•	Cada invocação além da franquia mensal é cobrada ($2 por milhão de invocações). A franquia varia por plano (500 k no plano gratuito, 2 M no Pro/Team).

Integrações Supabase

Autenticação
	•	Para aplicar RLS do Postgres, inclua o cabeçalho Authorization: Bearer <JWT> nas requisições e crie um cliente Supabase dentro da função:
	import { createClient } from '@supabase/supabase-js';
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.from('countries').select('*');
  // ...
});
	•	Use a Service Role Key apenas em chamadas do lado do servidor (ela ignora RLS). Para webhooks sem verificação de JWT, desative verify_jwt na configuração.

Database (Postgres)
	•	Você pode usar @supabase/supabase-js (recomendado) ou clientes nativos de Postgres (ex.: postgres, Drizzle, Kysely) passando a string SUPABASE_DB_URL.
	•	Para consultas complexas sem RLS, utilize a Service Role Key; para manter RLS, passe o cabeçalho Authorization com o JWT do usuário.

Storage
	•	Para salvar arquivos gerados por uma função, utilize o cliente administrador de Storage com a Service Role Key. Após upload, gere um URL público ou assinado e retorne ao usuário.
	•	Padrão cache‑first: ao gerar um asset caro (ex.: imagem), salve no Storage e depois redirecione (302) para a URL do arquivo. Em chamadas subsequentes, verifique se o arquivo existe e retorne o URL diretamente.

Recursos avançados

Acesso a arquivos e armazenamento

As funções podem usar dois tipos de armazenamento:
	1.	Persistente (S3) – montado via driver S3. Defina as variáveis S3FS_ENDPOINT_URL, S3FS_REGION, S3FS_ACCESS_KEY_ID e S3FS_SECRET_ACCESS_KEY e acesse os arquivos via path /s3/<BUCKET-NAME>/.... Útil para processar arquivos grandes, gerar thumbnails, etc..
	2.	Efêmero (tmp) – diretório /tmp que é reiniciado em cada invocação, com limites de 256 MB (plano gratuito) ou 512 MB (planos pagos). Use await Deno.readFile() e await Deno.writeFile() ou APIs Node (fs.promises) para ler/escrever. Exemplo: salvar arquivo zip em /tmp, extrair conteúdo e enviar ao Storage.

	•	APIs síncronas permitidas: apenas em código de nível superior (fora do handler) é permitido usar statSync, readFileSync, writeFileSync, etc.; dentro do handler use APIs assíncronas.

Manipulação de WebSockets

Edge Functions podem atuar como servidores ou clientes WebSocket:
	•	Servidor WebSocket: verifique o cabeçalho upgrade e use Deno.upgradeWebSocket(req). Dentro do handler, manipule eventos open, message e close. Exemplo simples responde com data atual.
	•	Cliente WebSocket (proxy): use uma biblioteca Node (ws) via compat layer para conectar‑se a outro WebSocket (ex.: API da OpenAI) e encaminhar mensagens entre cliente e servidor.
	•	Autenticação: WebSockets não permitem cabeçalhos personalizados; passe o JWT no query string (?token=<JWT>) ou via protocolo personalizado. Verifique o token com supabase.auth.getUser(jwt) usando a chave de serviço; negue conexão se inválido.
	•	Teste local: altere supabase/config.toml definindo policy = "per_worker" para impedir encerramento automático de conexões ao rodar localmente.

Roteamento personalizado

Para evitar várias funções, você pode criar rotas dentro de uma função usando frameworks ou a API URLPattern. Exemplo com Hono:
const app = new Hono();
app.get('/hello-world', (c) => c.json({ message: 'GET hello' }));
app.post('/hello-world', async (c) => {...});
Deno.serve(app.fetch);
Ou diretamente com URLPattern:
const pattern = new URLPattern({ pathname: '/tasks/:id' });
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = pattern.exec(url.pathname);
  if (match) {
    const id = match.pathname.groups.id;
    // tratar GET, PUT, DELETE
  }
});
Módulos WebAssembly

É possível executar código Wasm dentro de Edge Functions para operações de alto desempenho. Crie um módulo Rust com wasm-bindgen exportando funções (ex.: pub fn add(a: i32, b: i32) -> i32), compile com wasm-pack build --target deno e importe no handler. Liste o pacote como static em supabase/config.toml e implante com CLI ≥ 2.7.0 (o --use-api não suporta arquivos estáticos).

Funções com IA

Supabase integra modelos de IA através do pacote @supabase/ai. Crie uma sessão com new Supabase.ai.Session('model') e chame model.run() para embeddings ou geração de texto. Também é possível apontar para servidores locais (Ollama ou Llamafile) definindo a variável AI_INFERENCE_API_HOST via supabase secrets set e implantando a função. A inferência pode retornar streaming ReadableStream.

Exemplos de uso

A documentação fornece diversas funções de exemplo. Alguns destaques:
	•	Email de autenticação personalizado – Use o send email hook para interceptar eventos de login/cadastro e enviar emails customizados. O exemplo utiliza standardwebhooks para verificar a assinatura do hook, extrai dados do usuário e token do payload e envia um email com React Email e Resend API.
	•	Suporte a CORS – Para permitir chamadas de navegadores de outros domínios, trate requisições OPTIONS retornando cabeçalhos Access-Control-Allow-Origin, Access-Control-Allow-Headers e Access-Control-Allow-Methods. Importe esses cabeçalhos em todas as funções para simplificar.
	•	Agendando funções (cron) – Utilize as extensões pg_cron e pg_net no Postgres. Armazene a URL da função e a API key no Supabase Vault. Agende chamadas com cron.schedule('call_my_func', '*/1 * * * *', $$ select net.http_post(vault.secret_value('my_url'), json '...', headers := json ...) $$) para executar periodicamente.

Além desses, há exemplos para enviar notificações push, gerar imagens com IA, criar OG images, pesquisa semântica, captchas, bots para Slack/Discord/Telegram, webhooks Stripe, rate limiting com Redis, screenshots com Puppeteer, entre outros. Cada exemplo demonstra como integrar as funções com APIs externas, lidar com webhooks e gerenciar secrets.

Considerações finais

Supabase Functions oferecem uma plataforma serverless integrada ao ecossistema Supabase. Com suporte a TypeScript, Deno, importação de pacotes npm, armazenamento persistente/efêmero, WebSockets, Wasm, AI e ferramentas de segurança (RLS, JWT), elas permitem construir APIs de alta performance, webhooks e processos assíncronos com mínimo esforço de infraestrutura. Use as práticas recomendadas de erro/logging, defina regionais e limites adequados, e aproveite as ferramentas de teste e depuração para garantir confiabilidade.