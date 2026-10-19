# Entrega a Codex — Cosmetóloga Aneth

## Objetivo del propietario

Continuar este proyecto como una plataforma de estudio más profesional, accesible por enlace y preparada para más estudiantes. Primero consolidar la web; una futura aplicación para iPhone es una posibilidad, no una migración ya realizada.

## Estado que se debe conservar

- El inicio enlaza a páginas independientes para los cinco PDFs. Cada tema se estudia fuera de la pantalla principal de quizzes y examen.
- Las páginas contienen la información de estudio, puntos importantes, palabras clave, glosarios y todas las páginas del PDF. Los archivos completos están incluidos.
- No agregar quizzes de los cinco PDFs hasta que el propietario lo solicite. El módulo corporal y su examen final existente sí deben conservarse.
- Mantener el contenido en español, las rutas de estudio y los materiales. No reemplazar la aplicación con una landing page ni con una plantilla vacía.

## Dependencias de plataforma

1. **Runtime:** Vinext + Vite y Cloudflare Workers. Los imports `next/*` no implican que este proyecto esté listo para desplegarse con un preset estándar de Next.js.
2. **Datos:** `lib/study-db.ts` obtiene el binding `DB` de `cloudflare:workers`. `db/schema.ts` y `drizzle/*.sql` contienen el esquema. La exportación incluye las migraciones, no los registros de producción.
3. **Identidad:** `app/chatgpt-auth.ts` lee cabeceras inyectadas por Sites. Fuera de esa plataforma hay que integrar autenticación verificada en el servidor; no confiar en cabeceras suministradas por el cliente.
4. **Progreso compartido:** `study_sessions`, `study_lessons` y `final_exam_sessions` no contienen una clave de propietario. Las APIs consultan y modifican datos globales. Para cuentas personales, introducir propiedad y autorización en todas las operaciones, migrar los registros anteriores con una decisión explícita del propietario y adaptar el índice de borrador único del examen por usuario.
5. **Despliegue:** `.openai/hosting.json` identifica el sitio de origen. Se conserva para documentar la configuración actual; este repositorio de GitHub no sincroniza ni publica por sí solo en Sites.

## Primera sesión sugerida

1. Leer el README, instalar las dependencias fijadas y ejecutar TypeScript, las pruebas del examen y la compilación.
2. Arrancar con una base local vacía, aplicar las cuatro migraciones en orden y comprobar las cinco rutas de estudio, sus visores y descargas.
3. Revisar el diseño en móvil y escritorio y el flujo de práctica, guardado, reanudación, repaso y examen final.
4. Proponer y realizar las mejoras solicitadas por Oscar por etapas. Decidir el proveedor de hosting y la identidad antes de migrar producción.

Las pruebas actuales usan SQLite en memoria y cubren la lógica del examen y partes de las APIs; no sustituyen una revisión visual ni pruebas de aislamiento entre usuarios tras una futura migración.

## Texto para iniciar una tarea en Codex

> Lee README.md y docs/CODEX_HANDOFF.md. Este es mi proyecto Cosmetóloga Aneth. Quiero convertirlo en una web profesional para varios estudiantes. Conserva los cinco PDFs completos, sus páginas independientes y el contenido de estudio, además del módulo de quizzes y examen existente. Primero verifica que el proyecto compila y funciona localmente, revisa la arquitectura y explícame las mejoras concretas que vas a realizar. Prioriza una buena experiencia móvil y un sistema correcto de cuentas y progreso individual. Los quizzes nuevos para los cinco PDFs los añadiremos después.

## Procedencia

- Sitio: https://cosmetologa-aneth.oscaravegap.chatgpt.site
- Proyecto de origen: `appgprj_6aa85fb033388191a019175d294bdcc4`.
- Commit de origen: `9b13e99a009965981c107e90f27acaf324b9e5ef`.
- Exportación del código: 19 de octubre de 2026 (UTC).
- Materiales: cinco PDFs y 324 diapositivas, distribuidas en 36 + 41 + 69 + 111 + 67 páginas.

Esta entrega conserva la implementación existente. La adaptación a cuentas personales, a otro hosting o a una app nativa de Apple queda pendiente.
