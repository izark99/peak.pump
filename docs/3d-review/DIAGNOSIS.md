# Chẩn đoán nhân vật v1 (bị từ chối ở CỔNG DUYỆT 2)

Ngày: 2026-10-08. Ảnh mốc "trước": `docs/3d-review/before/` (front, side, back, three-quarter, face — camera cố định).
Nguyên nhân dưới đây xác định từ code + số đo trên mesh sinh ra (`tests/diag/measure.test.ts`), không suy đoán từ ảnh.

## Số đo mesh v1 (bind pose, quality medium)
| Lát cắt | Rộng | Sâu | Tham chiếu nam fitness ~180 cm |
|---|---|---|---|
| Ngực y=1.33 (không tính tay) | 0.365 | 0.245 | ~0.36–0.38 |
| Eo y=1.08 | 0.297 | 0.205 | ~0.28–0.30 |
| **Hông y=0.93** | **0.382** | 0.251 | ~0.33–0.35, phải hẹp hơn ngực |
| Cổ y=1.53 | 0.200 (gồm traps) | 0.131 | cổ ~0.13 |
⇒ Hông rộng hơn ngực: mất V-taper. Cổ trông thô do traps/SCM dựng thành ống lồi.

## Nguyên nhân theo nhóm

### 1. Hình thể (shape modeling) — nguyên nhân chính
- Thân được ghép từ 4 ellipsoid lõi xếp chồng (`anatomy.ts:236-239`), mỗi ellipsoid có profile riêng; chỗ giao giữa chúng tạo "eo thắt/nở" không chủ đích. Không có profile mặt cắt liên tục theo chiều cao ⇒ không điều khiển được silhouette.
- Pelvis `r.x=0.152` + vỏ quần `r.x=0.163` (`anatomy.ts:236`, vỏ quần cuối hàm) + mông `0.085` ⇒ hông 0.382 > ngực.
- Chi quá nhỏ so với thân: lõi bắp tay `r=0.047→0.036` (`anatomy.ts:294`, chu vi ~25–30 cm), cẳng tay `0.042→0.025`. Nam fitness: bắp tay ~37–40 cm, cẳng tay ~30 cm.

### 2. Khối cơ dạng "cục dán"
- Mỗi cơ là ellipsoid độc lập lồi ra khỏi lõi, hợp bằng smooth-min với bán kính blend `k` rất nhỏ so với kích thước khối: abs `k=0.011`, độ nổi 1,8 cm (`anatomy.ts:258`); ngực `k=0.022` (`:245`); biceps/triceps `k=0.015` (`:295-298`). Vùng blend chỉ ~1 cm ⇒ nếp gãy quanh từng khối ⇒ "viên tròn gắn lên".
- Abs dựng thành 6 khối lồi; ở người thật là một tấm phẳng với các rãnh gân ngang (tendinous intersections) — sai mô hình.
- Lưng trên: ellipsoid "mid traps" `r=(0.10,0.085,0.034)` nhô 2 cm khỏi lồng ngực (`:279`) ⇒ khối u.

### 3. Cổ–vai–ngực
- Gờ xương đòn `roundCone r=0.012, k=0.02` và SCM `r=0.015` (`:273-276`) tạo các gờ sắc; tie-in ngực–vai là ellipsoid riêng (`:246`).
- Cổ thân (`body`) và cổ đầu (`head`) là **hai mesh chồng nhau** với bán kính gần bằng nhau (0.063/0.056 vs 0.060/0.057) ⇒ đường giao răng cưa quanh cổ (lỗi giao nhau mesh, không phải normals).

### 4. Topology / vùng vật liệu (mép quần răng cưa)
- Quần, giày, tóc không phải hình học riêng mà là **nhãn vùng trên từng vertex** của mesh da (`generate.ts:119-171`, primitive gần nhất quyết định vùng).
- Material được gán **theo tam giác** (`build.ts:67-75`, đa số vertex) ⇒ biên vùng đi theo lưới surface-nets 1 cm ⇒ bậc thang/răng cưa. Đây là lỗi topology-gán-vùng, không phải z-fighting hay normals.
- Vỏ quần dính vào da bằng smooth-min `k=0.012` ⇒ không có mép vải thật.

### 5. Mặt
- Nhãn cầu bán kính 1.22 cm đặt gần như lộ toàn phần, hốc mắt khoét bằng cầu trừ `r=0.0165` (`headPrims`), **không có mí mắt** ⇒ mắt tròn, trợn.
- Môi là 2 ellipsoid lồi + rãnh trừ `r=0.0024` ⇒ đọc như miệng hé, môi dày.
- Má/hàm: ellipsoid má + roundCone hàm với blend nhỏ ⇒ má phồng, cằm "nhỏ giọt".
- Đường chân tóc: cùng lỗi nhãn vùng như quần.

### 6. Normals / skinning / lighting
- Normals: tính từ gradient SDF giải tích — **không phải nguyên nhân** (bề mặt mịn đúng như SDF định nghĩa; test sai số bán kính < 1 mm).
- Skinning: ở tư thế trung lập chưa phải nguyên nhân (lỗi đã có ở bind pose).
- Lighting/material: `sheen 0.35 + clearcoat` (`build.ts:118-122`) và AO nướng tối tới 0.42 (`generate.ts:186`) **khuếch đại** các nếp gãy của khối cơ ⇒ trông như sáp/nhựa. Là yếu tố phụ, sửa sau geometry.

## Chiến lược mới (giải thích trước khi đổi)
**Vì sao cách cũ không đạt:** hợp các khối lồi độc lập (ellipsoid) thì silhouette và bề mặt phụ thuộc vào hàng trăm tham số rời rạc; muốn mượt phải tăng blend ⇒ phình; muốn rõ cơ phải giảm blend ⇒ thành cục.

**Cách mới — vẫn SDF + surface nets (giữ mesher, rig, highlight pipeline), đổi cách mô tả hình:**
1. **Lofted volumes theo profile nhân trắc**: thân, cổ, mỗi đoạn chi là một khối "loft" dọc trục xương với mặt cắt superellipse 4 bán kính (ngang, trước, sau) biến thiên mượt theo bảng profile ⇒ điều khiển silhouette trực tiếp bằng số đo (rộng/sâu/chu vi) và đối chiếu được.
2. **Chi tiết cơ = trường relief biên độ nhỏ** (rãnh/gờ 2–5 mm, Gaussian) cộng vào bề mặt liên tục, không phải khối riêng: rãnh gân bụng, đường giữa, mép dưới ngực, rãnh cột sống, chữ V bụng dưới.
3. **Nhãn cơ tách khỏi hình học**: vùng cơ là thể tích nhãn mềm chỉ dùng cho highlight ⇒ không có mesh cục, không z-fighting.
4. **Skin weights từ proxy xương** (khoảng cách tới đoạn xương) thay vì từ khối cơ ⇒ weights không phụ thuộc cách điêu khắc.
5. **Quần/giày/tóc là mesh riêng**: vỏ offset từ chính SDF cơ thể (+5–8 mm) cắt bằng mặt phẳng ⇒ mép cạp/ống sạch do giao hình học thật, không răng cưa, không z-fighting. Cổ đầu/thân giao nhau tại một cao độ xác định (dưới cằm).

**Ảnh hưởng:** rig/skeleton/IK không đổi (bone giữ nguyên tên/vị trí); highlight vẫn qua thuộc tính vertex; hiệu năng — loft SDF đắt hơn ellipsoid nhưng số primitive giảm mạnh (~150 → ~40), mesher dải hẹp giữ nguyên; thêm 3–4 mesh nhỏ (quần, giày, tóc) ~ +15% vertex.
