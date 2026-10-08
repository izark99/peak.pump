# EXERCISE SOURCES — Thư viện ~40 bài (đề xuất CỔNG DUYỆT 1)

Trạng thái: **ĐÃ DUYỆT & ĐÓNG BĂNG (CỔNG DUYỆT 1, 2026-10-08)**. Tier label chỉ dùng nội bộ để tuyển chọn — app không hiển thị (D-012).

Ngày tra cứu: **2026-10-08**.

## 1. Phương pháp tuyển chọn

Tiêu chí:
1. Phù hợp hypertrophy: tải được tăng dần đơn giản, có lực cản ở vị trí cơ bị kéo dài (lengthened), ổn định để tập gần thất bại.
2. Định hướng hình thể fitness model: ưu tiên vai giữa (side delts), ngực trên, độ rộng lưng (lats), tay, bụng, bắp chân — nhưng vẫn cân bằng toàn thân.
3. Phủ đủ thiết bị: barbell, dumbbell, machine, cable, bodyweight.
4. Tránh biến thể trùng lặp: mỗi bài phải khác về thiết bị, góc kéo hoặc vùng cơ trọng tâm.
5. Có thể dựng 3D đúng chuyển động bằng code trong phạm vi dự án.

Phân loại bằng chứng (không trộn lẫn):
- **[ET] Expert tier ranking** — xếp hạng của chuyên gia (Jeff Nippard), không phải bằng chứng nghiên cứu. Chỉ ghi nhãn S/A khi bài viết nguồn có nhãn đó.
- **[RS] Research** — nghiên cứu có đối chứng đo phì đại cơ (MRI/siêu âm).
- **[CU] Được tuyển chọn cho hypertrophy** — không có tier từ nguồn; chọn theo tiêu chí trên + nguyên tắc chung từ [RS].

### ⚠️ Giới hạn kiểm chứng (bắt buộc đọc)
- Môi trường này **chặn truy cập trực tiếp** barbend.com, fitnessvolt.com, developers.cloudflare.com qua WebFetch (egress proxy). Nhãn tier dưới đây lấy từ **kết quả tìm kiếm tóm tắt các bài viết thứ cấp** (BarBend, FitnessVolt, BoxRox) về video của Jeff Nippard — **chưa xem video gốc, chưa đọc toàn văn bài viết**.
- Vì vậy mọi nhãn [ET] được đánh dấu "chờ đối chiếu". Nếu bạn muốn nhãn tier xuất hiện trong app, cần: (a) bạn xác nhận từ video gốc, hoặc (b) cho phép mở rộng network policy để tôi đọc nguồn. Nếu không, app sẽ chỉ hiển thị "Được tuyển chọn cho hypertrophy" cho tất cả bài và để nhãn tier trong tài liệu nội bộ.
- Số liệu nghiên cứu lấy từ abstract/tóm tắt (PubMed, Frontiers, trang tác giả). Chưa đọc toàn văn mọi bài.

## 2. Nguồn

| ID | Nguồn | Loại | URL | Ghi chú |
|---|---|---|---|---|
| ET-CHEST | BarBend — "Jeff Nippard Ranks Chest Exercises for Hypertrophy" (video gốc: "I Ranked Every CHEST Exercise (Best To Worst)") | ET | https://barbend.com/news/jeff-nippard-ranks-chest-exercises-for-hypertrophy/ | Thang S→F, 20 bài. FitnessVolt dùng thang số 1–6 cho cùng video → **nguồn mô tả khác nhau** |
| ET-BACK | BarBend — Nippard back ranking (2024-02-05); FitnessVolt — back | ET | https://barbend.com/news/jeff-nippard-ranks-best-and-worst-back-exercises/ ; https://fitnessvolt.com/jeff-nippard-best-and-worst-back-exercises | BarBend: S→F; FitnessVolt: tier 1–6. Không tìm được danh sách S chính xác |
| ET-QUAD | BarBend — quad ranking (2024-08); FitnessVolt — quad | ET | https://barbend.com/news/best-quad-exercises-ranking-best-to-worst-jeff-nippard/ ; https://fitnessvolt.com/jeff-nippard-ranks-best-worse-quad-exercises | |
| ET-SHOULDER | BarBend — shoulder tier list (2024-09-10) | ET | https://barbend.com/news/best-worst-shoulder-exercises-tier-list/ | BarBend/BoxRox: 20 bài; FitnessVolt: 21 bài |
| ET-BICEPS | BarBend / FitnessVolt — biceps ranking (2024-10) | ET | https://barbend.com/jeff-nippard-ranks-best-and-worst-biceps-exercises ; https://fitnessvolt.com/jeff-nippard-ranks-best-and-worst-bicep-exercises/ | 20 vs 22 bài tùy nguồn |
| ET-TRICEPS | BarBend — triceps ranking; BoxRox | ET | https://barbend.com/news/jeff-nippard-ranks-best-and-worst-triceps-exercises/ ; https://www.boxrox.com/?p=213945 | Nguồn bất đồng về skull crusher, pushdown |
| ET-GLUTE | FitnessVolt — glute ranking (2025-03-17) | ET | https://fitnessvolt.com/jeff-nippard-rates-glute-exercises/ | Có thứ tự, **không** in nhãn chữ |
| RS-MAEO22 | Maeo et al., Eur J Sport Sci 2022 — triceps overhead vs neutral, MRI, 12 tuần | RS | https://doi.org/10.1080/17461391.2022.2100279 | Overhead > neutral cho cả 3 đầu cơ tam đầu |
| RS-MAEO21 | Maeo et al., Med Sci Sports Exerc 2021 — seated vs prone leg curl, MRI | RS | https://pubmed.ncbi.nlm.nih.gov/33009197/ | Seated lợi hơn cho hamstrings hai khớp; n=20 untrained |
| RS-KASS23 | Kassiano et al., J Strength Cond Res 2023 — calf partial ROM | RS | https://pubmed.ncbi.nlm.nih.gov/37015016/ | Initial (lengthened) partial > full > final cho medial gastrocnemius; n=42 nữ |
| RS-KUBO19 | Kubo et al., Eur J Appl Physiol 2019 — full vs half squat (tóm tắt bởi Stronger by Science) | RS | https://www.strongerbyscience.com/squat-depth/ | Full squat > half cho glutes & adductors; quads tương đương. Chưa truy cập bản gốc |
| RS-PLOT23 | Plotkin et al., Front Physiol 2023 — hip thrust vs back squat, MRI | RS | https://doi.org/10.3389/fphys.2023.1279170 | Glutes tương đương; squat > hip thrust cho quads & adductors |
| RS-PEDR22 | Pedrosa et al., Eur J Sport Sci 2022 — knee extension partial ROM | RS | https://doi.org/10.1080/17461391.2021.1927199 | Lengthened partial → phì đại vùng xa quads tốt hơn; n=45 nữ untrained |
| RS-WOLF23 | Wolf et al., Int J Strength Cond 2023 — meta-analysis partial vs full ROM | RS | https://journal.iusca.org/index.php/Journal/article/view/182 | Full ROM lợi nhỏ/không đáng kể nói chung; lengthened partial có xu hướng lợi nhưng CI cắt 0 |
| RS-SCHO17 | Schoenfeld, Ogborn, Krieger, J Sports Sci 2017;35(11):1073–1082 — dose-response weekly sets | RS | (chưa lấy được URL bản chính thức; bản tác giả trên ResearchGate) | Nền tảng chung về volume, không xếp hạng bài |

**Các điểm nguồn bất đồng / cần lưu ý:**
- Chest: BarBend dùng S→F; FitnessVolt dùng tier 1–6 cho cùng video.
- Back: BarBend S→F vs FitnessVolt 1–6; danh sách S chính xác không xác định được → không gắn chữ cho bài lưng.
- Triceps: BoxRox xếp skull crusher S; BarBend không xác nhận được → không gắn tier.
- Hamstrings: một bản tóm tắt YouTube không rõ tác giả xếp lying curl S, seated curl A — **trái** với hướng của RS-MAEO21 và không xác minh được là của Nippard → bỏ qua nguồn này.
- Lengthened partials: RS-KASS23, RS-PEDR22 ủng hộ; RS-WOLF23 (meta) cho thấy chưa kết luận chắc chắn. App sẽ không khuyên partial reps như quy tắc bắt buộc.

## 3. Danh sách đề xuất (40 bài: 38 strength + 2 cardio)

Ký hiệu thiết bị: BB barbell, DB dumbbell, MC machine, CB cable, BW bodyweight, CA cardio machine.
`load`: cách ghi tải (xem `DATA_MODEL.md` §9.2) — `implements × sides` = load_factor.

### Ngực / Chest (6)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 1 | `barbell_bench_press` | Đẩy ngực ghế phẳng với thanh đòn | Barbell Bench Press | BB + ghế + rack | chest | front_delts, triceps | tổng kg, 1×1 | ET-CHEST: **A** (chờ đối chiếu) |
| 2 | `incline_dumbbell_press` | Đẩy ngực ghế dốc với tạ đơn | Incline Dumbbell Press | DB + ghế dốc | chest (upper) | front_delts, triceps | kg/quả, 2×1 | ET-CHEST: **A** (chờ đối chiếu) |
| 3 | `machine_chest_press` | Đẩy ngực máy | Machine Chest Press | MC | chest | front_delts, triceps | kg máy, 1×1 | ET-CHEST: **S** (chờ đối chiếu) |
| 4 | `seated_cable_fly` | Ép ngực cáp ngồi | Seated Cable Fly | CB (2 stack) + ghế | chest | front_delts | kg/stack, 2×1 | ET-CHEST: **S** (chờ đối chiếu) |
| 5 | `parallel_bar_dip` | Nhún xà kép (thiên ngực) | Parallel Bar Dip | BW (xà kép) | chest | triceps, front_delts | tải thêm | ET-CHEST: **A** (chờ đối chiếu) |
| 6 | `push_up` | Hít đất | Push-up | BW | chest | triceps, front_delts, abs | tải thêm | CU |

### Lưng / Back (7)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 7 | `wide_grip_lat_pulldown` | Kéo xô rộng tay | Wide-Grip Lat Pulldown | CB/MC | lats | upper_back, biceps, rear_delts | kg máy, 1×1 | ET-BACK: nhóm cao nhất theo FitnessVolt (tier 1, thang số) — không gắn chữ |
| 8 | `pull_up` | Hít xà đơn | Pull-up | BW (xà) | lats | upper_back, biceps, forearms | tải thêm | ET-BACK: nhóm thứ hai theo FitnessVolt — không gắn chữ |
| 9 | `chest_supported_dumbbell_row` | Chèo tạ đơn tựa ngực ghế dốc | Chest-Supported Dumbbell Row | DB + ghế dốc | upper_back, lats | rear_delts, biceps | kg/quả, 2×1 | ET-BACK: tier 1 FitnessVolt — không gắn chữ |
| 10 | `seated_cable_row` | Kéo cáp ngồi | Seated Cable Row | CB (V-handle) | upper_back, lats | rear_delts, biceps | kg máy, 1×1 | ET-BACK: tier 1 FitnessVolt — không gắn chữ |
| 11 | `barbell_bent_over_row` | Chèo thanh đòn cúi người | Barbell Bent-Over Row | BB | upper_back, lats | rear_delts, biceps, lower_back | tổng kg, 1×1 | CU |
| 12 | `one_arm_dumbbell_row` | Chèo tạ đơn một tay | One-Arm Dumbbell Row | DB + ghế | lats, upper_back | rear_delts, biceps | kg, 1×2 | CU |
| 13 | `straight_arm_cable_pulldown` | Kéo cáp tay thẳng | Straight-Arm Cable Pulldown | CB (thanh thẳng) | lats | triceps (long head), rear_delts | kg máy, 1×1 | CU |

### Vai / Shoulders (5)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 14 | `seated_dumbbell_shoulder_press` | Đẩy vai tạ đơn ngồi | Seated Dumbbell Shoulder Press | DB + ghế dựng | front_delts | side_delts, triceps | kg/quả, 2×1 | CU |
| 15 | `dumbbell_lateral_raise` | Dang tạ đơn sang ngang | Dumbbell Lateral Raise | DB | side_delts | upper_traps | kg/quả, 2×1 | CU (không tìm được tier) |
| 16 | `single_arm_cable_lateral_raise` | Dang cáp một tay | Single-Arm Cable Lateral Raise | CB (tay cầm) | side_delts | upper_traps | kg, 1×2 | ET-SHOULDER: **S** (chờ đối chiếu) |
| 17 | `reverse_pec_deck` | Bay ngược máy (vai sau) | Reverse Pec Deck | MC | rear_delts | upper_back | kg máy, 1×1 | ET-SHOULDER: **S** (chờ đối chiếu) |
| 18 | `cable_face_pull` | Kéo cáp về mặt | Cable Face Pull | CB (dây thừng) | rear_delts | upper_back, upper_traps | kg máy, 1×1 | CU |

### Tay trước / Biceps (4)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 19 | `dumbbell_preacher_curl` | Cuốn tạ đơn ghế preacher | Dumbbell Preacher Curl | DB + ghế preacher | biceps | brachialis | kg, 1×2 | ET-BICEPS: **S** (chờ đối chiếu) |
| 20 | `incline_dumbbell_curl` | Cuốn tạ đơn ghế dốc | Incline Dumbbell Curl | DB + ghế dốc | biceps | brachialis, forearms | kg/quả, 2×1 | CU (vị trí lengthened) |
| 21 | `hammer_curl` | Cuốn búa | Hammer Curl | DB | brachialis, forearms | biceps | kg/quả, 2×1 | CU |
| 22 | `barbell_curl` | Cuốn thanh đòn | Barbell Curl | BB | biceps | brachialis, forearms | tổng kg, 1×1 | CU |

### Tay sau / Triceps (3)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 23 | `overhead_cable_triceps_extension` | Duỗi tay sau qua đầu với cáp (thanh thẳng) | Overhead Cable Triceps Extension | CB (thanh thẳng) | triceps | — | kg máy, 1×1 | ET-TRICEPS: **S** bản thanh thẳng (chờ đối chiếu); RS-MAEO22 |
| 24 | `cable_triceps_pushdown` | Đè cáp tay sau | Cable Triceps Pushdown | CB (thanh) | triceps | — | kg máy, 1×1 | ET-TRICEPS: **A** theo BarBend (chờ đối chiếu; BoxRox mô tả khác) |
| 25 | `ez_bar_skull_crusher` | Skull crusher thanh EZ | EZ-Bar Skull Crusher | BB (EZ) + ghế | triceps | — | tổng kg, 1×1 | CU — nguồn bất đồng (BoxRox: S; BarBend: không xác nhận) → không gắn tier |

### Đùi trước & mông / Quads & Glutes (5)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 26 | `barbell_back_squat` | Squat thanh đòn sau lưng | Barbell Back Squat | BB + rack | quads, glutes | adductors, lower_back | tổng kg, 1×1 | RS-KUBO19, RS-PLOT23; ET-QUAD: mô tả đáp ứng cả 3 tiêu chí, tier chữ chưa xác nhận |
| 27 | `hack_squat` | Hack squat máy | Hack Squat | MC | quads | glutes, adductors | kg thêm trên máy, 1×1 | ET-QUAD: **S** (chờ đối chiếu) |
| 28 | `leg_press` | Đạp đùi máy | Leg Press | MC | quads | glutes, adductors | kg thêm trên máy, 1×1 | CU |
| 29 | `bulgarian_split_squat` | Bulgarian split squat với tạ đơn | Dumbbell Bulgarian Split Squat | DB + ghế | quads, glutes | adductors | kg/quả, 2×2 | ET-QUAD: **S** (chờ đối chiếu) |
| 30 | `leg_extension` | Đá đùi máy | Leg Extension | MC | quads | — | kg máy, 1×1 | RS-PEDR22 |

### Đùi sau & mông / Hamstrings & Glutes (4)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 31 | `barbell_romanian_deadlift` | Romanian deadlift thanh đòn | Barbell Romanian Deadlift | BB | hamstrings, glutes | lower_back, adductors, forearms | tổng kg, 1×1 | CU (ET-GLUTE xếp thấp trong danh sách glute; vai trò chính ở đây là hamstrings) |
| 32 | `seated_leg_curl` | Cuốn đùi sau ngồi | Seated Leg Curl | MC | hamstrings | — | kg máy, 1×1 | RS-MAEO21 |
| 33 | `barbell_hip_thrust` | Hip thrust thanh đòn | Barbell Hip Thrust | BB + ghế | glutes | hamstrings | tổng kg, 1×1 | ET-GLUTE: đứng đầu danh sách (không có nhãn chữ); RS-PLOT23 |
| 34 | `machine_hip_abduction` | Dang hông máy | Machine Hip Abduction | MC | glute_med | glutes | kg máy, 1×1 | CU |

### Bắp chân / Calves (2)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 35 | `standing_calf_raise` | Nhón bắp chân đứng (máy) | Standing Calf Raise (Machine) | MC | gastrocnemius | soleus | kg máy, 1×1 | RS-KASS23 (nghiên cứu dùng leg press; áp dụng nguyên tắc lengthened) |
| 36 | `seated_calf_raise` | Nhón bắp chân ngồi (máy) | Seated Calf Raise | MC | soleus | gastrocnemius | kg máy, 1×1 | CU (nhắm soleus khi gối gập) |

### Bụng / Core (2)
| # | ID | Tiếng Việt | English | TB | Cơ chính | Cơ phụ | load | Nguồn |
|---|---|---|---|---|---|---|---|---|
| 37 | `cable_crunch` | Gập bụng với cáp (quỳ) | Kneeling Cable Crunch | CB (dây thừng) | abs | obliques | kg máy, 1×1 | CU |
| 38 | `hanging_leg_raise` | Treo xà nâng chân | Hanging Leg Raise | BW (xà) | abs | obliques | tải thêm | CU |

### Cardio (2) — không thuộc tier hypertrophy, phục vụ tracking
| # | ID | Tiếng Việt | English | TB | Trường ghi | Nguồn |
|---|---|---|---|---|---|---|
| 39 | `treadmill_walk_run` | Đi bộ/chạy máy (có độ dốc) | Treadmill Walk/Run (Incline) | CA | duration (bắt buộc), distance_km, speed_kmh, incline_pct (tùy chọn) | Không áp dụng tier |
| 40 | `stationary_bike` | Đạp xe tại chỗ | Stationary Bike | CA | duration (bắt buộc), distance_km, speed_kmh (tùy chọn); không có incline | Không áp dụng tier |

## 4. Taxonomy cơ (dùng cho highlight 3D và thống kê)

| Muscle ID | VI | EN | Nhóm dashboard |
|---|---|---|---|
| chest | Ngực | Chest | Ngực |
| front_delts | Vai trước | Front delts | Vai |
| side_delts | Vai giữa | Side delts | Vai |
| rear_delts | Vai sau | Rear delts | Vai |
| upper_traps | Cầu vai trên | Upper traps | Lưng |
| upper_back | Lưng giữa (cầu vai giữa/dưới, cơ trám) | Upper back (mid/lower traps, rhomboids) | Lưng |
| lats | Cơ xô | Lats | Lưng |
| lower_back | Lưng dưới (cơ dựng sống) | Lower back (erectors) | Lưng |
| biceps | Cơ nhị đầu | Biceps | Tay |
| brachialis | Cơ cánh tay | Brachialis | Tay |
| triceps | Cơ tam đầu | Triceps | Tay |
| forearms | Cẳng tay | Forearms | Tay |
| abs | Cơ bụng thẳng | Abs (rectus abdominis) | Bụng |
| obliques | Cơ liên sườn | Obliques | Bụng |
| glutes | Cơ mông lớn | Glutes (gluteus maximus) | Mông |
| glute_med | Cơ mông nhỡ | Glute medius | Mông |
| quads | Đùi trước | Quadriceps | Chân |
| hamstrings | Đùi sau | Hamstrings | Chân |
| adductors | Cơ khép đùi | Adductors | Chân |
| gastrocnemius | Bắp chân (cơ bụng chân) | Gastrocnemius | Bắp chân |
| soleus | Cơ dép | Soleus | Bắp chân |

Gán cơ chính/phụ trên là mô tả **nhóm cơ nhắm tới**, không phải mức activation đo được.

## 5. Kết quả CỔNG DUYỆT 1
Danh sách: OK. Tier: không hiển thị trong app. Prototype: 4 bài như đề xuất.

### Câu hỏi đã trình (lưu vết)
1. Duyệt danh sách 40 bài (thêm/bớt/đổi)?
2. Nhãn tier: hiển thị trong app kèm cảnh báo "chờ đối chiếu", hay chỉ hiển thị "Được tuyển chọn cho hypertrophy" cho đến khi đối chiếu được nguồn gốc?
3. Bài cho prototype CỔNG DUYỆT 2 (đề xuất): đứng — `dumbbell_lateral_raise`; nằm ghế — `barbell_bench_press`; cable — `seated_cable_row`; máy — `leg_extension`.
