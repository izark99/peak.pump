# CLAUDE.md — peak.pump

Webapp theo dõi tập gym (hypertrophy) + chỉ số cơ thể cho nhóm nhỏ. Mobile-first, offline, song ngữ Việt–Anh, 3D bài tập dựng bằng code, PDF báo cáo tháng.

## Trạng thái
Giai đoạn 0 xong, **đang chờ CỔNG DUYỆT 1**. Chưa có code ứng dụng. Xem `docs/PROGRESS.md`.

## Ràng buộc không được vi phạm
- Hạ tầng: Cloudflare Pages + Pages Functions + D1, **chỉ free tier**. Không R2/KV/Queues/DO/cron, không Firebase/Supabase/Node server, không AI API. Không tạo tài nguyên/deploy khi chưa được chủ dự án cho phép.
- Workers Free: 10 ms CPU/request, 100k request/ngày; D1 Free: 100k row writes/ngày, 5M row reads/ngày. Thiết kế phải tiết kiệm writes.
- Bảo mật: không plaintext/reversible password; cookie `__Host-` HttpOnly Secure SameSite=Strict; CSRF (Origin + custom header); `user_id` chỉ lấy từ session; query parameterized; không log secret/dữ liệu cá nhân; không bootstrap endpoint; không hardcode tài khoản.
- Admin chỉ quản trị tài khoản — **không bao giờ** đọc dữ liệu tập luyện/cơ thể của người khác, không impersonate.
- 3D: 100% code (geometry, rig, animation, material). **Cấm** GLB/GLTF/FBX/OBJ, texture/animation ngoài, CDN model, video/GIF. Không hạ xuống stickman/mannequin. Lazy-load, pause khi ẩn, dispose.
- Không dữ liệu giả trong luồng chính; demo seed chỉ ở dev, có nhãn.
- Lịch sử workout là snapshot, không đổi khi template/catalog đổi. Ngày tập là date-only theo timezone user.
- Missing measurement ≠ 0. Công thức dashboard theo `docs/DATA_MODEL.md` §9.
- Không tự cắt phạm vi; khi bị chặn → ghi blocker trong `docs/PROGRESS.md`.
- Không ghi model identifier vào commit/code.

## Cách chạy (sẽ có từ Giai đoạn 2)
- Package manager: **pnpm** (commit lockfile).
- `pnpm install` · `pnpm dev` · `pnpm test` · `pnpm test:e2e` · `pnpm typecheck` · `pnpm build`
- D1 local: `pnpm db:migrate:local`

## Tài liệu
`docs/PRODUCT_SPEC.md` (phạm vi) · `ARCHITECTURE.md` · `DATA_MODEL.md` (schema + quy tắc tính) · `DECISIONS.md` · `IMPLEMENTATION_PLAN.md` · `PROGRESS.md` · `TEST_PLAN.md` · `DEPLOYMENT.md` (hạn mức free, deploy) · `EXERCISE_SOURCES.md` · `3D_ACCEPTANCE.md`.
Cập nhật `PROGRESS.md` cuối mỗi giai đoạn; quyết định mới vào `DECISIONS.md`.
