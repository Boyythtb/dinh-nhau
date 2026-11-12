# Dính Nhau

> Game co-op 2 người trên cùng một bàn phím. Hai đứa bị buộc vào nhau bằng một sợi dây vô hình — rời xa quá là không xong đâu.

Một món quà nhỏ, vô tri, để chơi cùng người yêu trong 15–20 phút. Không cần mạng, không cần cài đặt, không có quảng cáo.

---

## Chơi thế nào

1. Mở file **`index.html`** bằng Chrome / Edge / Firefox (double-click là được).
2. Nhập tên hai người rồi bấm **Bắt đầu dính nhau**.
3. Ngồi cạnh nhau, mỗi người một nửa bàn phím.

| | Đi | Nhảy | Neo |
|---|---|---|---|
| **Người 1** (hồng) | `A` `D` | `W` (giữ để nhảy cao) | `S` |
| **Người 2** (xanh) | `←` `→` | `↑` (giữ để nhảy cao) | `↓` |

- **Neo** = đứng yên làm điểm tựa, không bị sợi dây kéo đi.
- Đứng lên **đầu** người kia rồi giữ nhảy để được bật lên thật cao.
- Hai đứa phải ở gần nhau. Dây căng quá sẽ kéo cả hai lại (và kêu ca).

Phím phụ: `Esc` / `P` tạm dừng, `M` tắt/bật tiếng, `Enter` để đi tiếp ở màn kết quả.

---

## Có gì trong game

- **5 màn**, mỗi màn một kiểu phối hợp khác nhau:
  1. **Làm quen** — hai người đứng lên hai cái nút cùng lúc để mở cổng.
  2. **Cõng nhau** — một đứa làm bệ, đứa kia đứng lên đầu và nhảy vào nút trên cao.
  3. **Bế em** — cùng bế một trái tim biết đi qua màn. Cả hai phải ở gần thì tim mới chịu đi.
  4. **Bập bênh** — một đứa đứng một đầu, đứa kia nhảy thiệt mạnh lên đầu còn lại để bật người kia lên bục.
  5. **Về nhà** — tổng hợp tất cả: bấm nút, bế tim, vượt bẫy, về tới nhà.
- **15 ngôi sao** ẩn trên đường đi. Nhặt đủ sẽ có danh hiệu đẹp hơn ở màn kết thúc.
- Thống kê cuối game: thời gian, số lần ngã, số lần dây căng, số sao.
- Tên hai người được lưu lại trên máy cho lần chơi sau.
- Kết thúc có pháo giấy và một câu nhắn nhủ.

### Mẹo nhỏ

- Muốn nhảy lên đầu người kia: nhảy gần như thẳng đứng, rồi bấm nhẹ sang hướng người đó.
- Ở màn 2 và màn 5, phải **giữ** nút nhảy thật lâu mới tới được nút trên cao.
- Màn bập bênh: đứa bên phải đứng yên, đứa bên trái nhảy thật mạnh lên đầu còn lại. Đứa bên phải sẽ bay lên bục — cứ để nó bay, đừng giữ nút nhảy.
- Đi chậm thôi. Game không có tính giờ để thắng — cứ cãi nhau thoải mái.

---

## Cấu trúc

```
index.html   giao diện, các màn hình
style.css    giao diện, màu sắc, responsive
game.js      toàn bộ game: physics, dây, màn chơi, vẽ, âm thanh
README.md    file này
```

Không dùng thư viện, không cần build. Font Google (Baloo 2 + Nunito) chỉ để đẹp hơn; nếu offline game vẫn chạy với font hệ thống.

### Muốn sửa?

- Đổi tên mặc định: sửa `value="Bông"` và `value="Bắp"` trong `index.html`, hoặc cứ nhập tên mới trong game.
- Thêm/sửa màn: mảng `LEVELS` trong `game.js` (bản đồ dạng ký tự, `#` là đất, `^` là bẫy).
- Đổi màu trời/núi: object `THEMES` trong `game.js`.

### Nếu mở file trực tiếp mà tên không được lưu

Một số trình duyệt chặn `localStorage` với `file://`. Chạy một server tĩnh nhỏ:

```bash
python -m http.server 5173
```

rồi mở `http://localhost:5173`.

---

## Ghi chú

- Game chỉ chơi **local 2 người**, không có chế độ online. Cần bàn phím.
- Không có tài khoản, không thu thập gì cả. Mọi thứ chạy trong trình duyệt.
- Chơi xong nhớ ôm nhau một cái.

Made with ♥ for two.
