# Secretária IA — Pilot WhatsApp Gateway

Serviço temporário de validação comercial. Mantém múltiplas sessões WhatsApp vinculadas, isoladas por `company_id`, e **somente recebe mensagens**. Não há rota nem chamada de envio.

## Segurança
- JWT do usuário é validado no Supabase;
- somente `owner/admin` conecta/desconecta;
- sessão é isolada por empresa;
- credenciais Signal são cifradas AES-256-GCM antes de serem salvas;
- chave de cifragem e service role existem somente no servidor;
- QR fica somente em memória e expira junto com o ciclo de pareamento;
- grupos/status/newsletters são ignorados no piloto V1;
- mensagens são deduplicadas pelo ID do provedor;
- falha/reconexão de uma empresa não encerra as demais.

## Railway
Crie um serviço apontando Root Directory para `/pilot-gateway`, configure as variáveis de `.env.example`, gere um domínio e use `/health` como Healthcheck Path. Não habilite Serverless/App Sleeping: as sessões precisam ficar ativas.

Gere `PILOT_AUTH_ENCRYPTION_KEY` localmente:

`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## Aviso
Baileys é uma integração não oficial com WhatsApp Web. Este gateway é deliberadamente um piloto temporário; a produção final deve migrar para Meta/Cloud API/Coexistence.
