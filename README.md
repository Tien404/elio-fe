# ELIO Frontend

Vite · React · TypeScript · Tailwind CSS · React Router · npm.

## Chạy

```sh
npm ci
cp .env.example .env
npm run dev
```

Mở `http://localhost:5173`. Backend chạy tại `http://127.0.0.1:8000`; Vite proxy `/api` theo `API_PROXY_TARGET`.

- `VITE_DATA_SOURCE=api`
- `VITE_DATA_SOURCE=mock`

## Kiểm tra

```sh
npm run check
npm run build
```
