# DECISIONS — peak.pump

Định dạng: ID · ngày · trạng thái (Accepted / Proposed / Pending approval) · quyết định · lý do · đánh đổi.

## D-001 · 2026-10-08 · Accepted — pnpm làm package manager
Có sẵn trong môi trường (10.28.0), lockfile ổn định, nhanh. Commit `pnpm-lock.yaml`.

## D-002 · 2026-10-08 · Accepted — Exercise catalog là code, không phải bảng D1
Mỗi bài bắt buộc có animation code + test → thêm bài luôn là một release. Tiết kiệm row reads, offline sẵn. Lịch sử snapshot tên/muscles/load rule nên không phụ thuộc catalog.

## D-003 · 2026-10-08 · Accepted — Template & planned detail lưu JSON; actual workout lưu quan hệ
D1 Free giới hạn 100.000 row writes/ngày. Template/planned không cần query nội bộ → JSON (1 row/aggregate). Actual cần query theo bài → bảng `workout_sessions / workout_exercises / workout_sets`.

## D-004 · 2026-10-08 · Accepted — Sync theo aggregate với `rev` + `last_op_id` + `change_seq`
Idempotent retry không cần bảng idempotency riêng; pull tăng dần theo index `(user_id, change_seq)`; tombstone chống resurrect. Conflict ở cấp aggregate, UI so sánh theo trường/set.

## D-005 · 2026-10-08 · Accepted — IndexedDB tách database theo user
`pp_user_<id>` → logout xóa nguyên database; không có cross-account cache.

## D-006 · 2026-10-08 · Accepted — CSRF: SameSite=Strict + Origin check + custom header
Không CORS. Không cần token đồng bộ phức tạp với SPA same-origin.

## D-007 · 2026-10-08 · **Accepted (CỔNG DUYỆT 1, chủ dự án chọn "đơn giản nhất")** — Password hashing: PBKDF2-SHA256 server-side (WebCrypto), iteration chọn vừa ngân sách CPU
Quyết định cuối: dùng PBKDF2-SHA256 qua `crypto.subtle` ở server, salt ngẫu nhiên 16 byte/user, lưu `{alg, iterations, salt, hash}` để nâng tham số sau (rehash khi đăng nhập thành công). Iteration chọn ở Giai đoạn 2 theo đo đạc sao cho CPU đăng nhập nằm trong ngân sách Workers Free; **thấp hơn khuyến nghị OWASP (600k)** — đánh đổi đã được chủ dự án chấp nhận. Không plaintext, không reversible. Phương án Argon2id client-side dưới đây không triển khai.

Phân tích ban đầu (lưu lại để tham khảo) — client-side Argon2id + server HMAC-SHA256 với pepper:
Đo local: PBKDF2-SHA256 600k ≈ 60–90 ms ≫ 10 ms CPU Workers Free. Phương án đề xuất giữ chi phí brute-force offline ở mức Argon2id (m=19 MiB, t=2, p=1) mà server tốn < 1 ms. Đánh đổi: giá trị KDF là password-equivalent khi truyền (TLS bảo vệ); đăng nhập chậm hơn trên điện thoại yếu; phụ thuộc WASM. Phương án thay thế: PBKDF2 600k server-side (rủi ro bị terminate, cần thử trên account thật). Workers Paid bị loại.

## D-008 · 2026-10-08 · Accepted — Excel parse trên trình duyệt, server validate lại
Giữ CPU server thấp. Server nhận JSON chuẩn hóa, validate toàn bộ bằng cùng schema, ghi atomic bằng `db.batch`. Thư viện parse/generate `.xlsx` chốt ở Giai đoạn 3 ⏳ (ứng viên: `exceljs` MIT, `read-excel-file`/`write-excel-file` MIT; tránh bản npm `xlsx@0.18.x` cũ có advisory).

## D-009 · 2026-10-08 · Proposed — 3D bằng Three.js thuần (không R3F) trong module lazy
Kiểm soát vòng đời render/dispose và pause khi ẩn dễ hơn; React chỉ bọc container. Xác nhận ở prototype Giai đoạn 1.

## D-010 · 2026-10-08 · Proposed — Nhân vật: implicit surface (SDF primitives) → polygonize → SkinnedMesh
Cho bề mặt liền, silhouette cơ bắp rõ, deform ở khớp. Rủi ro: thời gian sinh mesh trên mobile → cache theo version. Đánh giá ở CỔNG DUYỆT 2.

## D-011 · 2026-10-08 · Proposed — PDF bằng pdfmake + font Noto Sans/Be Vietnam Pro (SIL OFL)
Hỗ trợ `headerRows` lặp lại, page break, embed TTF. Chốt ở Giai đoạn 6 ⏳ (kiểm tra cách lấy file font OFL vào repo khi network bị giới hạn).

## D-012 · 2026-10-08 · Accepted (CỔNG DUYỆT 1) — Không hiển thị tier label trong app
Tier S/A chỉ là tiêu chí tìm bài. App hiển thị "Được tuyển chọn cho hypertrophy"; nguồn tuyển chọn chỉ nằm trong `docs/EXERCISE_SOURCES.md`.

## D-013 · 2026-10-08 · Accepted (CỔNG DUYỆT 1) — Đóng băng thư viện 40 bài
Danh sách trong `docs/EXERCISE_SOURCES.md` §3 được duyệt nguyên trạng. Prototype 3D: neutral stance, `dumbbell_lateral_raise`, `barbell_bench_press`, `seated_cable_row`, `leg_extension`.
