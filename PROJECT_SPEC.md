# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC DỰ ÁN
## HỆ THỐNG QUẢN LÝ TÀI KHOẢN MẠNG XÃ HỘI & TÀI NGUYÊN SỐ (SMM MANAGER)

---

## 1. TỔNG QUAN DỰ ÁN

* **Tên dự án:** Social Media & Digital Asset Management System (SMM Manager).
* **Mục tiêu:** Quản lý tập trung toàn bộ danh sách Email, Kênh mạng xã hội (TikTok, Facebook, YouTube,...), thông tin bảo mật (Mật khẩu, mã 2FA backup) và người phụ trách vận hành.
* **Người dùng hiện tại:** 01 Quản trị viên (Admin) duy nhất thu thập và nhập liệu thủ công.
* **Mở rộng tương lai:** Phân quyền nhân viên tra cứu/bàn giao tài nguyên số mà không lộ mật khẩu gốc.
* **Nguyên tắc cốt lõi:**
  * **Zero Direct Access:** Người dùng thao tác qua Web UI, không tiếp cận trực tiếp file Google Sheets.
  * **Direct Field Storage:** Mật khẩu và mã 2FA được lưu trữ trực tiếp (Plaintext) vào Google Sheets theo yêu cầu quản trị, trên Web UI vẫn hỗ trợ ẩn/hiện và sao chép an toàn.
  * **Public Repo Safe:** Toàn bộ mã nguồn public trên GitHub không được chứa bất kỳ Secret, Key hay ID nhạy cảm nào.

---

## 2. KIẾN TRÚC HỆ THỐNG (3-TIER ARCHITECTURE)

```text
[ Admin / User ]
       │ (HTTPS)
       ▼
[ Tầng 1: Frontend Web UI ]
  └── Single Page Application (HTML5 / Tailwind CSS / Vanilla JS)
       │ (google.script.run / RPC)
       ▼
[ Tầng 2: Backend & Security Engine (GAS) ]
  ├── Routing & Authentication: Session Token / Master Passcode
  ├── Encryption Layer: AES-256 (CryptoJS)
  └── Environment Variables: Script Properties (Sheet ID, Secret Keys)
       │ (SpreadsheetApp API)
       ▼
[ Tầng 3: Database Engine (Google Sheets) ]
  ├── Tab: Staff (Danh mục nhân sự)
  ├── Tab: Emails (Tài nguyên gốc / Parent)
  └── Tab: Channels (Tài nguyên phụ thuộc / Child)
```

---

## 3. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATA SCHEMA)

Hệ thống sử dụng mô hình quan hệ phân cấp **1-Nhiều (Parent - Child)**:
* 1 Nhân sự (`Staff`) có thể quản lý nhiều `Emails` và nhiều `Channels`.
* 1 `Email` là gốc của nhiều `Channels`.

### 3.1. Bảng `Staff` (Danh mục Nhân sự)
| Tên cột | Kiểu dữ liệu | Mô tả | Ghi chú |
| :--- | :--- | :--- | :--- |
| `staff_id` | String | Mã nhân viên (ST001, ST002...) | Khóa chính (PK) |
| `full_name` | String | Họ và tên nhân sự | Bắt buộc |
| `department` | String | Phòng ban / Đội nhóm | Marketing, Media, Ads... |
| `contact_info` | String | SĐT / Telegram / Zalo nội bộ | Liên hệ khi cần OTP |
| `status` | String | `ACTIVE` (Đang làm), `RESIGNED` (Đã nghỉ) | Hỗ trợ lọc thu hồi tài sản |

### 3.2. Bảng `Emails` (Tài nguyên gốc - Root)
| Tên cột | Kiểu dữ liệu | Mô tả | Bảo mật |
| :--- | :--- | :--- | :--- |
| `email_id` | String | Mã định danh email (EM001, EM002...) | PK |
| `email_address`| String | Địa chỉ email chính | Plaintext |
| `password_enc` | String | Mật khẩu hộp thư | Plaintext |
| `recovery_email`| String | Email khôi phục | Plaintext |
| `recovery_phone`| String | Số điện thoại khôi phục | Plaintext |
| `two_fa_backup`| String | Khóa 2FA secret key / 8-digit backup codes | Plaintext |
| `managed_by` | String | `staff_id` người chịu trách nhiệm email | FK -> Staff.staff_id |
| `status` | String | `ACTIVE`, `LOCKED`, `DISABLED` | Trạng thái hộp thư |
| `notes` | String | Ghi chú thiết bị đăng nhập, vị trí sim... | Plaintext |
| `updated_at` | DateTime | Thời gian cập nhật lần cuối | ISO 8601 |

### 3.3. Bảng `Channels` (Tài nguyên mạng xã hội - Branch)
| Tên cột | Kiểu dữ liệu | Mô tả | Bảo mật |
| :--- | :--- | :--- | :--- |
| `channel_id` | String | Mã định danh kênh (CH001, CH002...) | PK |
| `parent_email` | String | Thuộc email gốc nào | FK -> Emails.email_address |
| `platform` | String | TikTok, Facebook Page, YouTube, Instagram...| Plaintext |
| `channel_name` | String | Tên hiển thị của kênh / page | Plaintext |
| `channel_url` | String | Đường link trực tiếp đến kênh | Plaintext |
| `username` | String | ID đăng nhập (nếu khác email) | Plaintext |
| `password_enc` | String | Mật khẩu riêng của kênh (nếu có) | Plaintext |
| `assigned_to` | String | `staff_id` người trực tiếp vận hành kênh | FK -> Staff.staff_id |
| `status` | String | `ACTIVE`, `SUSPENDED`, `APPEALING` | Tình trạng kênh |
| `notes` | String | Ngách nội dung, chính sách gậy bản quyền... | Plaintext |
| `updated_at` | DateTime | Thời gian cập nhật lần cuối | ISO 8601 |

---

## 4. CHIẾN LƯỢC BẢO MẬT & QUẢN LÝ REPO PUBLIC

Vì mã nguồn được đẩy lên kho lưu trữ **GitHub Công khai (Public Repo)**, các quy chuẩn sau đây là bắt buộc:

### 4.1. Nguyên tắc cấu hình môi trường
1. **Không hardcode bí mật:** Không ghi `Spreadsheet ID`, `Master Key`, `Admin Passcode` trong file code `.js`, `.gs`, hoặc `.html`.
2. **Sử dụng Script Properties:** Toàn bộ thông số bảo mật được cấu hình qua giao diện Google Apps Script:
   * `SPREADSHEET_ID`: ID bảng tính Google Sheets lưu trữ database.
   * `ENCRYPTION_KEY`: Chuỗi bí mật dùng để mã hóa/giải mã AES.
   * `ADMIN_PASSCODE_HASH`: Mã băm SHA-256 của mật khẩu đăng nhập Web UI.

### 4.2. Cấu trúc tệp tin `.gitignore`
Các file chứa thông tin máy tính cục bộ và định danh triển khai Apps Script phải bị loại trừ trước khi commit:
```gitignore
.clasp.json
.clasprc.json
node_modules/
.env
*.log
```

---

## 5. QUY TRÌNH PHÁT TRIỂN & DEPLOYMENT (CLASP WORKFLOW)

```text
[ VS Code (Local Machine) ] 
   ├── 1. git add . && git commit -m "update" ────► [ GitHub (Public Repo) ]
   └── 2. clasp push ────────────────────────────► [ Google Apps Script (Cloud) ]
                                                            │
                                                     (Deploy Web App)
                                                            ▼
                                                    [ Production Web UI ]
```

1. **Local Setup:** Sử dụng `@google/clasp` trên máy tính cá nhân để chỉnh sửa mã nguồn với IDE hiện đại.
2. **Version Control:** `git push` lên GitHub để lưu trữ lịch sử mã nguồn (an toàn vì secrets nằm ở Script Properties).
3. **App Deployment:** `clasp push` đẩy mã nguồn trực tiếp lên Google Apps Script container.
4. **Web App Deployment Settings:**
   * **Execute as:** `Me (tài khoản Google của bạn)`.
   * **Who has access:** `Only myself` (hoặc mở rộng có kiểm soát sau này).

---

## 6. LỘ TRÌNH THỰC HIỆN CHI TIẾT (ROADMAP)

* [ ] **Giai đoạn 1: Database Setup**
  * Tạo bảng tính Google Sheets mẫu với 3 tab: `Staff`, `Emails`, `Channels` và định dạng header.
* [ ] **Giai đoạn 2: Local Environment & Clasp Initialization**
  * Khởi tạo dự án, cài đặt `clasp`, kết nối Apps Script và cấu hình `.gitignore`.
* [ ] **Giai đoạn 3: Backend Core Engine**
  * Viết module mã hóa/giải mã AES-256.
  * Viết các hàm CRUD (Create, Read, Update, Delete) cho Email, Channel, Staff.
* [ ] **Giai đoạn 4: Frontend Web UI**
  * Dựng giao diện đăng nhập (Login modal).
  * Dựng Dashboard phân cấp: Tra cứu Email -> Kênh trực thuộc, lọc theo Nhân sự.
  * Form nhập liệu và nút Copy/Hiển thị mật khẩu an toàn.
* [ ] **Giai đoạn 5: Testing & Go-live**
  * Kiểm tra tính toàn vẹn dữ liệu mã hóa, phân quyền và triển khai chính thức.