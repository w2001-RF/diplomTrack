# DiplomTrack frontend

React 18 + TypeScript SPA (Vite, Tailwind, shadcn/ui, TanStack Query) for the DiplomTrack Flask API in [`../backend`](../backend).

## Run locally

Start the backend first (see [docs/setup.md](../docs/setup.md)), then:

```sh
npm ci
npm run dev        # http://localhost:8080, /api is proxied to http://localhost:5000
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with the `/api` proxy |
| `npm run build` | Production build in `dist/` (served by Nginx in Docker) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` without emitting |
| `npm test` | Unit and integration tests (Vitest, MSW) |
| `npm run test:coverage` | Same, with a coverage report in `coverage/` |
| `npm run qa` | End-to-end QA suite in `qa/` (Robot Framework, starts its own backend) |

See [docs/testing.md](../docs/testing.md) for the test layout.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `/api` | Flask API base URL. Keep `/api` behind the Vite or Nginx proxy, or set a full URL for another origin |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | Development only: where the dev server forwards `/api` |

## Talking to the API

Pages use the hooks in `src/hooks/api/`, which call the `api` client in `src/lib/api/`. Resource types are in `src/lib/api/models.ts`; keep them in sync with `backend/schemas/`. See [docs/architecture.md](../docs/architecture.md#api-layer) for how the layer is organised.
