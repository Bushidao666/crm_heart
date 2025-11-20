# Análise e extração RAG.pdf — Texto extraído

> Conversão para Markdown com **texto extraído** (melhor esforço; pode perder formatação e elementos visuais).


## Página 1

Guia Completo da API ipdata
Este documento compila o conteúdo prático das páginas de documentação da API ipdata, organizado
em tópicos para facilitar a indexação e a recuperação via RAG. Foram removidos textos promocionais,
meta‑tags e histórias, mantendo apenas as informações úteis para desenvolvedores que desejam
integrar as funcionalidades de geolocalização, reputação e detecção de ameaças em seus projetos. As
informações estão atualizadas até setembro de 2025.
Conceitos Básicos e Inicialização
Endpoints básicos
Lookup automático: uma requisição GET a https://api.ipdata.co?api-key=CHAVE
retorna os dados da API para o endereço IP da máquina que faz a chamada. Para ambientes
com requisitos de privacidade europeus existe o endpoint https://eu-api.ipdata.co  com
as mesmas funcionalidades
.
Lookup de IP específico: para geolocalizar ou analisar um IP diferente, inclua o endereço na
rota: https://api.ipdata.co/8.8.8.8?api-key=CHAVE . Os parâmetros de consulta
permitem filtrar campos com fields=campo1,campo2
.
Campos únicos via rota: acessando um campo como rota ( /country_name , /ip  etc.) a API
retorna apenas esse valor em texto puro, útil para scripts simples
.
Quota e limites: cada chamada conta como 1 requisição. Para chamadas em lote via bulk  a
contagem considera a quantidade de IPs enviados
.
Endpoint da União Europeia: https://eu-api.ipdata.co  oferece as mesmas
funcionalidades e é indicado para conformidade com legislação de dados europeia
.
Instalação do CLI
O utilitário de linha de comando da ipdata facilita consultas rápidas sem escrever código.
Instalação: use python3 -m pip install ipdata  para instalar o pacote
.
Configuração: inicialize informando sua chave: ipdata init CHAVE , ou forneça a opção --
api-key  em cada chamada
.
Comandos principais:
ipdata : sem argumentos retorna os dados do IP da máquina local.
ipdata <IP> : consulta um IP específico. Use -p  para impressão formatada em tabela e -c
para copiar o resultado para a área de transferência
.
-f  ou --fields : filtra campos da resposta. Ex.: ipdata 24.24.24.24 -f ip -f is_eu
retorna apenas o IP e o indicador de União Europeia
.
ipdata usage : mostra o número de consultas realizadas nas últimas 24 horas
.
ipdata batch <arquivo.csv> : processa listas de IPs (centenas de milhares) e grava os
resultados em JSON ou CSV; é recomendado para uso pago
.
Validação de geofeed: o comando ipdata validate <arquivo>  verifica feeds de
geolocalização conforme o RFC 8805 (código ISO do país, região válida, redes públicas)
.
• 
1
• 
2
• 
2
• 
3
• 
1
1. 
4
2. 
4
3. 
4. 
5. 
5
6. 
5
7. 
4
8. 
6
9. 
7
1

## Página 2

Uso cliente versus servidor
Chamadas client‑side: em aplicações web o endereço do usuário é inferido a partir da conexão;
basta chamar https://api.ipdata.co?api-key=CHAVE . Chaves expostas em JavaScript
podem ser restringidas via lista branca (whitelist), disponível para planos pagos: especifique
domínios ou IPs autorizados; chamadas de outros hosts serão bloqueadas
.
Chamadas server‑side: quando a aplicação está no servidor, inclua o IP da pessoa na rota (ex.: 
https://api.ipdata.co/8.8.8.8?api-key=CHAVE ). Caso não informe o IP, a API retornará
a localização do servidor em vez do cliente
.
Como obter o IP do cliente: depende da stack. Em PHP utilize $_SERVER['REMOTE_ADDR'] ;
em Cloudflare $_SERVER['HTTP_CF_CONNECTING_IP'] ; em AWS Lambda, 
event['requestContext']['http']['sourceIp']
. Em JavaScript puro é possível
capturar o IP local e público usando WebRTC; alternativamente, chame a API ipdata via JSONP
para receber o IP de forma rápida
.
Cuidado com o referer: para que o whitelisting funcione, não defina 
<meta name="referrer" content="no-referrer"/> ; isso impede o envio do cabeçalho 
Referer, que a ipdata usa para validar o domínio
.
Geolocalização e Campos de Resposta
Campos de geolocalização
Ao consultar um IP, a ipdata retorna um objeto JSON contendo campos de geolocalização. Os principais
campos são:
Campo
Descrição
ip
Endereço IP consultado
is_eu
true  se o país faz parte da União Europeia
city , region , region_code
Cidade, região e código ISO da região
country_name , 
country_code
Nome e código ISO 3166‑1 alpha‑2 do país
continent_name , 
continent_code
Continente e código correspondente
latitude , longitude
Coordenadas decimais
postal
Código postal, quando disponível
calling_code
Código de chamada internacional do país
flag , emoji_flag , 
emoji_unicode
URL e emojis da bandeira
languages
Lista de idiomas oficiais com nome, código ISO 639‑1, código
nativo e nome nativo
count
Número de requisições feitas com a chave nas últimas
24 horas
• 
8
• 
8
• 
8
9
• 
10
11
11
11
11
11
11
11
11
11
2
2

## Página 3

Dados de operadora de telefonia (carrier)
Para IPs de redes móveis a ipdata retorna um objeto carrier  com os campos:
Campo
Descrição
name
Nome da operadora ou marca
mcc
Mobile Country Code (MCC) – código do país na telefonia móvel
mnc
Mobile Network Code (MNC) – código da rede móvel dentro do país
Dados de fuso horário (timezone)
O endpoint /time_zone  ou o campo time_zone  devolve informações sobre o fuso horário:
Campo
Descrição
name
Identificador do fuso horário (ex.: America/Sao_Paulo)
abbr
Abreviação (ex.: BRT)
offset
Deslocamento em minutos em relação ao UTC
is_dst
Indica se o horário de verão está ativo
current_time
Timestamp ISO com data e hora local
Dados de moeda (currency)
O endpoint /currency  retorna detalhes sobre a moeda oficial do país do IP:
Campo
Descrição
name
Nome da moeda (ex.: Australian Dollar)
code
Código ISO 4217 (ex.: AUD)
symbol
Símbolo monetário (ex.: $ )
native
Símbolo no formato local
plural
Nome no plural
Inteligência de ameaças
O endpoint  /threat  adiciona ao objeto um conjunto de sinalizadores booleanos e pontuações de
reputação:
is_tor : true  se o IP é um nó de saída da rede Tor
.
is_vpn : true  para VPNs comerciais detectadas
.
is_proxy : indica proxies anônimos, proxies reversos ou proxies abertos
.
is_icloud_relay : true  se for um relé privado da Apple
.
is_datacenter : IPs de datacenters e provedores de cloud
.
12
12
12
13
13
13
13
13
14
14
14
14
14
• 
15
• 
16
• 
15
• 
15
• 
15
3

## Página 4

is_anonymous : IP pertence a serviços de anonimização (Tor ou proxy)
.
is_known_attacker  / is_known_abuser : IP está associado a ataques ou abuso conhecido
.
is_threat : true  quando o IP está em listas de bloqueio consideradas de alta confiança
.
is_bogon : IP pertence a faixas não roteáveis ou reservadas
.
blocklists : array com os nomes das listas em que o IP aparece (por exemplo, Spamhaus)
.
scores : mapa com pontuações de reputação:
vpn_score : probabilidade de o IP ser um nó de VPN (0–1). Use junto com is_vpn  – quando 
is_vpn  for true , trata‑se de uma VPN comercial; quando false , valores altos indicam alto
risco de VPN autogerida
.
proxy_score : probabilidade de o IP ser um proxy
.
threat_score : probabilidade de o IP representar uma ameaça, mesmo que ainda não conste
em listas
.
trust_score : escala de 0 a 100; acima de 60 indica baixo risco, 40–60 risco moderado e
abaixo de 40 alto risco
.
Tipos de uso (usage type)
O  campo  asn.type  indica  o  tipo  de  uso  do  sistema  autônomo:  hosting  (datacenter),  isp
(provedor  de  acesso),  cdn ,  edu  (instituição  educacional),  gov  (governo),  mil  (militar)  ou
business
.
Dados ASN
Dados ASN básicos
O endpoint /asn  adiciona um objeto com informações do sistema autônomo associado ao IP:
Campo
Descrição
asn
Número do Sistema Autônomo (ASN)
name
Nome da organização responsável pelo ASN
domain
Domínio principal da organização
route
Prefixo de rede mais específico associado ao IP
type
Tipo de uso (hosting, isp, cdn, etc.)
API ASN avançada
Para  obter  informações  detalhadas  sobre  um  ASN  específico,  utilize  https://api.ipdata.co/
AS<Número>?api-key=CHAVE . Essa rota retorna:
Campo
Descrição
domain
Domínio principal da organização que opera o ASN
usage
Tipo de uso (hosting, isp, cdn, etc.)
• 
15
• 
15
• 
15
• 
15
• 
15
• 
• 
16
• 
15
• 
17
• 
17
18
18
18
18
18
18
19
19
4

## Página 5

Campo
Descrição
name
Nome completo da organização
ipv4_prefixes , ipv6_prefixes
Lista de prefixos IPv4 e IPv6 anunciados
num_ips
Quantidade total de endereços IP no ASN
registry
Registro regional (ex.: ARIN, RIPE)
country
Código do país onde o ASN está registrado
date
Data de atribuição
status
Situação atual (allocated, assigned, etc.)
upstream , downstream , peers
Listas de ASNs de trânsito e pares
Dados de Empresas
Disponível a partir do plano Startup, o campo company  contém:
Campo
Descrição
name
Nome da empresa dona da rede
domain
Domínio da empresa
network
Intervalo de IPs da empresa
type
Categoria de uso (hosting, isp, business, etc.)
Listas de Bloqueio e Reputação
blocklists: lista de fontes de onde o IP foi sinalizado como malicioso. A ipdata consulta mais de
100 listas OSINT (ex.: Spamhaus). Planos Business/Enterprise também incluem listas comerciais
de parceiros como HoneyDB e Cleantalk
. Usuários podem sugerir listas.
Reputação: conforme descrito em Inteligência de Ameaças, as pontuações vpn_score , 
proxy_score , threat_score  e trust_score  auxiliam na tomada de decisões. Uma 
trust_score  baixa (<40) indica alto risco; use as pontuações para ajustar a autenticação ou
bloquear acessos
.
Detecção de VPN, Proxy e Tor
A ipdata mantém uma lista de saídas de VPN comerciais. O campo is_vpn  sinaliza se o IP pertence a
uma VPN conhecida; o vpn_score  (0–1) indica a probabilidade do IP usar uma VPN não comercial.
Sugestões de uso
:
Bloquear ou exigir autenticação adicional quando is_vpn  for true .
Usar vpn_score  como sinal de risco quando is_vpn  for false  – valores altos sugerem
VPN autogerida.
Combinar com outros flags: is_proxy , is_anonymous , is_threat  ajudam a decidir se o
usuário deve ser bloqueado ou ter acesso restrito
.
19
19
19
19
19
19
19
19
20
20
20
20
• 
21
• 
17
16
1. 
2. 
3. 
15
5

## Página 6

Bibliotecas de Cliente
Python
Instale via pip install ipdata  ou easy_install ipdata
.
Configure a chave: ipdata.api_key = 'CHAVE'  e chame ipdata.lookup()  para obter os
dados do IP local ou ipdata.lookup('8.8.8.8')  para um IP específico
.
Seleção de campos: passe select_field='country_name'  para obter um único campo ou 
fields=['ip','city','asn']  para múltiplos
.
Batch: o método bulk(ips, fields=None)  aceita até 100 IPs e retorna uma lista de objetos
.
JavaScript / Node.js
Instale com npm install ipdata
.
Importe: import IPData from 'ipdata'  (ES6) ou const IPData = 
require('ipdata').default
.
Crie uma instância: const ipdata = new IPData('CHAVE') .
Métodos principais: lookup()  (IP da chamada), lookup(ip, selectField)  para campo
único, lookup(ip, null, fieldsArray)  para vários campos, e bulkLookup(ips, 
fieldsArray)  para múltiplos IPs
【312873092408470†L210-L247】.
O cliente armazena em cache até 4096 respostas para melhorar a performance; ajuste com 
maxCacheSize
.
Filtragem de Campos
Para reduzir o tamanho das respostas, utilize a query fields=campo1,campo2  ou chame um campo
individual  como  rota.  A  lista  de  campos  permitidos  inclui  ip,  is_eu,  city,  region,  country_name,
country_code, continent_name, latitude, longitude, asn, company, postal, calling_code, flag, carrier,
languages, currency, time_zone, threat, count e muitos outros
.
Códigos de Status da API
Código
Significado
200
Sucesso - requisição atendida normalmente
400
Requisição inválida – IP incorreto, JSON mal formado ou mais de 100 IPs na rota /bulk
401
Falta de autorização – API key ausente ou inválida
403
Acesso negado – excedeu quota, chamadas demasiadas ou funcionalidade restrita (bulk,
ASN avançado, etc.); também retorna 403 se a requisição não estiver na whitelist
404
Não encontrado – ASN desconhecido ou recurso inexistente
Perguntas Frequentes (FAQ) – Resumo
Contador de chamadas: o campo count  indica quantas requisições foram feitas nas últimas
24 horas; gráficos de uso estão disponíveis no painel
.
• 
22
• 
22
• 
22
• 
23
• 
24
• 
24
• 
• 
24
• 
24
2
25
25
25
25
25
• 
26
6

## Página 7

Renovação de quotas: as quotas renovam todos os dias às 00:00 UTC
.
Plano gratuito: permite 1 500 requisições diárias e pode ser reduzido conforme o uso; se
ultrapassar, o serviço bloqueia novas chamadas até a renovação
.
Dicas para reduzir uso: faça cache das respostas em vez de chamar a API em todas as
visualizações de página; identifique bots que possam estar consumindo a quota; utilize a
whitelist para impedir uso indevido
.
Atualizações de dados: alocações de IP são atualizadas diariamente e agregadas
quinzenalmente; dados de ameaças são atualizados a cada 15 minutos e agregados a cada hora
.
Conformidade com GDPR: a ipdata atua como processadora de dados e não armazena IPs
consultados, exceto por 24 horas para controle de taxa
.
Uso em múltiplos domínios: a mesma chave pode ser usada em vários domínios; nos planos
pagos é possível limitar domínios via whitelist
.
Validação e Publicação de Geofeed
Geofeeds são listas CSV que associam prefixos IP a localizações detalhadas (RFC 8805). A ipdata fornece
ferramentas para validar e publicar esses arquivos:
Formato: cada linha contém network, country_code, region_code, city, 
postal_code
. O país e a região devem seguir os códigos ISO 3166‑1 e 3166‑2; a rede não
pode ser privada ou reservada
.
Validação: use ipdata validate <caminho_do_arquivo>  para verificar formato, códigos
válidos e correspondência entre país e região
.
Publicação: você pode armazenar o arquivo em um repositório GitHub, Google Sheets ou site
próprio e informar à ipdata via e‑mail. Para distribuição mais ampla, adicione a linha 
geofeed: URL_DO_ARQUIVO  no registro whois da sua organização
.
Proteção da Chave de API (Whitelist)
Usuários de planos pagos podem restringir o uso de suas chaves:
Adicionar host ou IP: liste domínios (com ou sem esquema) ou endereços IP permitidos. Separe
entradas com vírgulas ou linhas
.
Excluir: para remover um host da lista, prefixe com um traço (‑). Para limpar toda a lista,
selecione “Clear whitelist”
.
Incluir localhost: para testes locais, adicione localhost  com a porta usada
.
Não mascarar referer: evite definir meta tag referrer  como no-referrer , pois o
cabeçalho Referer é necessário para a validação da whitelist
.
JSONP e CORS
Para chamadas cross‑domain em navegadores, passe o parâmetro callback=nomeDaFunção . A API
retornará a resposta encapsulada nessa função. Exemplo com jQuery:
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
console.log(response.ip);
console.log(response.country_name);
}, 'jsonp');
• 
26
• 
26
• 
26
• 
27
• 
27
• 
27
• 
28
7
• 
7
• 
29
1. 
10
2. 
10
3. 
10
4. 
10
7

## Página 8

``` Este método evita erros de CORS sem necessidade de proxy e é útil para aplicações front‑end
.
Consultas em Lote (Bulk Lookup)
Endpoint /bulk
Usuários de planos pagos podem enviar até 100 IPs por requisição POST em JSON para  https://
api.ipdata.co/bulk?api-key=CHAVE . O corpo deve ser um array de endereços IP e a resposta é
uma lista de objetos com todos os campos padrão. Cada IP conta como uma requisição
.
CLI Batch
A  CLI  suporta  processar  milhões  de  IPs  utilizando  ipdata  batch  lista.csv  --output  
resultado.json --format JSON  ou --format CSV --fields ip --fields country_code . É
recomendado para listas muito grandes e utiliza pipeline otimizado
.
Como obter localização e IP usando JavaScript
Obter endereço IP do cliente
Existem duas abordagens:
WebRTC: navegadores modernos permitem descobrir os endereços IP locais e público do
usuário via WebRTC, utilizando um servidor STUN. O script utiliza RTCPeerConnection  para
coletar candidatos ICE e extrair os IPs. Essa abordagem fornece IPs locais e IPv6, mas requer
permissões e pode ser bloqueada por plugins de privacidade
.
API ipdata: a forma mais simples é chamar https://api.ipdata.co?api-key=CHAVE  com
JSONP. A API identifica o IP público do usuário e retorna os dados de geolocalização. Exemplo
em jQuery: javascript
   $.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
       console.log('IP:', response.ip);
   }, 'jsonp');
.
Obter localização do usuário via JavaScript
Um dos recursos mais úteis da ipdata é que você não precisa passar o IP: a API detecta o IP do usuário
e devolve campos como cidade e país. Exemplo de requisição jQuery:
javascript
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
    console.log(response.country_name);
    console.log(response.city);
}, 'jsonp');
.
Usando XMLHttpRequest  puro:
javascript
var request = new XMLHttpRequest();
request.open('GET', 'https://api.ipdata.co/?api-key=CHAVE');
request.setRequestHeader('Accept', 'application/json');
30
3
6
1. 
9
2. 
9
31
8

## Página 9

request.onreadystatechange = function () {
  if (this.readyState === 4) {
    var data = JSON.parse(this.responseText);
    console.log('País:', data.country_name);
  }
};
request.send();
.
Geolocalização HTML5 com fallback ipdata
O  HTML5  fornece  navigator.geolocation.getCurrentPosition  para  recuperar  latitude  e
longitude do dispositivo. Entretanto, o usuário pode bloquear a permissão ou o navegador pode não
suportar a API. O exemplo a seguir tenta usar a API do navegador e, em caso de falha, faz uma
requisição ao ipdata para obter as coordenadas:
```javascript
 
function
 
geoFindMe()
 
{
 
if
 
(navigator.geolocation)
{
 
navigator.geolocation.getCurrentPosition(success,
 
error,
 
geoOptions);
 
}
 
else
{ console.log('Geolocalização não suportada'); } }
function  success(position)  {  const  latitude  =  position.coords.latitude;  const  longitude  =
position.coords.longitude; console.log('lat:', latitude, 'long:', longitude); }
function error() { var request = new XMLHttpRequest(); request.open('GET', 'https://api.ipdata.co/?api-
key=CHAVE');  request.setRequestHeader('Accept',  'application/json');  request.onreadystatechange  =
function  ()  {  if  (this.readyState  ===  4)  {  var  data  =  JSON.parse(this.responseText);  console.log('lat:',
data.latitude, 'long:', data.longitude); } }; request.send(); }
const geoOptions = { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 };
geoFindMe(); ```
.
Exemplos de Bloqueio e Personalização
Bloquear usuários por país
Utilize JSONP para recuperar o código do país e compare com uma lista de países proibidos. Exemplo
com jQuery:
javascript
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
  var blocked = ['CN','RU','IR'];
  if (blocked.includes(response.country_code)) {
    alert('Acesso não permitido em seu país.');
  } else {
    // carregar conteúdo normalmente
  }
}, 'jsonp');
.
32
33
34
35
9

## Página 10

Bloquear VPN/Proxy e Tor
Verifique
 
os
 
sinalizadores
 is_anonymous ,
 is_proxy ,
 is_known_attacker  
e
is_known_abuser  no objeto  threat . Caso qualquer um seja  true , interrompa o cadastro ou
acesso. Exemplo:
javascript
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
  const t = response.threat;
  if (t.is_anonymous || t.is_proxy || t.is_known_attacker || t.is_known_abuser) {
    alert('Serviço não disponível para VPN/Proxy/Tor ou IP malicioso.');
    return;
  }
  // permitir acesso
}, 'jsonp');
.
Personalizar conteúdo por país
Para oferecer promoções ou conteúdo direcionado, use a informação de país, cidade ou região. O
exemplo abaixo exibe uma oferta especial aos usuários do Reino Unido:
javascript
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
  if (response.country_code === 'UK') {
    alert('Oferta especial para nossos usuários do ' + response.country_name + 
'!');
  }
}, 'jsonp');
. Você também pode personalizar por região, cidade, código postal, fuso horário ou
moeda.
Redirecionar por país
Redirecione usuários para uma loja ou página específica conforme o país:
javascript
$.get('https://api.ipdata.co?api-key=CHAVE', function(response) {
  if (response.country_code === 'UK') {
    window.location.href = 'https://uk.store.exemplo.com';
  } else if (response.country_code === 'DE') {
    window.location.href = 'https://de.store.exemplo.com';
  } else if (response.country_code === 'AU') {
    window.location.href = 'https://au.store.exemplo.com';
  }
}, 'jsonp');
. Esse padrão é comum em e‑commerce internacional para enviar o usuário ao site
na sua língua/moeda.
36
37
38
10

## Página 11

Dicas Adicionais
Cache de resultados: para economizar quota, armazene localmente os resultados de IPs
frequentes em vez de fazer chamada em todas as visitas
.
Automatize atualizações: os dados de ameaças são atualizados a cada 15 minutos; para
decisões críticas, atualize caches com frequência
.
Envio de correções: se encontrar erros de geolocalização, envie um relatório via formulário; a
ipdata corrige problemas em poucos dias
.
Este guia resume as funcionalidades da ipdata de forma estruturada e em português, facilitando a
integração em agentes e sistemas de Inteligência Artificial que utilizem Recuperação Aumentada de
Conteúdo (RAG). 
Quick Start
https://docs.ipdata.co/docs/getting-started
Filtering Response Fields
https://docs.ipdata.co/docs/filtering-response-fields
Bulk Lookup
https://docs.ipdata.co/docs/bulk-lookup
Install the ipdata CLI
https://docs.ipdata.co/docs/install-the-ipdata-cli
Advanced Usage
https://docs.ipdata.co/docs/getting-started-1
Batch Lookups
https://docs.ipdata.co/docs/bulk-lookups-recommended
Geofeed Validation
https://docs.ipdata.co/docs/geofeed-validation
Client-side vs Server-side
https://docs.ipdata.co/docs/client-side-vs-server-side
How to get a client's IP address using JavaScript
https://docs.ipdata.co/docs/how-to-get-a-clients-ip-address-using-javascript
Secure your API Key (Premium)
https://docs.ipdata.co/docs/secure-your-api-key-premium
Geolocation
https://docs.ipdata.co/docs/geolocation
Mobile Carrier
https://docs.ipdata.co/docs/mobile-carrier-detection
Timezone
https://docs.ipdata.co/docs/timezone-detection
Currency
https://docs.ipdata.co/docs/currency-detection
• 
26
• 
27
• 
27
1
2
3
4
5
6
7
8
9
33
10
11
12
13
14
11

## Página 12

Threat Intelligence
https://docs.ipdata.co/docs/proxy-tor-and-threat-detection
VPN Detection
https://docs.ipdata.co/docs/vpn-detection
IP Reputation Scores
https://docs.ipdata.co/docs/ip-reputation-scores
Basic ASN
https://docs.ipdata.co/docs/asn-data
Advanced ASN API
https://docs.ipdata.co/docs/asn-api
Company
https://docs.ipdata.co/docs/company
Blocklists
https://docs.ipdata.co/docs/blocklists
Python
https://docs.ipdata.co/docs/python
Javascript
https://docs.ipdata.co/docs/javascript
API Status Codes
https://docs.ipdata.co/docs/api-status-codes
Frequently Asked Questions
https://docs.ipdata.co/docs/frequently-asked-questions
Publishing a Geofeed
https://docs.ipdata.co/docs/publishing-a-geofeed
JSONP
https://docs.ipdata.co/docs/jsonp
HTML5 Geolocation with ipdata fallback
https://docs.ipdata.co/docs/html5-geolocation-with-ipdata-fallback
Get the location from an IP Address in Javascript
https://docs.ipdata.co/docs/get-the-location-from-an-ip-address-in-javascript
Blocking Users by Country
https://docs.ipdata.co/docs/blocking-users-by-country
Block VPN/Proxy and Tor users
https://docs.ipdata.co/docs/block-vpnproxy-and-tor-users
Personalize by Country
https://docs.ipdata.co/docs/personalize-by-country
Redirect by Country
https://docs.ipdata.co/docs/redirect-by-country
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
34
32
35
36
37
38
12
