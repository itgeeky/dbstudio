# DB Studio

Explorador visual de PostgreSQL (Neon u otro Postgres) para estudiar tablas, foreign keys, tablas intermedias N:N y datos reales. Pensado para migraciones (por ejemplo Zoho Creator → app propia) cuando el GraphQL no expone todas las relaciones.

## Qué incluye

- Listado y búsqueda de tablas/columnas
- Detalle de PK, FK, unique, views y quién referencia cada tabla
- Detección de tablas puente (many-to-many)
- Preview de filas con búsqueda y paginación
- Diagrama ERD (tabla + vecinas, o el filtro actual)
- Consola SQL **solo SELECT** (máx. 200 filas)

La `DATABASE_URL` nunca se envía al browser: las queries corren en API routes de Next.js.

## Requisitos

- Node.js 18+
- Una URL de Postgres (Neon funciona con `sslmode=require`)

## Setup

```bash
npm install
cp .env.example .env
```

Edita `.env`:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

Arranca el dev server:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Uso rápido

1. **Tablas** — busca por nombre o columna. Filtro `solo intermedias N:N` para cazar joins que GraphQL no muestra como mutación.
2. **ERD** — por defecto dibuja la tabla seleccionada y sus vecinas (útil con cientos de tablas). Cambia a `filtro actual` si quieres un subgrafo más amplio. Arrastra nodos, zoom y minimap.
3. **SQL** — `SELECT` de inspección. `INSERT`/`UPDATE`/`DELETE` están bloqueados.

## Scripts

| Comando        | Qué hace              |
| -------------- | --------------------- |
| `npm run dev`  | Dev server (Turbopack)|
| `npm run build`| Build de producción   |
| `npm start`    | Sirve el build        |

## Notas

- No commitees `.env`. El repo ignora secretos.
- El conteo de filas del header es el estimado de Postgres (`reltuples`), no un `COUNT(*)` exacto. El preview sí usa count real.
- Si una tabla no aparece en GraphQL, suele ser intermedia: mírala en ERD y en el preview para ver las FKs que unen los dos lados.
