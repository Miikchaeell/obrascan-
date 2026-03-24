# Documentación del Frontend

El cliente se sirve mediante React + Vite.

## Flujos Principales

### Flujo de Login (`src/pages/Login.tsx`)
1. El usuario envía email y password vía POST a `/api/auth/login`.
2. Si es exitoso, la API retorna el token JWT y setea una cookie.
3. Frontend almacena el token en `localStorage.setItem("token", data.token)`.
4. Se hace un fetch secundario a `/api/auth/me` enviando explicitamente el header `Authorization: Bearer <token>` para obtener detalles del plan.
5. Se actualiza el contexto de React (`useAuth`).

### Flujo de Análisis - Scanner IA (`src/pages/Scanner.tsx`)
1. El usuario sube imagen mediante input de archivo (`fileInputRef`).
2. Se muestra preview y al hacer click se lanza `handleAnalyze()`.
3. Se recolecta el token desde `localStorage.getItem("token")`.
4. La petición va a `/api/analyze` enviando multipart form data.
5. Si hay `403` por límite, se muestra modal de upgrade (Stripe).
6. Si es exitoso, se pasa al paso "Confirmar" donde el usuario puede editar las dimensiones entregadas por la IA ("alta confianza").
7. Se ejecuta la lógica temporal de cálculo de precios geométricos duros (costo material base hardcodeado en `Scanner.tsx`).

## Stack Visual
- `lucide-react` para iconos.
- Tailwind para layout (`bg-background`, layouts flex y grid).
- `framer-motion` para transiciones modales y feedback visual de IA analizando.
