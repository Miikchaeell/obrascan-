# Historial de Problemas y Soluciones

## 1. Error 500 en Login/Register
**Causa:** Fallos de conexión a DB PostgreSQL o missing schemas.
**Solución:** Se incluyó script de auto-inicialización que lee el schema SQL al arranque del server garantizando que las tablas `/migrations` existan (`initDB()`). Se corrobora via variable `DATABASE_URL` conectando el pool pg de Render.

## 2. Bloqueo de CORS entre Vercel y Render
**Causa:** Peticiones bloqueadas del frontend al backend.
**Solución:** `cors({ origin: ['https://obrago.vercel.app', 'https://obrascan.vercel.app', 'http://localhost...'], credentials: true })` en index.js del backend.

## 3. Safari Cookies (Third-Party block)
**Causa:** Safari e iOS App Webkits bloquean third-party cookies cross-domain (Vercel -> Render).
**Solución:** Transición de auth a modelo híbrido. Se soporta lectura de `Authorization: Bearer <token>`.

## 4. Error 401: "No autenticado"
**Causa:** Peticiones hacia `/api/analyze` (Scanner) donde la cookie se perdía o no llegaba.
**Solución:** Se forzó lectura de token del `localStorage` en `Scanner.tsx` inyectándolo dinámicamente en el FormData/Headers de Axios/Fetch.

## 5. Bug "Bearer null"
**Causa:** El localStorage entregaba valor nulo pero se convertía a la string "null" rompiendo JWT verify pre-asignado.
**Solución:** Modificación en `auth.ts` / middleware `authenticateToken` del backend excluyendo chequeos estrictos de `'null'` en la cadena Bearer.

## 6. Crash Stripe (Faltan variables Env)
**Causa:** El backend inicializaba `new Stripe(null)` por falta de secreto.
**Solución:** Manejo fallback `'sk_test_dummy'` añadido o inyección garantizada en Render Enviroment.
