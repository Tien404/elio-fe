# ELIO Frontend

Vite · React · TypeScript · Tailwind CSS · React Router · npm.

Giao diện tiếng Anh cho ELIO, gồm không gian học tập của sinh viên, không gian giảng dạy
và chức năng quản trị theo vai trò.

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

## Kết nối backend và triển khai

Sử dụng các phiên bản frontend và backend có contract API tương thích. Trong backend, làm theo README backend để migrate/seed và chạy FastAPI. Trong frontend, dùng Node 22.18+ thuộc nhánh 22 hoặc Node 24+ theo `package.json`. Sau `npm ci` và sao chép `.env.example`, kiểm tra `VITE_DATA_SOURCE=api` và `API_PROXY_TARGET` trỏ tới FastAPI. Mở Vite bằng hostname `localhost` để Chrome chấp nhận cookie Secure trong môi trường local.

```sh
VITE_DATA_SOURCE=api npm run dev
```

PowerShell: `$env:VITE_DATA_SOURCE='api'`, rồi `npm run dev`. `VITE_DATA_SOURCE` được áp dụng khi build. Muốn demo offline, chọn `mock` trước khi khởi động hoặc build. Swagger backend ở `http://127.0.0.1:8000/docs` và readiness ở `/health/ready`.

API mode dùng tài khoản seed của backend, kể cả `admin@elio.local`. Tài khoản mock hiển thị trong **Demo tools**. Hai chế độ có dữ liệu và phiên riêng. Khi trình diễn nhiều vai trò API, dùng cửa sổ riêng tư hoặc profile trình duyệt khác để tránh chia sẻ cookie. Giờ hiển thị và giờ nhập deadline trong bài tập/quiz đều là giờ Việt Nam.

Khi phục vụ bản build, dùng cùng origin cho UI và API. Reverse proxy chuyển `/api` đến FastAPI và phục vụ `index.html` cho các route SPA.

## Các chức năng

- **Quản trị:** tài khoản, mật khẩu tạm, quyền tạo lớp, danh mục học phần, thông tin lớp và nhật ký audit.
- **Lớp học:** đội ngũ giảng dạy, thành viên, học liệu và thông báo. Lead quản lý co-instructor và chuyển vai trò lead.
- **Bài tập:** cấu hình bài cá nhân hoặc nhóm, cách lập nhóm và giới hạn thành viên; chọn tệp, tải lên, xác nhận nộp và xem lịch sử. Danh sách thành viên được cố định khi bài nhóm được xác nhận hoặc có quyết định chấm bài chưa nộp.
- **Chấm điểm:** hàng chờ chấm, lưu draft, công bố và sửa điểm có lý do. Giảng viên xem điểm đang công bố cùng draft sửa đổi; sinh viên xem kết quả đã công bố. Điểm 0 được phân biệt với chưa có điểm và mã đặc biệt 11/12.
- **Quiz:** Question Bank, chọn và sắp xếp câu hỏi, phân bổ điểm, cấu hình số lượt làm và thời điểm công bố kết quả. Đáp án được lưu tuần tự; nộp bài chờ lần lưu đang gửi hoàn tất và reload khôi phục lượt làm hiện tại.
- **Kết quả và hoạt động:** gradebook, CSV dành cho giảng viên, inbox có đánh dấu đã đọc, calendar theo giờ Việt Nam và tiến độ M/N hoạt động bắt buộc. Dashboard tổng hợp lớp, hạn sắp tới, bài cần nộp và hàng chờ chấm theo vai trò.

## Dữ liệu và trạng thái giao diện

`src/api` kết nối các service với backend; chế độ mock sử dụng dữ liệu riêng và chạy độc lập.
Route và hành động được hiển thị theo vai trò, quyền truy cập và trạng thái tài nguyên.
Giao diện xử lý loading, dữ liệu rỗng, lỗi kết nối và phiên hết hạn. Khi dữ liệu đã thay đổi
ở phiên khác, người dùng xem lại bản hiện tại trước khi tiếp tục thao tác.

Trong chế độ API, thông báo lớp được đăng trực tiếp. Đồng hồ và trạng thái mở/đóng quiz dựa
trên thời gian server; điểm và đáp án đúng chỉ hiển thị khi API cho phép. Backend cần chạy
các tác vụ nền xử lý quiz theo hướng dẫn trong README backend.
