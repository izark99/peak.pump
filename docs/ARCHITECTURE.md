# ARCHITECTURE — peak.pump

Trạng thái: **đề xuất Giai đoạn 0**. Các mục đánh dấu ⏳ chờ duyệt/kiểm chứng.

## 1. Tổng quan

```
Browser (React SPA, PWA)
 ├─ UI (React + TS, i18n, theme)
 ├─ Domain logic (pure TS: tính volume, completion, goals, validation)  ← dùng chung với server
 ├─ Local store (IndexedDB, phân vùng theo user) + Outbox
 ├─ Sync engine (pull/push, conflict)
 ├─ 3D viewer (Three.js, lazy chunk)
 └─ PDF (pdfmake, lazy chunk)  ⏳ chốt thư viện ở Giai đoạn 6
        │  HTTPS, cookie session, same-origin
        ▼
Cloudflare Pages
 ├─ Static assets (miễn phí, không tính quota Functions)
 └─ Pages Functions  /api/*  (tính vào 100.000 request/ngày, 10 ms CPU/request — Workers Free)
        │  D1 binding (parameterized)
        ▼
     Cloudflare D1 (SQLite)
```

Browser **không** kết nối trực tiếp D1. 3D và PDF chạy hoàn toàn trên thiết bị.

## 2. Cấu trúc repo (dự kiến)

```
/src
  /app            # routing, providers, layout
  /features       # mỗi màn hình/feature: auth, dashboard, calendar, programs, workout, library, history, metrics, reports, settings, admin
  /ui             # component dùng chung (touch-friendly)
  /i18n           # messages vi.json, en.json + typed keys
  /local          # IndexedDB schema, repositories, outbox
  /sync           # sync engine
  /viewer3d       # (lazy) xem §6
  /pdf            # (lazy)
/shared           # code dùng chung client + server
  /domain         # types, calculations, validation schemas (zod)
  /catalog        # exercise catalog (song ngữ, stable ID, muscles, load rule, animationId)
/functions        # Pages Functions (file-based routing)
  /api/_middleware.ts   # auth, CSRF, size limit, error envelope
  /api/...
/server           # service + repository layer cho Functions (không phụ thuộc HTTP)
/migrations       # D1 SQL migrations 0001_*.sql
/scripts          # bootstrap-admin, backup
/tests            # unit, api (vitest + workers pool), e2e (playwright)
```

Tách lớp: `shared/domain` (thuần, không IO) → `server/*Repository` (D1) → `server/*Service` (quyền, nghiệp vụ) → `functions/api/*` (HTTP mỏng). Phía client: `features/*` gọi `local/*` repositories; không gọi fetch trực tiếp ngoài `sync/` và `api client`.

## 3. Package manager & tooling
- **pnpm** (10.x có sẵn trong môi trường), commit `pnpm-lock.yaml`.
- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Vite build → `dist/`; Functions trong `functions/` được Pages build.
- Test: Vitest (unit), `@cloudflare/vitest-pool-workers` hoặc `wrangler` local + Miniflare cho API/D1 ⏳, Playwright (Chromium có sẵn tại `/opt/pw-browsers`) cho e2e + mobile viewport + offline.

## 4. Auth & bảo mật

### 4.1 Password hashing — ⚠️ BLOCKER cần duyệt (CỔNG DUYỆT 1)
Sự kiện đã kiểm chứng:
- Workers Free: **10 ms CPU/HTTP request** (Cloudflare docs, Workers limits, kiểm tra 2026-10-08). Có "flexibility" cho vượt ngưỡng không thường xuyên, nhưng vượt thường xuyên sẽ bị terminate.
- Đo trên workerd local (wrangler 4.x, container dev này, CPU không công bố): PBKDF2-SHA256 100.000 iterations ≈ 25–30 ms; 600.000 iterations ≈ 60–90 ms wall time. Không có trần iteration ở workerd local (600.000 chạy được). Số đo production chưa kiểm chứng.
- OWASP Password Storage Cheat Sheet khuyến nghị PBKDF2-HMAC-SHA256 ≥ 600.000 iterations (theo hiểu biết hiện tại; cần đối chiếu lại khi viết code vì WebFetch tới owasp.org chưa thử).

⇒ Server-side PBKDF2 ở mức khuyến nghị **không vừa** 10 ms CPU. Giảm iteration để vừa ngân sách = giảm bảo mật → không làm âm thầm.

Phương án đề xuất (**A — server relief / client-side KDF**):
1. Client gọi `POST /api/auth/prelogin {username}` → server trả `{salt, params}`. Với username không tồn tại, trả salt giả xác định bằng `HMAC(PEPPER_SECRET, username)` để không lộ username tồn tại.
2. Browser tính `k = Argon2id(password, salt, m=19 MiB, t=2, p=1)` (tham số tối thiểu OWASP cho Argon2id) bằng WASM (`hash-wasm`, MIT ⏳ kiểm tra license/bundle khi code).
3. Client gửi `k` (không gửi mật khẩu gốc). Server lưu `H = HMAC-SHA256(PEPPER_SECRET, k)` và so sánh constant-time. CPU server < 1 ms.
- Khả năng chống offline cracking khi lộ DB: attacker vẫn phải chạy Argon2id cho mỗi lần đoán (+ cần pepper). Nếu lộ DB: `H` không dùng để đăng nhập trực tiếp được (cần `k`, mà `k` là preimage HMAC).
- Đánh đổi: `k` là password-equivalent khi truyền (được bảo vệ bởi TLS, như mật khẩu thường); đăng nhập trên điện thoại yếu mất ~0,5–1,5 s ⏳ đo ở Giai đoạn 2; cần JS bật.

Phương án B: PBKDF2-SHA256 600.000 ở server, chấp nhận rủi ro bị terminate vì CPU — cần deploy thử lên tài khoản Cloudflare (cần bạn cho phép) để đo; không khuyến nghị vì không có bảo đảm.
Phương án C: Workers Paid — **loại** (vi phạm free-only).

### 4.2 Session
- Token ngẫu nhiên 256-bit trong cookie `__Host-pp_session` (`HttpOnly; Secure; SameSite=Strict; Path=/`). DB chỉ lưu `SHA-256(token)`.
- Hết hạn tuyệt đối 30 ngày; idle 14 ngày; `last_seen_at` chỉ cập nhật tối đa 1 lần/24h (tránh write-on-read).
- Logout: revoke session hiện tại. Đổi mật khẩu / admin reset / khóa tài khoản: revoke toàn bộ session của user.
- Mỗi request đã xác thực: 1 query `sessions JOIN users` kiểm tra `revoked_at IS NULL`, `expires_at`, `users.status = 'active'`.

### 4.3 CSRF
SameSite=Strict + kiểm tra header `Origin` khớp host cho mọi method không an toàn + bắt buộc header `X-PP-CSRF: 1` (custom header ⇒ request cross-site phải preflight, mà API không trả CORS). Không cấp CORS cho origin khác.

### 4.4 Throttle đăng nhập
Bảng `login_throttle` trong D1 theo khóa `user:<username_norm>` và `ip:<hash IP>`: 5 lần sai / 15 phút → khóa tạm 15 phút, tăng dần. Chỉ ghi khi đăng nhập sai (tiết kiệm row writes). Thông báo lỗi luôn chung chung ("Sai tên đăng nhập hoặc mật khẩu"). ⏳ Workers Rate Limiting binding đã GA nhưng chưa xác minh hỗ trợ cho Pages Functions + free plan → không dựa vào.

### 4.5 Bootstrap admin
`scripts/bootstrap-admin.ts`: chạy local, hỏi username + mật khẩu qua stdin (không echo), tính hash theo §4.1, sinh file SQL tạm ngoài repo và in lệnh `wrangler d1 execute <db> --remote --file <tmp>` để người vận hành tự chạy; script từ chối nếu đã có admin. Không có HTTP bootstrap endpoint.

### 4.6 Khác
- Mọi query parameterized (`prepare().bind()`); không nối chuỗi SQL.
- Validate request bằng zod schema ở `shared/domain`; giới hạn body 256 KB (import: 1 MB JSON đã chuẩn hóa).
- `user_id` luôn lấy từ session, không nhận từ client. Mọi repository function có tham số `userId` bắt buộc và mọi query có `WHERE user_id = ?`.
- Log: không log body, mật khẩu, token, cookie, dữ liệu cá nhân; chỉ log route, status, mã lỗi, request id.
- Security headers qua `_headers`: CSP chặt (`default-src 'self'`; không CDN), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## 5. Offline & sync

### 5.1 IndexedDB
- Một database per user: `pp_user_<userId>` → không có cross-account cache. Database meta `pp_meta` chỉ lưu `lastUserId` và trạng thái pending (không có dữ liệu cá nhân).
- Stores: `programs`, `plannedSessions`, `workouts` (aggregate: session + exercises + sets), `measurements`, `goals`, `profile`, `outbox`, `syncMeta`, `drafts`.
- Nâng phiên bản: dùng `onupgradeneeded` với migration tuần tự theo version; không xóa store có dữ liệu outbox; test migration từ mọi version trước.

### 5.2 Mô hình đồng bộ
- Đơn vị đồng bộ = **aggregate** (program kèm days/exercises; planned session; workout session kèm exercises/sets; measurement; goal; profile).
- ID: UUIDv7 sinh ở client.
- Mỗi aggregate có `rev` (integer, server tăng) và `last_op_id`.
- Push: outbox entry `{op_id, entity, id, base_rev, payload|delete}`. Server: nếu `base_rev == rev` → ghi, `rev+1`, trả `rev` mới; nếu `last_op_id == op_id` → coi như đã áp dụng (idempotent retry); nếu khác → `409 conflict` + bản server.
- Pull: `GET /api/sync/changes?since=<seq>&limit=200`; mỗi row có `change_seq` (counter per user, tăng ở mỗi write) — index `(user_id, change_seq)`. Xóa = tombstone (`deleted_at`, vẫn tăng `change_seq`) → không resurrect.
- Batch push tối đa 25 op / request, payload ≤ 256 KB.
- Retry: exponential backoff (2s → 5 phút, tối đa 8 lần liên tiếp, sau đó `error` chờ người dùng bấm thử lại); thay đổi không bao giờ bị xóa khỏi outbox do lỗi mạng/quota (D1 trả lỗi quota → giữ nguyên, hiển thị trạng thái).
- Conflict: không silent overwrite. UI hiển thị hai phiên bản (local vs server) theo trường thay đổi; người dùng chọn "giữ của tôi" (push lại với `base_rev` mới) hoặc "lấy bản server". Với workout: so sánh theo set.
- Trạng thái mỗi aggregate: `pending / syncing / synced / error / conflict`.

### 5.3 Session/khóa tài khoản khi offline
- Offline: app dùng dữ liệu local của `lastUserId` nếu chưa logout; không kiểm tra được hạn session.
- Reconnect: request đầu trả 401 (hết hạn) → yêu cầu đăng nhập lại; outbox giữ nguyên và chỉ đẩy khi đăng nhập **đúng user đó**. Trả 403 `account_locked` → dừng sync, hiển thị thông báo; dữ liệu local giữ để người dùng xuất PDF/ghi chú, không đẩy lên.
- Logout: nếu outbox còn pending → cảnh báo; xác nhận → xóa `pp_user_<id>`, cache API, drafts. Không hứa xóa từ xa thiết bị offline.

### 5.4 Service worker
- Precache app shell + chunk 3D/PDF + font. API **không** cache bằng SW (dữ liệu nằm ở IndexedDB).
- Update: SW mới chờ (`waiting`), app hiển thị "Có phiên bản mới" → người dùng bấm cập nhật khi không có workout đang ghi; drafts ở IndexedDB nên không mất khi reload.
- Công cụ: `vite-plugin-pwa` (MIT, Workbox) ⏳ xác nhận version khi scaffold.

## 6. Hệ thống 3D (code-only)

Module `src/viewer3d/` (lazy-load bằng `import()` chỉ ở màn Exercise detail):

| Module | Trách nhiệm |
|---|---|
| `character/` | Character generator: sinh mesh nam cơ bắp toàn thân từ tham số (chiều cao, tỷ lệ, khối cơ) bằng code |
| `rig/` | Skeleton (bone hierarchy), bind pose, skin weights, IK 2-bone (tay/chân) để khóa điểm tiếp xúc |
| `muscles/` | Muscle regions trên mesh (vertex attribute) → highlight chính/phụ bằng shader |
| `equipment/` | Generator dụng cụ: dumbbell, barbell + đĩa, ghế (phẳng/dốc/preacher), rack, cable tower + pulley + dây + attachments, máy (chest press, leg extension, leg curl, pec deck, hack squat, leg press, calf), xà, máy chạy bộ, xe đạp |
| `exercises/` | Exercise definitions: phases/timeline, pose keyframes, ROM, contact constraints, camera presets |
| `viewer/` | Scene, camera (orbit, zoom có giới hạn, preset trước/sau/bên, reset), play/pause/restart/speed, legend |
| `quality/` | Quality tiers (low/medium/high): độ phân giải mesh, shadow, pixel ratio, antialias |

Phương pháp dựng nhân vật đề xuất (kiểm chứng ở Giai đoạn 1):
1. Định nghĩa cơ thể bằng tập primitive giải phẫu (ellipsoid/capsule/spline "muscle bellies") gắn với bone ở bind pose.
2. Hợp nhất thành **một bề mặt liền** bằng implicit surface (smooth-min SDF) + polygonize (surface nets/marching cubes) → mesh liên tục, không lộ khớp nối.
3. Tính skin weights theo khoảng cách tới bone segment + làm mượt; dùng `THREE.SkinnedMesh` (deform ở vai, khuỷu, hông, gối) và corrective blend tùy chọn.
4. Material procedural (MeshPhysical/standard + shader noise sinh bằng code), không texture ngoài.
5. Bàn tay/bàn chân: mesh chi tiết riêng bằng code (ngón tay có đốt) nối vào cùng skeleton.
- Kết quả polygonize có thể cache trong IndexedDB theo version generator để lần sau mở nhanh. ⏳ đo thời gian sinh trên mobile.

Hiệu năng: `requestAnimationFrame` chỉ chạy khi viewer visible (IntersectionObserver + `visibilitychange`); dispose geometry/material/renderer khi unmount; không gọi backend trong render loop.

Kiểm tra "không asset ngoài": test tĩnh quét repo/bundle không có `.glb/.gltf/.fbx/.obj/.png/.jpg` cho 3D, không có loader (`GLTFLoader`, `FBXLoader`, `OBJLoader`, `TextureLoader` với URL) trong `src/viewer3d`.

## 7. i18n & theme
- Thư viện i18n nhẹ tự viết (typed keys từ `vi.json` làm chuẩn) hoặc `i18next` ⏳ chốt ở Giai đoạn 2. Test bắt buộc: hai file message có cùng tập key.
- Theme: CSS variables, `prefers-color-scheme` + lựa chọn thủ công lưu trong profile.

## 8. Ngân sách free-tier (ước lượng thiết kế)
Xem `DEPLOYMENT.md` §Hạn mức. Nguyên tắc: 1 query auth/request; pull dùng `change_seq` index; dashboard tính ở client từ dữ liệu local (không query aggregate trên server mỗi lần mở); không cron; không polling dày (sync khi có thay đổi + khi online/foreground, tối đa 1 pull / 60 s).
