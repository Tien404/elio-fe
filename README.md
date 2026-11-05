# ELIO Frontend

Vite · React · TypeScript · Tailwind CSS · React Router

## Chạy local

Node22.18+ (nhánh22) hoặc Node24+, npm10+. Từ thư mục frontend:

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:5173 . Alias `@/` trỏ tới src. Router khai báo tại src/main.tsx, nội dung ứng dụng tại src/App.tsx.

Vite chuyển /api tới http://127.0.0.1:8000. Đổi backend target bằng API_PROXY_TARGET trong .env; xem .env.example. Biến VITE_* được đưa vào client bundle, không dùng để chứa secret.

## Lệnh

| Lệnh             | Chức năng                      |
| ---------------- | ------------------------------ |
| npm run check    | TypeScript + ESLint + Prettier |
| npm run lint:fix | Sửa lỗi ESLint có thể tự sửa   |
| npm run format   | Format code                    |
| npm run build    | Typecheck và build vào dist    |
| npm run preview  | Xem bản build local            |

Husky pre-commit chạy ESLint/Prettier qua lint-staged cho các file frontend được stage. npm ci cài hook tại Git root của repo, sử dụng frontend/.husky.

## Source

- src/main.tsx: React root và BrowserRouter.
- src/App.tsx: App component.
- src/index.css: Tailwind import.
- src/pages/: route pages.
- src/components/: UI components.
- src/services/: API calls.
