# Documentación del Backend

Ubicación principal: `c:\Users\Usuario\.antigravity\obrascan\server\index.js`

## Configuración y Setup
- Corriendo en puerto 4000 (`process.env.PORT`).
- Conexión DB expuesta vía `DATABASE_URL`.
- Inicialización en arranque de la app (`initDB()` ejecuta `init.sql`).
- CORS configurado estrictamente para los dominios de Vercel y localhost con `credentials: true`.

## Endpoints Principales

### Auth (`/api/auth/*`)
- `POST /register`: Crea usuarios. El primer usuario registrado (o el matching con `INITIAL_ADMIN_EMAIL`) es auto-aprobado como `admin`.
- `POST /login`: Valida contraseña (bcrypt) y estado activo. Retorna JWT (y asigna cookie).
- `POST /logout`: Limpia la cookie.
- `GET /me`: Devuelve datos del perfil y plan de suscripción (`authenticateToken`).

### Admin (`/api/admin/*`)
- `GET /users`: Lista usuarios (solo accesible vía middleware `isAdmin`).
- `POST /users/:id/activate`: Activa usuarios manualmente.

### IA / Análisis (`/api/analyze`)
- Middleware de límite de uso (`checkUsageLimit`) y auth.
- Sube imagen temporal (Multer).
- Llama a `OpenAI GPT-4o` con esquema de respuesta forzado en JSON para devolver: *elemento, sistema_constructivo, dimensiones, y materiales*.

### Proyectos (`/api/projects`)
- Gestiona historial guardado de proyectos cubicados per usuario ligado suscripción.

### Webhook Stripe (`/api/stripe/webhook`)
- Escucha `checkout.session.completed` para actualizar estado en tabla `subscriptions`.
