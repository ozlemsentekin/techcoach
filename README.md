# TechCoach

Landing page now includes a real authentication flow backed by Azure Functions and Azure SQL.

## Frontend

- `npm run dev` starts the Vite app on port `5173`
- Vite proxies `/api/*` requests to Azure Functions on `http://127.0.0.1:7071`

## API

1. Copy `api/local.settings.sample.json` to `api/local.settings.json`
2. Fill `SQL_CONNECTION_STRING` and `AUTH_JWT_SECRET`
3. Install API dependencies with `cd api && npm install`
4. Verify Azure SQL access with `cd api && npm run check:db`
5. Run the schema in `api/sql/create-auth-schema.sql`
6. Start Functions with `cd api && npm start`

`api/local.settings.json` is local-only and should keep secrets out of git history.

## Security Defaults

- Passwords are hashed with `bcrypt`
- Sessions use signed JWTs in `HttpOnly` cookies
- Cookies are `SameSite=Strict` and `Secure` in production
- SQL access uses parameterized queries
- Login attempts are rate limited and accounts are temporarily locked after repeated failures
- Registration requires KVKK and aydinlatma approvals
