# DATA MODEL — peak.pump

Trạng thái: **thiết kế Giai đoạn 0** (chưa có migration). Migration đầu tiên sẽ là `migrations/0001_init.sql` ở Giai đoạn 2.

## 1. Quy ước chung
- ID: `TEXT` UUIDv7 (client sinh cho dữ liệu người dùng; server sinh cho users/sessions).
- Timestamp: `INTEGER` epoch milliseconds UTC (`*_at`).
- Ngày tập/lịch: `TEXT` `YYYY-MM-DD` (date-only, theo timezone user tại thời điểm ghi). Không chuyển đổi qua UTC.
- Mọi bảng dữ liệu người dùng có `user_id` (ownership) + index bắt đầu bằng `user_id`.
- Aggregate root có: `rev INTEGER` (server tăng), `last_op_id TEXT`, `change_seq INTEGER` (counter per user), `created_at`, `updated_at`, `deleted_at` (tombstone).
- Số đo: `REAL` (kg, cm, km, km/h, %), `INTEGER` cho reps, giây. `NULL` = không nhập (không bao giờ dùng 0 thay missing).

## 2. Auth & tài khoản

```sql
users(
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,            -- hiển thị
  username_norm TEXT NOT NULL UNIQUE,-- lowercase, NFC
  display_name TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','admin')),
  status TEXT NOT NULL CHECK(status IN ('active','locked')),
  pw_hash BLOB NOT NULL,             -- HMAC-SHA256(pepper, clientKdfOutput) (xem ARCHITECTURE §4.1, chờ duyệt)
  pw_salt BLOB NOT NULL,
  pw_params TEXT NOT NULL,           -- JSON {alg:'argon2id', m, t, p, v}
  must_change_pw INTEGER NOT NULL DEFAULT 0,
  change_seq INTEGER NOT NULL DEFAULT 0,  -- counter đồng bộ per user
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  last_login_at INTEGER
)
sessions(
  id_hash BLOB PRIMARY KEY,          -- SHA-256(token)
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
)  INDEX(user_id)
login_throttle(key TEXT PRIMARY KEY, window_start INTEGER, fail_count INTEGER, locked_until INTEGER)
admin_audit(id, admin_id, action, target_user_id, at)   -- không chứa dữ liệu tập luyện
```

Admin API chỉ truy cập `users`, `sessions` (đếm/revoke), `admin_audit`. Service layer admin **không import** repository dữ liệu tập luyện (kiểm tra bằng test + lint rule import boundary).

## 3. Profile
```sql
profiles(user_id PK, height_cm REAL, birth_year INTEGER, timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
         locale TEXT NOT NULL DEFAULT 'vi', theme TEXT NOT NULL DEFAULT 'system', + sync columns)
```

## 4. Exercise catalog
**Quyết định:** catalog là **code** (`shared/catalog/exercises.ts`), versioned bằng `CATALOG_VERSION`, không phải bảng D1.
- Lý do: mỗi bài bắt buộc đi kèm animation code; thêm bài = release code + test; tránh row reads; client offline có sẵn.
- Server dùng cùng module để validate `exercise_id`.
- Lịch sử không phụ thuộc catalog: actual exercise lưu snapshot `name_vi`, `name_en`, `load_mode`, `primary_muscles`, `secondary_muscles`, `catalog_version`.
- Không bao giờ xóa/đổi nghĩa một `exercise_id`; bài bị loại → `retired: true`.

## 5. Program / template / planned

```sql
programs(id, user_id, name, source TEXT CHECK(source IN ('template_ppl','template_ul','custom','import')),
         schedule_kind TEXT CHECK(schedule_kind IN ('weekly','multi_week')),
         start_date TEXT, end_date TEXT, is_active INTEGER, body_json TEXT NOT NULL, + sync cols)
  INDEX(user_id, change_seq), INDEX(user_id, is_active)
```
`body_json` = danh sách program days: `{dayId, weekIndex|null, weekday 1–7, title, exercises:[{exerciseId, order, sets, repsMin, repsMax, targetKg|null, restSec, cardio:{durationMin, distanceKm, speedKmh, inclinePct}|null}]}`.

Trade-off: lưu chi tiết template dạng JSON trong một row thay vì 3 bảng con → mỗi lần sửa template = 1 row write (D1 Free chỉ 100.000 row writes/ngày), sync theo aggregate đơn giản; đổi lại không query SQL vào bên trong template — chấp nhận vì dashboard/lịch sử không đọc template.

```sql
planned_sessions(id, user_id, program_id, program_day_id TEXT,
  original_date TEXT NOT NULL, scheduled_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('planned','skipped','completed','cancelled')),
  plan_json TEXT NOT NULL,          -- snapshot planned exercises/sets tại thời điểm sinh/cập nhật
  actual_session_id TEXT,           -- liên kết workout khi completed
  + sync cols)
  INDEX(user_id, scheduled_date), INDEX(user_id, change_seq)
```
- Sửa template → chỉ regenerate `plan_json` cho row `status='planned'` và `scheduled_date >= today` và chưa có workout in_progress.
- Dời lịch → đổi `scheduled_date`, giữ `original_date`.
- Đổi chương trình → các row tương lai `planned` của chương trình cũ → `cancelled`.

## 6. Actual workout (snapshot, quan hệ)

```sql
workout_sessions(id, user_id, planned_session_id NULL, session_date TEXT NOT NULL, timezone TEXT NOT NULL,
  status TEXT CHECK(status IN ('in_progress','completed')), started_at, finished_at, note, + sync cols)
  INDEX(user_id, session_date), INDEX(user_id, change_seq)
workout_exercises(id, session_id, user_id, exercise_id, position INTEGER,
  name_vi, name_en, load_mode, kind TEXT CHECK(kind IN ('strength','cardio')),
  primary_muscles TEXT, secondary_muscles TEXT, catalog_version INTEGER, updated_at)
  INDEX(session_id), INDEX(user_id, exercise_id)
workout_sets(id, workout_exercise_id, session_id, user_id, set_index INTEGER,
  kg REAL, reps INTEGER, completed INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER, distance_km REAL, speed_kmh REAL, incline_pct REAL,
  completed_at INTEGER, updated_at INTEGER)
  INDEX(session_id)
```
Trade-off: actual dùng bảng quan hệ (không JSON) vì lịch sử theo bài ("lần trước", tiến bộ theo bài, báo cáo) cần query theo `exercise_id`. Revision/conflict ở cấp `workout_sessions` (aggregate); push chỉ gửi row con thay đổi (upsert theo id) + danh sách id bị xóa → giảm row writes.

## 7. Body metrics & goals

```sql
body_measurements(id, user_id, measured_on TEXT NOT NULL, measured_at INTEGER,
  weight_kg REAL, body_fat_pct REAL, muscle_mass_kg REAL,
  waist_cm REAL, chest_cm REAL, hip_cm REAL, arm_cm REAL, thigh_cm REAL, calf_cm REAL,
  note TEXT, + sync cols)
  CHECK(at least one metric NOT NULL)
  INDEX(user_id, measured_on), INDEX(user_id, change_seq)
goals(id, user_id, metric TEXT, target_value REAL NOT NULL, start_date TEXT NOT NULL, due_date TEXT NOT NULL,
  baseline_value REAL, baseline_source TEXT CHECK(baseline_source IN ('measurement','manual')),
  baseline_measurement_id TEXT, status TEXT CHECK(status IN ('active','achieved','abandoned')), + sync cols)
```

## 8. Import
```sql
imports(id TEXT PRIMARY KEY /* client import_id */, user_id, created_at, program_id, row_count, file_sha256)
```
Server: kiểm `imports.id` trước; nếu đã tồn tại cho user → trả kết quả cũ. Toàn bộ ghi trong một `db.batch([...])` (D1 batch chạy như transaction) → không ghi một phần.

## 9. Quy tắc tính (khóa trước khi code — được test bằng dataset kỳ vọng)

### 9.1 Tỷ lệ hoàn thành (completion)
- Kỳ tính: tuần (Thứ Hai–Chủ Nhật theo timezone user) hoặc tháng.
- **Mẫu số** = số planned session có `scheduled_date` trong kỳ **và ≤ hôm nay**, `status ∈ {planned, skipped, completed}` (loại `cancelled`).
- **Tử số** = số planned session trong mẫu số có `status = completed` (có workout `completed` liên kết).
- `skipped` nằm trong mẫu số, không trong tử số.
- Rescheduled: tính theo `scheduled_date` hiện tại; `original_date` không tính.
- Buổi tương lai chưa tới không vào mẫu số. Buổi hôm nay chưa tập: vào mẫu số (hiển thị "còn hôm nay").
- Workout tự do (không planned) hiển thị riêng "buổi thêm", không vào tỷ lệ.
- Mẫu số = 0 → hiển thị "—", không hiển thị 0%.

### 9.2 Volume (strength)
- Set được tính: `completed = 1` **và** `kg IS NOT NULL` **và** `reps > 0`, bài `kind = strength` và `load_mode ≠ bodyweight`.
- `volume_set = kg × reps × load_factor`, với `load_factor = implements × sides` khai báo cố định trong catalog cho từng bài (snapshot vào `workout_exercises`).
  - `implements`: số dụng cụ mang tải mà `kg` mô tả (2 khi nhập kg **mỗi quả** tạ đơn hoặc **mỗi stack** cáp đôi).
  - `sides`: 2 khi bài làm từng bên và `reps` là reps **mỗi bên**; quy ước: set `completed` = đã làm đủ cả hai bên.
- `load_mode` & cách ghi kg:
  | load_mode | Người dùng nhập | Ví dụ factor | Ghi chú |
  |---|---|---|---|
  | `barbell` | tổng tải gồm thanh đòn | 1×1 | |
  | `dumbbell` | kg **mỗi quả** | 2×1 (2 quả), 1×2 (một tay), 2×2 (BSS) | |
  | `cable` | số kg trên stack | 1×1, 2×1 (cáp đôi), 1×2 (một tay) | |
  | `machine` | số kg hiển thị/thêm trên máy | 1×1 | không so sánh giữa các máy khác nhau |
  | `bodyweight` | tải **thêm** (0 nếu không) | — | không tính kg volume; tính "reps volume" riêng |
- Cardio không vào strength volume.
- Set `completed = 0` hoặc thiếu kg/reps → không tính, đếm vào "set chưa đủ dữ liệu" hiển thị kèm.
- UI ghi chú: volume là chỉ số theo dõi cùng bài theo thời gian; tổng volume không so sánh tuyệt đối giữa các bài.

### 9.3 Nhóm cơ
- Với mỗi set strength `completed = 1` (kể cả bodyweight): +1 **set cơ chính** cho từng muscle trong `primary_muscles`, +1 **set cơ phụ** cho từng muscle trong `secondary_muscles`.
- Hiển thị hai cột riêng; không cộng dồn; không hệ số activation.

### 9.4 Tiến bộ theo bài
- Mỗi buổi: `best set` = set completed có kg cao nhất (bằng nhau → reps cao hơn). Biểu đồ kg và reps của best set theo ngày; kèm volume buổi của bài đó.
- Bodyweight: reps cao nhất (và tải thêm nếu có).

### 9.5 Chỉ số cơ thể
- Biến động trong kỳ = giá trị gần nhất ≤ cuối kỳ − giá trị gần nhất ≤ đầu kỳ (cùng metric, chỉ dùng bản ghi có metric đó). Thiếu một trong hai → "không đủ dữ liệu".

### 9.6 Mục tiêu
- Baseline khi tạo goal = giá trị đo gần nhất của metric có `measured_on ≤ start_date`; không có → người dùng nhập tay (`baseline_source = manual`) hoặc goal chưa tính được tiến độ.
- Tiến độ % = `(current − baseline) / (target − baseline) × 100`, `current` = đo gần nhất ≤ hôm nay và ≥ start_date. Không có số đo sau start → "chưa có dữ liệu". Hiển thị số thực (có thể âm hoặc >100%), thanh tiến độ clamp 0–100.
- `target = baseline` → không cho tạo.

### 9.7 So sánh tháng
- Tháng hiện tại chưa kết thúc: so sánh **month-to-date** — ngày 1..N tháng này vs ngày 1..min(N, số ngày tháng trước) tháng trước. Nhãn bắt buộc: "MTD: 1–N/M vs 1–N/M-1".
- Tháng đã kết thúc: full month vs full month; nhãn "Cả tháng".
- Chỉ số so sánh: buổi completed, completion rate, strength volume, số set theo nhóm cơ chính.

## 10. Backup / restore
- D1 export: `wrangler d1 export <db> --remote --output backup-YYYYMMDD.sql` (chạy thủ công, file không commit vào repo). Chi tiết + Time Travel trong `DEPLOYMENT.md`.
