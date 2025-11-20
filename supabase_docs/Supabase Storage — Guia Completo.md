Supabase Storage — Guia Completo

Este guia reúne o conteúdo prático das páginas de documentação da Storage (Armazenamento) da Supabase. As informações foram organizadas por tópicos para facilitar a consulta em um sistema de recuperação de conhecimento (RAG). Códigos de exemplo, parâmetros e práticas recomendadas foram incluídos enquanto metadados, cabeçalhos e histórias foram descartados.

Visão geral
	•	Supabase Storage permite fazer upload e servir arquivos usando buckets armazenados em um provedor S3 interno. Os objetos são armazenados de forma separada da base de dados, e o serviço usa Row‑Level Security (RLS) do PostgreSQL para controle de acesso.
	•	Todo arquivo está em um bucket (superpasta) e possui um caminho folder/subfolder/filename. Pastas não são objetos, são apenas parte do caminho. Nomes de buckets e arquivos devem seguir as regras do Amazon S3 (evitar caracteres fora do padrão e nomes longos).
	•	Buckets podem ser privados ou públicos. Buckets privados exigem autenticação (JWT) ou URLs assinadas para download; buckets públicos podem servir arquivos sem autenticação mas ainda exigem permissão RLS para uploads e exclusões.
	•	O serviço fornece CDN global com cache inteligente para objetos públicos. Há suporte a transformações de imagens sob demanda (redimensionamento, qualidade, formato), logs e métricas de cache, além de integração com clientes S3 e compatibilidade com Apache Iceberg via “Analytics Buckets”.

Primeiros passos e operações básicas

Conceitos (arquivos, pastas e buckets)
	•	Arquivo: objeto individual armazenado em um bucket. As extensões de arquivos determinam o Content‑Type automaticamente, mas podem ser definidas manualmente com a opção contentType ao fazer upload.
	•	Pasta: não são objetos, apenas parte do caminho (folder/subfolder/filename); facilitam organização e podem ser usadas em políticas RLS.
	•	Bucket: contêiner que agrupa arquivos e pastas; pode ser público ou privado. Pode ter limites de tamanho e tipos MIME permitidos.

Criar bucket
	•	Pelo painel: vá em Storage →  Create Bucket, forneça um nome e defina se é público; opcionalmente configure allowedMimeTypes e fileSizeLimit para restringir uploads (ex.: somente imagens PNG de até 5 MB).
	•	Via API/JS: await supabase.storage.createBucket('avatars', { public: true, allowedMimeTypes: ['image/png'], fileSizeLimit: 5 * 1024 * 1024 }).

Upload e download de arquivos
	•	Upload padrão (multipart/form‑data): ideal para arquivos até 6 MB. Use supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: 'image/png' }).
	•	Sobrescrever arquivos não é recomendado devido ao cache do CDN; se necessário, use a opção upsert: true ou o cabeçalho x‑upsert: true.
	•	Conflitos de concorrência: o primeiro upload vence; com x‑upsert, o último vence.
	•	Upload resumível (TUS): recomendado para arquivos > 6 MB ou redes instáveis. Use bibliotecas como tus‑js‑client ou uppy apontando o endpoint .../storage/v1/upload/resumable. Envie metadata (bucketName, objectName, contentType, cacheControl) e chunkSize (6 MB). O servidor retorna uma URL de upload válida por 24 h; uploads concorrentes sem x‑upsert geram erro 409.
	•	Uploads via protocolo S3: permite integração com SDKs AWS. O método PutObject faz upload de arquivos até 5 GB; MultipartUpload (classe @aws-sdk/lib-storage) divide arquivos em partes e suporta até 500 GB em planos pagos.
	•	Limites de tamanho: o limite global de upload é configurável; projetos Free podem definir até 50 MB e planos Pro/Team até 500 GB. Cada bucket pode definir seu próprio limite desde que não ultrapasse o limite global.
	•	Download de arquivos: você pode usar o dashboard (clicar no arquivo e selecionar Download) ou gerar uma URL via getPublicUrl() (para buckets públicos) ou createSignedUrl() (privados). Adicione ?download para forçar o download em vez de exibir no navegador.

Gerenciar segurança
	•	Row‑Level Security (RLS): todas as tabelas de metadata (storage.objects, storage.buckets) têm RLS habilitado por padrão. Sem políticas, nenhum upload, listagem ou exclusão é permitido.
	•	Definir políticas de upload: exemplo para permitir que apenas usuários autenticados façam upload para um bucket avatars:create policy "Allow uploads to avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');	•	Permissões de leitura: para permitir que usuários leiam apenas arquivos que carregaram, crie política comparando owner_id com auth.uid():create policy "Allow reads from avatars" on storage.objects
  for select
  using (bucket_id = 'avatars' and owner_id = auth.uid());	•	Permissões de exclusão: similar à leitura, mas para exclusão:create policy "Allow deletes from avatars" on storage.objects
  for delete
  using (bucket_id = 'avatars' and owner_id = auth.uid());create policy "User can read own files" on storage.objects
  for select to authenticated
  using (owner_id = (select auth.uid()));	•	Chave de serviço: você pode ignorar RLS ao usar o service_key no cabeçalho Authorization. Isso concede acesso completo para uso em servidores confiáveis; nunca exponha publicamente.
	•	Propriedade de objetos: quando um arquivo ou bucket é criado via sessão autenticada, o campo owner_id recebe o sub do JWT; ao usar service_key o owner fica nulo (qualquer usuário pode gerenciar se a política permitir). Use políticas para garantir que somente o dono possa deletar um objeto.

Uploads avançados e compatibilidade

Upload resumível (TUS)
	•	Use para arquivos grandes (> 6 MB) ou quando é provável que ocorra interrupção de rede.
	•	Requer envio de metadata com bucketName, objectName e contentType.
	•	Defina chunkSize de 6 MB (tamanho mínimo suportado).
	•	O cabeçalho opcional x‑upsert: true permite sobrescrever arquivos; sem ele, uploads concorrentes geram 409 Conflict.

Upload S3
	•	Autenticação: duas opções:
	•	Chaves S3: gere via Project Settings → Storage. Use o par Access Key ID e Secret Access Key junto com o endpoint https://<project_ref>.storage.supabase.co e a região configurada. Essas chaves têm acesso total a todos os buckets e ignoram RLS — use apenas em back‑ends seguros.
	•	Token de sessão: use o project_ref como accessKeyId, o anonKey como secretAccessKey e o JWT de sessão como sessionToken. Essa opção respeita políticas RLS, permitindo controle fino de acesso.
	•	Compatibilidade S3: a API é amplamente compatível com S3 (ListBuckets, HeadBucket, GetObject, PutObject, etc.), mas alguns recursos são não suportados: ACLs, CORS, SSE (Server‑Side Encryption), regras de ciclo de vida, tags, object locking, request payer e retornos de bucket owner. Operações condicional e headers de metadata são parcialmente suportadas.

Servindo e transformando objetos

Servir assets e URLs públicas
	•	Para buckets públicos, a URL de um objeto segue o padrão:
https://<project_ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
O método supabase.storage.from(bucket).getPublicUrl(path) gera essa URL automaticamente.
	•	Em buckets privados você precisa de um signed URL via createSignedUrl(path, expiresIn), onde expiresIn é a duração em segundos. Ex.: 3600 para 1 h.
	•	Adicione ?download ou ?download=<nome-personalizado> à URL para forçar o download do arquivo.

Transformações de imagem
	•	A Supabase oferece redimensionamento e otimização de imagens sob demanda (Pro Plan ou superior).
	•	Parâmetros suportados ao chamar getPublicUrl ou createSignedUrl:
	•	width e height (1‑2500) – defina um ou ambos para manter proporção;
	•	quality (20‑100, padrão 80);
	•	format (origin, webp, jpeg, etc.) – origin mantém o formato original;
	•	resize (cover, contain, fill).
	•	Limites: tamanho máximo do arquivo 25 MB, resolução ≤ 50 MP, formatos suportados (PNG, JPEG, WebP, AVIF, GIF, ICO, SVG, HEIC, BMP, TIFF).
	•	Next.js: utilize um loader customizado para integração; configure next.config.js apontando para o endpoint da Supabase.
	•	Autohospedagem: possível implantar o container imgproxy; defina ENABLE_IMAGE_TRANSFORMATION=true no API de storage e IMGPROXY_URL apontando para o serviço interno; não exponha o container publicamente.

Egress (largura de banda) e otimização
	•	Projetos gratuitos recebem 10 GB de egress (5 GB cacheado + 5 GB não cacheado). Planos pagos cobram egress adicional por GB. O egress inclui dados do banco, storage e funções.
	•	Para calcular egress, utilize o edge_logs para contar acessos e diferenciar hits de cache. Exemplo de consulta:select request.path as filepath, response.status, metadata.response.cached as cached, count(*) as num_requests
from logs
where request.path like '/storage/v1/object%'
group by 1, 2, 3;Em seguida, multiplique o tamanho do arquivo (obtido via curl -w "%{size_download}") pelo número de requisições.

	•	Dicas de otimização:
	•	Reduza dimensões e qualidade de imagens com transformações.
	•	Defina cabeçalho cache-control alto para que navegadores mantenham o asset em cache e minimizem downloads repetidos.
	•	Estabeleça limites de upload por bucket para evitar que usuários façam upload e download de arquivos grandes demais.
	•	Use Smart CDN (Pro Plan), que sincroniza metadados no edge e revalida o cache automaticamente em até 60 s; melhora a taxa de cache e funciona com URLs assinadas.
	•	Para atualizar um asset sem invalidar o cache global, carregue para um novo caminho ou inclua um parâmetro de versão (?v=2) na URL.

Gerenciamento de objetos

Deletar objetos
	•	Remover um objeto via API é permanente; não execute DELETE em storage.objects via SQL pois apenas removerá metadata, deixando o arquivo órfão.
	•	Use supabase.storage.from(bucket).remove(['path/file.ext']) para deletar vários arquivos.
	•	Política recomendada: permitir deleção apenas ao dono, usando owner_id = auth.uid().

Copiar e mover objetos
	•	Copiar: copy(from, to, { destinationBucket }) copia dentro ou entre buckets (até 5 GB).
	•	Mover: move(from, to, { destinationBucket }) realiza cópia e exclusão; altera o owner_id para o usuário que moveu.
	•	Exemplo de política: permitir mover somente arquivos próprios (owner_id = auth.uid()) e inserir no bucket de destino se a pasta pertence ao usuário.

Preços
	•	O armazenamento é cobrado pelo tamanho total dos objetos nos buckets. Cada plano inclui uma franquia: Free (1 GB, 744 GB‑h), Pro/Team (100 GB, 74 400 GB‑h). Uso excedente é cobrado ~US$ 0,021/GB por mês.
	•	Transformações de imagens são cobradas à parte: US$ 5 por 1 000 imagens de origem além do limite do plano.

S3 e compatibilidade

Autenticação S3
	•	Chaves S3: gere par de acesso/segredo no painel; forneça ao cliente S3 (por exemplo, AWS SDK) o endpoint e region do projeto. Essas chaves têm acesso total (ignorando RLS) e devem ser usadas apenas em backend de confiança.
	•	Token de sessão: utilize project_ref como accessKeyId, anonKey como secretAccessKey e o token de sessão como sessionToken. Isso limita o acesso de acordo com RLS.
	•	O serviço requer Signature Version 4 para autenticação.

Compatibilidade de API
	•	A Supabase implementa grande parte dos endpoints S3: listagem de buckets e objetos, criação/remoção de buckets, obtenção/ upload/ deleção de objetos, e multipart upload.
	•	Recursos não suportados incluem: ACLs de bucket/objeto, regras de ciclo de vida, tags, criptografia, site web hosting, SSE e request payer.
	•	Operações CopyObject e UploadPartCopy suportam metadados mas não suportam SSE ou tags.

Analytics Buckets (Iceberg)
	•	Finalidade: buckets especiais para workloads analíticos em grandes conjuntos de dados via Apache Iceberg; separados da base de dados para permitir consultas pesadas sem impactar o banco transacional.
	•	Criação: no dashboard, marque a opção Analytics Bucket ou use supabase.storage.createBucket('analytics', { type: 'ANALYTICS' }).
	•	Conectar: requer cliente Iceberg (Spark/Pyleberg) e credenciais S3. Configure o catálogo com s3.endpoint, uri (supabase_analytics), project_ref, token (service key) e credenciais. Exemplo com Python (Pyleberg) cria namespace, tabela e consulta dados.
	•	Limites: por padrão cada projeto suporta 2 analytics buckets, 10 namespaces por bucket e 10 tabelas por namespace; egress é cobrado normalmente.

CDN e caching

Conceitos de CDN
	•	Todos os arquivos são servidos através de um CDN global. Quando um usuário solicita um objeto, a CDN verifica se possui o arquivo em cache (resposta cf‑cache‑status: HIT). Caso contrário (MISS), busca no servidor de origem e armazena no nó de borda.
	•	Buckets públicos têm maior taxa de acerto de cache porque a autenticação não varia por usuário; buckets privados tendem a ter mais MISS pois cada usuário usa um JWT diferente.
	•	O arquivo pode ser removido do cache se não for solicitado por algum tempo; o TTL depende da configuração cache‑control. Para forçar atualização, adicione um parâmetro de query (ex.: ?v=2).

Smart CDN
	•	Recurso opcional (Pro Plan) que sincroniza metadados no edge e revalida o cache automaticamente quando um objeto é atualizado ou removido.
	•	O cache global se propaga em até 60 s.
	•	O cabeçalho cacheControl pode ser usado ao fazer upload para controlar o tempo de cache no navegador e no CDN.

Métricas de cache
	•	Use o Logs Explorer para consultar métricas de cache. O campo metadata.response.headers.cf_cache_status indica HIT ou MISS.
	•	Exemplo para listar os maiores cache misses por caminho:select request.path, count(*) as misses
from edge_logs
where metadata.response.headers ->> 'cf-cache-status' = 'MISS'
  and request.path like '/storage/v1/object%'
group by 1
order by misses desc;	•	Para calcular a taxa de acertos (hit ratio) ao longo do tempo: agrupe logs por hora e calcule a proporção de HIT e MISS.

Debugging

Logs
	•	A página de logs exibe requisições ao Storage. Você pode filtrar erros 5xx, 4xx, métodos HTTP ou IPs com consultas SQL.
	•	Exemplos:
	•	Erros 5xx: select * from storage_logs where status >= 500 order by timestamp desc limit 100.
	•	Erros 4xx: filtre status between 400 and 499.
	•	Filtrar por método (POST) ou endereço IP (request_ip = '...').

Códigos de erro
	•	A Supabase lista códigos de erro para operações de storage. Cada código tem uma descrição, status HTTP e resolução sugerida.
	•	Exemplos:
	•	NoSuchBucket (404): o bucket não existe; verifique o nome.
	•	NoSuchKey (404): o objeto não existe; verifique o caminho.
	•	EntityTooLarge (413): tamanho do arquivo excede o limite definido; aumente o limite global ou do bucket.
	•	InvalidJWT (401): token inválido ou expirado; forneça JWT válido.
	•	AccessDenied (403): falta de política RLS apropriada.
	•	ResourceAlreadyExists (409): bucket ou objeto já existe.
	•	DatabaseTimeout (544): timeout ao acessar o banco; verifique logs.
	•	SignatureDoesNotMatch (403): assinatura de requisição incorreta ao usar S3; verifique credenciais.
	•	Alguns códigos são de transição para um novo sistema de erros, mas a tabela mantém compatibilidade com o legado.

Troubleshooting (base de conhecimento)
	•	A página de troubleshooting oferece artigos de suporte sobre problemas comuns, como regras de egress, suspensão de projetos Pro, restrições de tamanho de upload e erros ao acessar buckets públicos. Ela funciona como um índice de artigos de ajuda com filtros por tags e palavras‑chave.

Esquema e funções no Postgres

Projeto da tabela storage
	•	A Supabase armazena metadados de buckets e objetos em um esquema Postgres chamado storage. Os registros são somente leitura; qualquer inserção, atualização ou deleção deve ser feita através da API, caso contrário você pode corromper a consistência entre metadados e arquivos.
	•	Principais tabelas:
	•	buckets: id, name, created_at, updated_at, public (bool), file_size_limit (bigint), allowed_mime_types (text[]), owner_id (text).
	•	objects: id (uuid), bucket_id, name (caminho), created_at, updated_at, metadata (jsonb), path_tokens (text[]), version (text), owner_id.
	•	migrations: controla migrações internas do esquema.
	•	Não modifique a estrutura do esquema; alterações podem quebrar atualizações futuras.

Funções auxiliares
	•	A Supabase oferece funções SQL para auxiliar na criação de políticas RLS:
	•	storage.filename(name) – retorna apenas o nome do arquivo (último segmento do caminho). Útil para permitir download de arquivos específicos.
	•	storage.foldername(name) – retorna um array com todas as pastas no caminho. Permite limitar uploads a uma pasta específica (ex.: foldername(name)[1] = 'private').
	•	storage.extension(name) – retorna a extensão do arquivo (ex.: png). Pode restringir uploads a certos tipos, por exemplo permitir apenas PNGs em um bucket.

Funções e políticas com papéis personalizados
	•	É possível criar roles personalizados para conceder acesso a buckets específicos. Exemplo:create role manager;
grant manager to authenticator;
grant manager to anon;

create policy "Manager can view all files in bucket teams" on storage.objects
  for select to manager
  using (bucket_id = 'teams');	•	Para testar, gere um JWT assinado com o papel manager usando sua JWT_SECRET e passe como header Authorization: Bearer <token> na API. O exemplo utiliza a biblioteca jsonwebtoken para criar o token e a biblioteca @supabase/storage-js para fazer requisições.

Otimizações para produção (scaling)
	•	Reduza egress: otimize imagens, use transformações, defina cache-control alto, limite o tamanho de upload, ative Smart CDN e mova assets frequentemente atualizados para novos caminhos.
	•	Optimize listing: a função storage.list() calcula hierarquias e pode ficar lenta com muitos objetos. Crie uma função Postgres list_objects(bucketId, prefix, limit, offset) para listar objetos rapidamente e chame-a via RPC no client (exemplo no SDK).
	•	Aprimore RLS: ao criar políticas RLS, adicione índices nas colunas usadas em condições (bucket_id, owner_id, path_tokens) para acelerar a filtragem.

Conclusão

Esta síntese cobre todos os tópicos da documentação de Supabase Storage, desde conceitos básicos até autenticação via S3, CDN avançado, buckets analíticos e otimizações de produção. Use-a como referência rápida para implementar armazenamento robusto e seguro no seu projeto Supabase.