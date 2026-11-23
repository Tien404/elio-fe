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

Mở `http://localhost:5173`. Backend chạy tại `http://127.0.0.1:8000`.

| Biến trong `.env`                        | Ý nghĩa                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `API_PROXY_TARGET=http://127.0.0.1:8000` | Địa chỉ FastAPI; Vite chuyển các request `/api` đến đây |
| `VITE_DATA_SOURCE=api`                   | Dùng backend và database thật                           |
| `VITE_DATA_SOURCE=mock`                  | Dùng dữ liệu mẫu trong frontend, chạy độc lập           |

Với `api`, có thể đăng nhập `teacher@gmail.com` hoặc `student@gmail.com`, mật khẩu `12345678` sau khi chạy seed backend.
Mật khẩu mẫu chỉ dùng cho local. Chế độ `api` không tự chuyển sang mock khi backend lỗi.

## Kiểm tra

```sh
npm test
npm run check
npm run build
```

## Các chức năng

- **Quản trị:** tài khoản, mật khẩu tạm, quyền tạo lớp, danh mục học phần, thông tin lớp và nhật ký audit.
- **Lớp học:** đội ngũ giảng dạy, thành viên, học liệu và thông báo. Lead quản lý co-instructor và chuyển vai trò lead.
- **Bài tập:** cấu hình bài cá nhân hoặc nhóm, cách lập nhóm và giới hạn thành viên; chọn tệp, tải lên, xác nhận nộp và xem lịch sử. Danh sách thành viên được cố định khi bài nhóm được xác nhận hoặc có quyết định chấm bài chưa nộp.
- **Chấm điểm:** hàng chờ chấm, lưu draft, công bố và sửa điểm có lý do. Giảng viên xem điểm đang công bố cùng draft sửa đổi; sinh viên xem kết quả đã công bố. Điểm 0 được phân biệt với chưa có điểm và mã đặc biệt 11/12.
- **Quiz:** Question Bank, chọn và sắp xếp câu hỏi, phân bổ điểm, cấu hình số lượt làm và thời điểm công bố kết quả. Đáp án được lưu tuần tự; nộp bài chờ lần lưu đang gửi hoàn tất và reload khôi phục lượt làm hiện tại.
- **Kết quả và hoạt động:** gradebook, CSV dành cho giảng viên, inbox có đánh dấu đã đọc, calendar theo giờ Việt Nam và tiến độ M/N hoạt động bắt buộc. Dashboard tổng hợp lớp, hạn sắp tới, bài cần nộp và hàng chờ chấm theo vai trò.
