# Cosmetóloga Aneth

Aplicación de estudio de cosmetología en español. Esta exportación contiene el código del sitio, los cinco PDFs y todas las imágenes y contenidos necesarios para continuar el desarrollo en Codex.

Sitio publicado: https://cosmetologa-aneth.oscaravegap.chatgpt.site

**Para continuar en Codex, empieza por [docs/CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md).**

## Qué incluye

- Biblioteca en la página principal y una página independiente por PDF, en `/estudio/[slug]`.
- Guías con conceptos importantes, palabras clave, glosarios, referencias de página y visor de las 324 páginas originales.
- Los cinco PDFs descargables en `public/study/`.
- Módulo corporal con ocho temas, 64 preguntas de práctica, repaso de errores y seguimiento de lectura.
- Examen final independiente de 32 preguntas y siete formatos.
- Esquema de base de datos, cuatro migraciones y las pruebas existentes del examen.

| Tema | Ruta | Páginas |
| --- | --- | ---: |
| La piel | `/estudio/la-piel` | 36 |
| Bioquímica | `/estudio/bioquimica` | 41 |
| Tipología cutánea | `/estudio/tipologia-cutanea` | 69 |
| Fototipos | `/estudio/fototipos` | 111 |
| Alta tecnología en Cosmetología | `/estudio/alta-tecnologia` | 67 |

## Ejecutar localmente

Usa **Node.js 24** y **pnpm 11.25.0**, la versión indicada en `package.json`. El proyecto usa React, TypeScript, Vinext/Vite, Tailwind y Cloudflare D1. Aunque importa APIs de `next/*`, el servidor actual es Vinext; no se arranca con `next dev`.

Desde la carpeta del proyecto:

```sh
pnpm install --frozen-lockfile
pnpm build
```

La compilación genera `dist/server/wrangler.json`. Para la **primera instalación con una base local vacía**, aplica las migraciones en este orden:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_groovy_scourge.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_public_captain_cross.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_long_ender_wiggin.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_windy_quicksilver.sql
pnpm dev
```

Abre la dirección local que imprima el servidor (habitualmente `http://localhost:5173`). No repitas migraciones ya aplicadas. Los datos locales se guardan en `.wrangler/state`; no son los datos del sitio publicado.

Un clon limpio selecciona automáticamente el perfil `portable`. No necesita el plugin Sites para estos comandos. `install:ci` conserva el instalador del entorno Linux de origen; para un clon normal usa `pnpm install --frozen-lockfile`.

## Comprobaciones

```sh
pnpm exec tsc --noEmit
node scripts/test-final-exam.mjs
pnpm build
```

Las pruebas del examen utilizan una base SQLite temporal en memoria. No modifican el progreso real.

## Mapa del proyecto

| Archivo o carpeta | Contenido |
| --- | --- |
| `app/page.tsx` | Inicio, quizzes, repaso y progreso |
| `app/estudio/[slug]/page.tsx` | Página independiente de cada PDF |
| `components/study-library.tsx` | Biblioteca de temas |
| `components/pdf-study-page.tsx` | Interfaz de estudio y visor |
| `lib/content/study-guides.json` | Guías y glosarios de los PDFs |
| `public/study/` | PDFs, diapositivas WebP y texto extraído |
| `app/api/study/route.ts` | API de práctica y progreso |
| `app/api/final-exam/route.ts` | API del examen final |
| `db/` y `drizzle/` | Esquema y migraciones |
| `vite.config.ts` y `build/` | Integración actual con Workers/Sites |

## Alcance de la exportación

Se conserva el código del sitio en el commit `9b13e99a009965981c107e90f27acaf324b9e5ef`, con esta documentación de entrega añadida. No se incluyen credenciales, dependencias instaladas, archivos compilados ni registros de la base de datos de producción.

**El progreso actual es compartido a nivel de aplicación:** las tablas y las APIs todavía no separan sesiones por usuario. Esto debe adaptarse antes de ofrecer cuentas con progreso personal. Los helpers de inicio de sesión de ChatGPT existen en el proyecto, pero las APIs de estudio no los usan para autorizar ni aislar datos.

Para desplegar fuera de Sites hay que configurar una base D1 propia o adaptar la capa de datos, además del sistema de autenticación. Subir el código a GitHub no migra esos servicios ni cambia automáticamente el sitio publicado.

La documentación técnica original del starter se conserva en [docs/SITES_STARTER_ORIGINAL.md](docs/SITES_STARTER_ORIGINAL.md) como referencia. Para los comandos actuales de este proyecto, usa este README.
