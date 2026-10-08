# DEPLOYMENT — peak.pump

Trạng thái: **Giai đoạn 0** — chưa có tài nguyên Cloudflare nào được tạo. Không tạo/deploy khi chưa có cho phép của chủ dự án.

## 1. Hạn mức free-tier đã kiểm tra

Ngày kiểm tra: **2026-10-08**. Nguồn: Cloudflare docs qua công cụ tìm kiếm tài liệu Cloudflare (MCP `search_cloudflare_documentation`); truy cập trực tiếp developers.cloudflare.com bị chặn bởi egress proxy của môi trường dev.

### Workers Free (áp dụng cho Pages Functions)
Nguồn: https://developers.cloudflare.com/workers/platform/limits/
| Hạng mục | Free |
|---|---|
| Requests | 100.000/ngày (reset 00:00 UTC), **dùng chung** giữa Workers và Pages Functions |
| CPU time / HTTP request | **10 ms** (có dung sai cho vượt không thường xuyên; vượt thường xuyên bị terminate) |
| Memory | 128 MB |
| Subrequests | 50 external + 1.000 tới dịch vụ Cloudflare / invocation (changelog 2026-02-11) |
| Worker size | 64 MiB |
| Startup time | 1 s |
| Env vars | 64/Worker, 5 KB mỗi biến |
| Request body (Cloudflare Free plan) | 100 MB |
| URL size | 16 KB |
| Cron Triggers | 5/account (dự án không dùng) |
Khi vượt 100.000 request/ngày: Pages có tùy chọn **Fail open / closed** (Settings → Runtime). Dự án chọn **Fail closed** cho API vì Functions làm auth ⏳ xác nhận lại khi cấu hình — lưu ý: fail closed với Pages trả trang lỗi thay vì static asset; cần đánh giá vì app shell offline vẫn chạy nhờ service worker.

### Pages Free
Nguồn: https://developers.cloudflare.com/pages/platform/limits/ (cập nhật 2026-09-05), https://developers.cloudflare.com/pages/functions/pricing/ (cập nhật 2026-09-08)
| Hạng mục | Free |
|---|---|
| Builds | 500/tháng, 1 build đồng thời, timeout 20 phút |
| Files / site | 20.000 |
| File size | 25 MiB / file |
| Custom domains | 100 / project |
| `_headers` | 100 rule, 2.000 ký tự/header |
| Static asset requests | miễn phí, không giới hạn (không tính quota Functions) |
| Functions invocation routes | ≥ 1 include rule, ≤ 100 include/exclude, ≤ 100 ký tự/rule |
| Preview deployments | không giới hạn |

### D1 Free
Nguồn: https://developers.cloudflare.com/workers/platform/pricing/#d1, changelog 2026-09-01
| Hạng mục | Free |
|---|---|
| Rows read | 5.000.000 / ngày |
| Rows written | 100.000 / ngày (index cũng tính thêm row written) |
| Storage | 5 GB tổng account |
| Reset | 00:00 UTC |
| Vượt hạn mức | **Từ 2026-09-01**: query lỗi cho tới khi reset (không mất dữ liệu đã lưu) |
⏳ **Chưa kiểm chứng được** (trang `/d1/platform/limits/` không trả về qua công cụ tìm kiếm): dung lượng tối đa mỗi database, số database/account, số bound parameter/query, độ dài SQL tối đa, số query/invocation, thời gian giữ Time Travel trên Free. Sẽ kiểm tra lại trước Giai đoạn 2 (hoặc nhờ bạn xác nhận) — thiết kế đã giữ batch nhỏ (≤ 50 statement, ≤ 100 tham số/statement) để an toàn.

### Hệ quả thiết kế
- Password hashing server-side ở mức OWASP không vừa 10 ms CPU → xem `ARCHITECTURE.md` §4.1 (**chờ duyệt**).
- Row writes 100k/ngày là ràng buộc chặt nhất → template dạng JSON, push chỉ row thay đổi, `last_seen_at` cập nhật ≤ 1 lần/ngày, throttle chỉ ghi khi sai.
- Quota hết → API trả `503 quota_exceeded`; client giữ outbox, hiển thị trạng thái, thử lại sau 00:00 UTC.

## 2. Môi trường dev đã kiểm tra
- Node v22.22.0, npm 10.9.4, pnpm 10.28.0, wrangler 4.148.0 (qua `npx`), Chromium tại `/opt/pw-browsers`.
- `wrangler dev` chạy workerd local được; telemetry tới `sparrow.cloudflare.com` bị chặn (không ảnh hưởng).

## 3. Quy trình (sẽ hoàn thiện ở Giai đoạn 2 & 7)
1. **Chạy local**: `pnpm install` → `pnpm db:migrate:local` → `pnpm dev` (Vite + `wrangler pages dev` với D1 local).
2. **Tạo D1** (cần cho phép): `wrangler d1 create peak-pump-prod` → ghi `database_id` vào `wrangler.toml` (ID không phải secret).
3. **Migrations**: `wrangler d1 migrations apply peak-pump-prod --remote`. Migration destructive cần phê duyệt riêng + backup trước.
4. **Secrets**: `PEPPER_SECRET` đặt bằng `wrangler pages secret put PEPPER_SECRET` (không commit; `.env.example` chỉ có tên biến).
5. **Bootstrap admin**: `pnpm bootstrap-admin` (xem `ARCHITECTURE.md` §4.5).
6. **Build**: `pnpm build` → `dist/` + `functions/`.
7. **Deploy Pages** (cần cho phép): `wrangler pages deploy dist --project-name peak-pump`.
8. **Smoke test**: script kiểm tra login, `/api/me`, tạo/xóa một measurement trên tài khoản test, logout.
9. **Backup**: `wrangler d1 export peak-pump-prod --remote --output <ngoài repo>`; lịch gợi ý: hàng tuần + trước mỗi migration.
10. **Rollback**: Pages → rollback về deployment trước trong dashboard; D1 → Time Travel restore ⏳ (xác nhận retention) hoặc import từ file export.
11. **Kiểm tra free-only**: account ở Workers Free; không bind R2/KV/Queues/DO; không cron; không bật paid add-on; xem Usage dashboard.
