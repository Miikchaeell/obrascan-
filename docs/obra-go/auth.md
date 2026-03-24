# Autenticación y Autorización

ObraGo ha transitado desde un enfoque exclusivo de cookies hacia un enfoque híbrido (`Bearer token + cookies`) para maximizar la compatibilidad entre Vercel, Render y distintos clientes (especialmente Safari en iOS).

## Funcionamiento Actual (Middleware `authenticateToken`)
1. **Extracción:**
   - Lee el encabezado `Authorization: Bearer <token>`.
   - Evita el crash validando que el string de extracción no sea literal `'null'` ni `'undefined'`.
   - Si no hay Bearer válido, reintenta extraer de `req.cookies.token`.
2. **Validación:**
   - Se valida la firma de JWT contra `process.env.JWT_SECRET`.
   - Si falla, retorna `403` "Sesión expirada".
   - Si no se encuentra token en absoluto, retorna `401` "No autenticado".
3. **Flujo de Acceso:**
   - Verifica `is_active` si la aplicación está en modo *Beta Privada*. Si `user.is_active` es `false` y el rol no es `admin/superadmin`, prohíbe el acceso (`403`).
4. **Almacenamiento:**
   - En login, el backend despacha el token en la respuesta JSON y también intenta setear una cookie `httpOnly`, `secure`, `sameSite: 'none'`.
   - El frontend Vercel guarda la respuesta del login en su `localStorage` y adjunta la cabecera en peticiones subsecuentes.
