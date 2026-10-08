# IMPLEMENTATION PLAN — peak.pump

Mỗi giai đoạn: mục tiêu → thay đổi → kiểm tra → cập nhật `PROGRESS.md` → kết quả/blocker/bước kế tiếp. Không nhảy giai đoạn qua cổng duyệt.

## Giai đoạn 0 — Khảo sát & đặc tả ✅ (đang chờ CỔNG DUYỆT 1)
- Khảo sát repo/môi trường, hạn mức Cloudflare, đo PBKDF2 trên workerd.
- Docs nền, mô hình dữ liệu, quy tắc tính, danh sách 40 bài có nguồn.
- **CỔNG DUYỆT 1**: danh sách bài + quyết định hashing (D-007) + cách hiển thị tier (D-012).

## Giai đoạn 1 — Prototype 3D (sau CỔNG DUYỆT 1)
- Scaffold tối thiểu Vite + TS + Three.js (chỉ phần cần cho viewer) + trang prototype.
- `character/` generator, `rig/` skeleton + IK, `muscles/` highlight, `equipment/` (DB, BB + đĩa, ghế, cable tower, máy leg extension).
- 4 bài mẫu + tư thế đứng trung lập; controls đầy đủ; quality tiers.
- Đo FPS/thời gian sinh mesh trên Chromium mobile emulation (ghi rõ đây là emulation) + hướng dẫn bạn tự đo trên điện thoại thật.
- Test: không asset ngoài, dispose, pause khi ẩn.
- **CỔNG DUYỆT 2**: ảnh chụp/link preview cho bạn duyệt hình thể, highlight, chuyển động, dụng cụ, mobile.

## Giai đoạn 2 — Foundation
- Scaffold hoàn chỉnh (pnpm, Vite, functions/, shared/, server/, migrations/, tests).
- Migration `0001_init.sql`; auth (theo D-007 đã duyệt), session, CSRF, throttle, logout, đổi mật khẩu.
- Admin: tạo/khóa/mở khóa/reset password; audit; import boundary test (admin không chạm dữ liệu tập).
- i18n (vi/en, test key parity), theme light/dark, PWA shell, layout mobile.
- Bootstrap admin script.
- Test: API isolation A/B, admin không xem dữ liệu, locked account, CSRF, session expiry/revoke.

## Giai đoạn 3 — Core training
- Programs (PPL, Upper/Lower, custom), calendar (weekly, multi-week, dời, bỏ, cancelled khi đổi chương trình).
- Import Excel: file mẫu, parse, validate theo sheet/dòng/cột, map alias, preview, confirm atomic, idempotent.
- Active workout: set logging, lần trước, rest timer theo `ends_at`, draft/resume, sửa buổi đã xong.
- History list/detail (phân trang).
- Test: import hợp lệ/lỗi/trùng; sửa template không đổi lịch sử; resume; timer restore.

## Giai đoạn 4 — Offline/sync
- IndexedDB per user, outbox, pull/push, conflict UI, trạng thái sync, backoff, quota handling.
- Logout với pending, session hết hạn offline, account locked khi reconnect, nâng version IndexedDB, SW update không mất nháp.
- Test Playwright offline: mất mạng khi nhập, đóng/mở offline, reconnect, retry lặp, 2 thiết bị cùng sửa, logout pending.

## Giai đoạn 5 — Full 3D library
- Animation riêng cho đủ 40 bài, nội dung song ngữ (setup, bước, lỗi thường gặp, lưu ý — viết lời mới).
- Checklist nghiệm thu từng bài (`3D_ACCEPTANCE.md`), test "mọi catalog exercise có animation".

## Giai đoạn 6 — Metrics/reporting
- Body measurements CRUD + charts, goals + baseline, dashboard theo `DATA_MODEL.md` §9.
- PDF báo cáo tháng (font tiếng Việt, header lặp, nhiều trang, tháng trống, cảnh báo chưa sync).
- Test dataset kỳ vọng cho mọi phép tính.

## Giai đoạn 7 — Hardening/deployment
- Security review, e2e toàn luồng, accessibility (contrast, touch target ≥ 44px, label), mobile viewport.
- Kiểm tra free-tier (ước lượng row reads/writes theo kịch bản), bundle size, `_headers` CSP.
- Hoàn thiện `DEPLOYMENT.md`; deploy + smoke test production **chỉ khi được cho phép**.
