# Correção do lint do simulador

O ESLint apontou apenas um erro real:

`ValidationConnectorPanel.tsx`: `FlaskConical` foi importado de `lucide-react`, mas não era utilizado.

A correção remove somente esse import não utilizado.

Nenhuma regra de negócio, banco, Edge Function, simulador ou integração Meta foi alterada.
