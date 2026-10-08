# PRODUCT SPEC — peak.pump

Trạng thái: **Giai đoạn 0 — đặc tả**. Tài liệu này là nguồn sự thật về phạm vi sản phẩm. Thay đổi phạm vi phải ghi vào `docs/DECISIONS.md`.

## 1. Mục tiêu

Webapp cho nhóm nhỏ (mỗi người một tài khoản) để:

- Lên kế hoạch tập gym (program/template, lịch theo tuần, chương trình nhiều tuần).
- Ghi kết quả thực tế từng buổi, từng set (kg, reps, completed), cardio (thời gian, quãng đường, tốc độ, độ dốc).
- Theo dõi tiến bộ tập luyện và chỉ số cơ thể, mục tiêu do người dùng tự đặt.
- Xem hướng dẫn bài tập với hoạt ảnh 3D dựng hoàn toàn bằng code.
- Dùng chủ yếu trên điện thoại, kể cả offline.
- Xuất PDF báo cáo tháng trên trình duyệt.

Định hướng: hypertrophy, hình thể kiểu fitness model. **Không** cam kết kết quả hình thể. **Không** có dinh dưỡng, tư vấn y tế, AI coaching trong bản đầu.

## 2. Ngoài phạm vi (bản đầu)

RPE/RIR, superset, dropset, ước tính 1RM, dinh dưỡng, tư vấn y tế, AI coaching, self-registration, email/social login, người dùng tự tạo bài tập, admin form thêm bài tập, push/background notification, import định dạng khác `.xlsx`.

## 3. Vai trò và quyền

| Quyền | User | Admin |
|---|---|---|
| Dữ liệu tập luyện, chỉ số, báo cáo **của chính mình** | ✅ | ✅ (admin cũng là một user có dữ liệu riêng) |
| Dữ liệu tập luyện/chỉ số/báo cáo **của người khác** | ❌ | ❌ |
| Tạo tài khoản, khóa/mở khóa, đặt lại mật khẩu, xem trạng thái tài khoản | ❌ | ✅ |
| Impersonate | ❌ | ❌ |

Admin chỉ thấy metadata tài khoản: username, display name, role, status, created_at, last_login_at, số phiên đang hoạt động. Không thấy bất kỳ trường nào thuộc dữ liệu tập luyện/cơ thể.

## 4. Màn hình

1. Login
2. Dashboard
3. Calendar
4. Programs/templates
5. Active workout
6. Exercise library / detail (3D viewer)
7. Workout history / detail
8. Body metrics / goals
9. Reports (PDF)
10. Profile / settings (ngôn ngữ, theme, timezone, đổi mật khẩu, logout)
11. Admin account management (chỉ admin)

Mỗi màn hình có trạng thái loading, empty, error, offline. Không có nút placeholder.

## 5. Chức năng chi tiết

### 5.1 Programs & calendar
- Template có sẵn: Push/Pull/Legs, Upper/Lower (tạo từ catalog đã duyệt).
- Tạo chương trình từ thư viện; lưu nhiều chương trình; một chương trình **active** tại một thời điểm (chuyển chương trình được).
- Hai kiểu lịch: (a) theo ngày trong tuần lặp lại; (b) nhiều tuần với `week_index` + weekday, có `start_date`/`end_date`.
- Planned session được materialize trong khoảng ngày của chương trình (tối đa 26 tuần mỗi lần sinh, sinh tiếp khi cần).
- Dời lịch: giữ `original_date` và `scheduled_date`. Bỏ buổi: `status = skipped`. Hoàn thành: có actual session `completed` liên kết.
- Đổi chương trình: planned session tương lai chưa bắt đầu của chương trình cũ chuyển `status = cancelled` (không xóa); lịch sử completed/skipped giữ nguyên.
- Sửa template: chỉ áp lên planned session tương lai chưa bắt đầu; actual session luôn là snapshot độc lập.

### 5.2 Import Excel (.xlsx)
Upload → parse (trên trình duyệt) → validate → map bài → preview → confirm import (server validate lại toàn bộ, ghi atomic trong một D1 batch).
- Giới hạn: file ≤ 1 MB, ≤ 2.000 dòng dữ liệu, ≤ 3 sheet được đọc; không đọc macro (`.xlsm` bị từ chối, chỉ đọc giá trị ô).
- Lỗi báo theo `sheet / dòng / cột`.
- Match bài theo `exercise_id` hoặc alias Việt–Anh (không phân biệt hoa thường, bỏ dấu). Không khớp → người dùng chọn lại từ catalog. Không tự tạo bài.
- Idempotency: `import_id` do client sinh; server từ chối import trùng `import_id` và trả kết quả lần trước.
- File mẫu tải từ app: sheet `HUONG_DAN / INSTRUCTIONS` (song ngữ), sheet `PROGRAM`, sheet `SESSIONS`, sheet `EXERCISE_IDS` (danh sách ID + alias). Định dạng chi tiết chốt ở Giai đoạn 3 và ghi vào tài liệu này.

### 5.3 Ghi buổi tập
Chọn buổi (planned hoặc buổi tự do) → bắt đầu → ghi từng set → hoàn tất → tổng kết.
- Set: `kg`, `reps`, `completed`. Cardio: `duration_s`, `distance_km`, `speed_kmh`, `incline_pct` — trường nào bắt buộc tùy dạng bài (xem catalog).
- Hiển thị kết quả lần trước của cùng bài (từ dữ liệu local).
- Rest timer dựa trên `ends_at` (timestamp), khôi phục đúng khi app quay lại foreground. Không hứa background alert.
- Nháp lưu liên tục vào IndexedDB; resume sau khi đóng/mở app.
- Sửa buổi đã hoàn tất được (tăng revision, đồng bộ như thay đổi bình thường).

### 5.4 Chỉ số cơ thể & mục tiêu
Trường: cân nặng (kg), body fat (%), khối lượng cơ (kg), vòng eo, ngực, hông, tay, đùi, bắp chân (cm). Chiều cao ở profile.
- Mọi trường optional; missing ≠ 0; không suy ra chỉ số chưa nhập.
- CRUD có xác nhận khi xóa. Biểu đồ theo từng chỉ số.
- Mục tiêu do người dùng nhập: metric, giá trị mục tiêu, ngày bắt đầu, hạn, baseline (xem `DATA_MODEL.md` §Quy tắc tính).

### 5.5 Dashboard
Hoàn thành tuần; tiến bộ kg/reps theo bài; tổng volume; nhóm cơ đã tập (chính/phụ tách riêng); biến động chỉ số; tiến độ mục tiêu; so sánh tháng này vs tháng trước (ghi rõ month-to-date). Công thức: `DATA_MODEL.md` §8.

### 5.6 Thư viện bài tập
~40 bài đã duyệt ở CỔNG DUYỆT 1 (`EXERCISE_SOURCES.md`). Mỗi bài có 3D riêng. User không tạo bài.

### 5.7 PDF báo cáo tháng
Xuất trên trình duyệt; song ngữ theo ngôn ngữ đang chọn; font hỗ trợ tiếng Việt (giấy phép OFL); header bảng lặp lại; có đơn vị; cảnh báo nếu có dữ liệu chưa đồng bộ.

## 6. Ngôn ngữ, đơn vị, thời gian
- UI và nội dung bài tập: Việt + Anh, chuyển trong app. Toàn bộ chuỗi UI nằm trong file message, không hardcode rải rác.
- Đơn vị: kg, cm, km, km/h, %.
- Ngày tập là **date-only** (`YYYY-MM-DD`) theo timezone của user (mặc định `Asia/Ho_Chi_Minh`). Timestamp lưu UTC ISO-8601/epoch ms. Không bao giờ suy ra ngày tập bằng cách cắt chuỗi UTC.

## 7. Offline
Xem `ARCHITECTURE.md` §Offline & sync. Tóm tắt: dùng được offline — xem catalog + 3D đã cache, xem dữ liệu đã tải, ghi buổi tập, sửa lịch, nhập chỉ số, xuất PDF từ dữ liệu local. Cần mạng — đăng nhập, admin, import Excel (bước confirm), đổi mật khẩu.
