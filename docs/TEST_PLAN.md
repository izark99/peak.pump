# TEST PLAN — peak.pump

Trạng thái: **kế hoạch** (chưa có test nào được viết — Giai đoạn 0).

## Công cụ
- Unit: Vitest (`shared/domain`, `local`, `sync`, 3D math/kinematics).
- API/integration: Vitest + workerd/Miniflare với D1 local, migration thật ⏳ (chọn `@cloudflare/vitest-pool-workers` hoặc `wrangler pages dev` + HTTP client ở Giai đoạn 2).
- E2E: Playwright + Chromium (`/opt/pw-browsers`), project mobile (viewport ~390×844, touch) và desktop.
- Static checks: `tsc --noEmit`, ESLint (gồm import boundary), test quét asset 3D ngoài.

## Ma trận bắt buộc

| # | Hạng mục | Loại | Tiêu chí pass |
|---|---|---|---|
| T1 | User A không đọc/sửa/xóa dữ liệu User B (mọi endpoint dữ liệu, kể cả sync pull/push với ID của B) | API | 404/403, không rò dữ liệu, không ghi |
| T2 | Admin không truy cập dữ liệu tập luyện của user khác (không có endpoint; sync của admin chỉ trả dữ liệu admin) | API + import boundary | |
| T3 | Tài khoản bị khóa: login fail; session cũ bị revoke; sync trả 403 `account_locked` | API + E2E | |
| T4 | CSRF: thiếu header/Origin sai → 403; cookie flags đúng | API | |
| T5 | Session: hết hạn, logout revoke, đổi mật khẩu revoke tất cả | API | |
| T6 | Login throttle + thông báo lỗi chung | API | |
| T7 | Import Excel hợp lệ (nhiều tuần), lỗi (báo sheet/dòng/cột), alias VI/EN, bài không khớp, file quá lớn, `.xlsm`, import trùng (double-submit) | Unit + API + E2E | không ghi một phần |
| T8 | Sửa template / đổi chương trình không đổi lịch sử completed | API + unit | snapshot giữ nguyên |
| T9 | Dời lịch giữ `original_date`; skip; completion | unit | |
| T10 | Resume workout sau reload / đóng tab; rest timer khôi phục theo `ends_at` | E2E | |
| T11 | Volume/dashboard với dataset kỳ vọng (dumbbell, unilateral, bodyweight, cardio, set incomplete, skipped/rescheduled, MTD) | unit | khớp từng số |
| T12 | Body metrics thiếu giá trị không thành 0; goal baseline | unit + E2E | |
| T13 | Sync: mất mạng khi nhập, đóng/mở offline, reconnect, retry lặp không trùng, conflict 2 thiết bị, xóa không resurrect, quota error giữ outbox | unit + E2E | |
| T14 | Logout khi còn pending → cảnh báo; sau logout IndexedDB của user bị xóa | E2E | |
| T15 | PDF tiếng Việt nhiều trang (header lặp, không cắt hàng), tháng không dữ liệu, cảnh báo chưa sync | unit (doc definition) + E2E (tải file, kiểm tra text bằng pdf parser) | |
| T16 | Mọi catalog exercise có animation definition + passes kinematic checks | unit | |
| T17 | Không external 3D asset/loader | static | |
| T18 | Build deploy-compatible (`vite build`, Functions bundle, `wrangler pages functions build`) | CI script | |
| T19 | i18n key parity vi/en; không chuỗi UI hardcode trong components (lint) | unit/lint | |
| T20 | Mobile viewport: không scroll ngang khi ghi set; touch target ≥ 44px | E2E | |

Không dùng test "page loads" thay cho nghiệm thu.

## Báo cáo
Mỗi giai đoạn ghi vào `PROGRESS.md`: lệnh đã chạy, passed/failed/skipped, phần chưa kiểm chứng thực tế (ví dụ: thiết bị thật, production).
