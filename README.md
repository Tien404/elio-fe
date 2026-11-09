# ELIO Frontend

Vite · React · TypeScript · Tailwind CSS · React Router · npm.

## Chạy

Cài Node.js theo phiên bản trong `package.json` và npm, rồi chạy tại thư mục frontend:

```sh
npm ci
cp .env.example .env
npm run dev
```

PowerShell: `Copy-Item .env.example .env`.

Mở `http://localhost:5173`. Backend chạy tại `http://127.0.0.1:8000`.

| Biến trong `.env`                        | Ý nghĩa                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `API_PROXY_TARGET=http://127.0.0.1:8000` | Địa chỉ FastAPI; Vite chuyển các request `/api` đến đây |
| `VITE_DATA_SOURCE=api`                   | Dùng backend và database thật                           |
| `VITE_DATA_SOURCE=mock`                  | Dùng dữ liệu mẫu trong frontend, chạy độc lập           |

Với `api`, có thể đăng nhập `teacher@elio.local` hoặc `student@elio.local`, mật khẩu `ElioDemo@2026` sau khi chạy seed backend.
Mật khẩu mẫu chỉ dùng cho local. Chế độ `api` không tự chuyển sang mock khi backend lỗi.

## Kiểm tra

```sh
npm test
npm run check
npm run build
```
