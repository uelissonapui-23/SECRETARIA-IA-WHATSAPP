# Piloto comercial: WhatsApp Web somente leitura

Fluxo: WhatsApp Web -> extensão local -> Secretária IA -> pipeline existente -> sugestão -> usuário confirma.

A ponte NÃO envia mensagens, NÃO responde clientes e NÃO clica automaticamente em conversas.

Limitação: o WhatsApp Web não oferece API pública para leitura de todos os chats. A ponte captura somente mensagens recebidas que o próprio WhatsApp Web renderiza. Isso permite um piloto real controlado sem fingir que já temos a integração oficial.

Depois da validação comercial, a fonte `pilot_whatsapp_web` será substituída pelo webhook oficial Meta/Coexistence, preservando agenda, trabalho, clientes, análise e central da Secretária.
