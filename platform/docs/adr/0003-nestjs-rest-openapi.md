# 0003 — NestJS REST API with zod validation and OpenAPI

## Context
Three clients (web, PWA, mobile) need one stable, documented API with consistent errors.

## Decision
- NestJS 11 on Express, global prefix `/api/v1`, Swagger UI at `/api/docs` and the JSON document
  at `/api/docs-json` (disabled in production unless `SWAGGER_ENABLED=true`).
- Request validation with zod schemas from `@boikonika/shared` through `ZodBody`/`ZodQuery`
  decorators; the same schemas are converted to OpenAPI so docs never drift from validation.
- One response envelope: `{ success, data, message, errors, meta?, code?, requestId? }`.
- WebSocket (Socket.IO) only for real-time needs: in-app notifications and book club chat.
- Authorization is enforced in guards and services; the UI only hides what the API would refuse.

## Consequences
- Clients handle every error the same way (`code` is stable, `message` is human-readable,
  `errors` lists field problems).
- The mobile app can be generated or type-checked against the OpenAPI document.
