# Arquitectura de ObraGo

Stack Tecnológico principal:

## Frontend
- **Framework:** React + Vite
- **Estilos:** TailwindCSS + Framer Motion (para UI animada). Componentes de UI tipo Shadcn (Radix UI).
- **Hosting:** Vercel

## Backend
- **Entorno:** Node.js + Express
- **Hosting:** Render (Web Service)
- **Almacenamiento temporal:** Multer (carpetas locales `/uploads` en Render con Persistent Storage si aplica).
- **Inteligencia Artificial:** OpenAI API (GPT-4o) para visión computacional y extracción de datos de construcción.

## Base de Datos
- **Motor:** PostgreSQL (Pool de conexiones).
- **Migraciones/Init:** Script automatizado en `server/index.js` que corre `init.sql` al arrancar.

## Autenticación y Seguridad
- **JWT (JSON Web Tokens):** Emitidos al momento de Login.
- **Transición Auth:** Sistema dual (Cookies secure + Token Bearer en encabezado `Authorization`) para mayor compatibilidad con clientes móviles/Safari.

## Pagos
- **Stripe:** Manejo de suscripciones, límites de uso por proyecto (`plan_type: free` vs `pro`), validado mediante control de cantidad de proyectos asociados al usuario y validación de webhooks.
