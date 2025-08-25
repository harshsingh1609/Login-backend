## Auth Backend (Express + Prisma + PostgreSQL)

### Setup

1. Copy `.env.example` to `.env` and set values:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT` (optional)

2. Create the database in PostgreSQL:
```
createdb auth_db
```

3. Run Prisma migrate and generate client:
```
npx prisma migrate dev --name init
```

4. Start server:
```
npm run start
```

### API

- POST `/api/auth/signup` { email, password, name? }
- POST `/api/auth/login` { email, password }
- GET `/api/me` with `Authorization: Bearer <token>`



