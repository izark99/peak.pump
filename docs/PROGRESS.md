# PROGRESS — peak.pump

## Giai đoạn 0 — Khảo sát & đặc tả · 2026-10-08 · ĐANG CHỜ CỔNG DUYỆT 1

**Mục tiêu:** khảo sát repo/môi trường, kiểm tra tài liệu Cloudflare, chốt mô hình dữ liệu và quy tắc tính, đề xuất thư viện 40 bài có nguồn.

**Đã làm**
- Repo: chỉ có `README.md` + commit khởi tạo; branch `claude/determined-volta-at11zg`. Không có gì bị ghi đè.
- Môi trường: Node 22.22.0, pnpm 10.28.0, wrangler 4.148.0 (npx), Chromium Playwright có sẵn.
- Tài liệu Cloudflare (Workers/Pages/Functions/D1 Free) qua công cụ tìm kiếm docs Cloudflare → `DEPLOYMENT.md` §1.
- Thử nghiệm PBKDF2 trên workerd local (`wrangler dev`, script tạm trong scratchpad, không commit): 100k ≈ 25–30 ms, 600k ≈ 60–90 ms (wall time trên container dev; không phải số đo production). Không có trần iteration ở local.
- Nghiên cứu nguồn bài tập (expert ranking + nghiên cứu) → `EXERCISE_SOURCES.md`.
- Tạo docs: `CLAUDE.md`, `PRODUCT_SPEC`, `ARCHITECTURE`, `DATA_MODEL`, `DECISIONS`, `IMPLEMENTATION_PLAN`, `PROGRESS`, `TEST_PLAN`, `DEPLOYMENT`, `EXERCISE_SOURCES`, `3D_ACCEPTANCE`.

**Lệnh đã chạy (kiểm chứng)**
- `git status/log/branch` — OK.
- `npx wrangler@4 dev` + `curl` PBKDF2 100000/100001/600000 iterations — cả 3 `ok: true`.
- Chưa có code ứng dụng ⇒ chưa có unit/API/E2E test (đúng phạm vi Giai đoạn 0).

**Chưa kiểm chứng / giới hạn**
- WebFetch bị chặn tới developers.cloudflare.com, barbend.com, fitnessvolt.com → tier labels chỉ từ tóm tắt thứ cấp; một số hạn mức D1 (dung lượng/DB, bound params, Time Travel) chưa xác nhận.
- CPU time PBKDF2 trên production Cloudflare chưa đo (cần deploy — chưa được phép).

**Blocker / cần quyết định (CỔNG DUYỆT 1)**
1. Duyệt danh sách 40 bài.
2. D-007: phương án password hashing (client-side Argon2id + server HMAC) vì xung đột bảo mật vs 10 ms CPU.
3. D-012: cách hiển thị tier label khi chưa đối chiếu nguồn gốc.
4. Xác nhận 4 bài cho prototype 3D.

**Bước kế tiếp:** sau khi duyệt → Giai đoạn 1 (prototype 3D), dừng tại CỔNG DUYỆT 2.
