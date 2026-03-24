# Roadmap de ObraGo

## Fila de Prioridad Alta (Siguientes Pasos)
1. **Consolidar transición Auth:** Homologar todos los fetches del frontend para usar interceptores y garantizar 100% que el Header `Bearer token` esté presente en cada petición, descartando progresivamente la dependencia `credential: 'include'` en plataformas que lo restringen (iOS).
2. **Re-Diseñar Módulo de Materiales:** Escapar de los precios "hardcodeados" estáticos (ladrillos, hormigón, etc) en `Scanner.tsx` e implementar una API/Tabla `materials` o `prices` conectada al `user_id` para que el usuario pueda personalizar su tarifario de costos.
3. **Escalar Arquitectura AI:** Parametrizar dinámicamente la petición al API de GPT de acuerdo al tipo de estructura seleccionada (separar prompts para obra gruesa vs terminaciones vs cubicación metalúrgica), logrando un JSON más robusto y específico por caso de uso.

## Backlog / MVP + (V1.5)
- **Control de avance de obra con línea de tiempo:** Fotografiar semanalmente la misma partida/elemento estructural y que el Agente AI compare (% de avance relativo y notificar alertas de desvío de cronograma).
- **Control de trabajadores (Chek-in / Check-out):** Módulo para que el maestro escanee un QR en terreno.
