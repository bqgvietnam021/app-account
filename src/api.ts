/**
 * @OnlyCurrentDoc
 */

// ============================================================================
// API ROUTER & RPC HANDLERS (GOOGLE APPS SCRIPT WEB APP)
// Xử lý doGet và các hàm google.script.run cho Web UI
// ============================================================================

/**
 * Web App entry point: Trả về trang giao diện hoặc phản hồi JSON nếu gọi qua GET
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput {
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;
    let result: any = { success: true, message: 'SMM API is active' };
    if (action === 'checkConfigStatus') {
      result = checkConfigStatus();
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const template = HtmlService.createTemplateFromFile('index');
  const output = template.evaluate();

  output.setTitle('SMM Account & Media Manager');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}

/**
 * REST API entry point: Tiếp nhận yêu cầu HTTP POST từ các domain bên ngoài (GitHub Pages, v.v.)
 */
function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    let payload: { action?: string; args?: any[]; token?: string } = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || '';
    const args = payload.args || [];
    let result: any = { success: false, error: 'Hành động không hợp lệ: ' + action };

    switch (action) {
      case 'login':
        result = login(args[0]);
        break;
      case 'getInitialData':
        result = getInitialData();
        break;
      case 'saveEmail':
        result = saveEmail(args[0]);
        break;
      case 'saveChannel':
        result = saveChannel(args[0]);
        break;
      case 'saveStaff':
        result = saveStaff(args[0]);
        break;
      case 'deleteItem':
        result = deleteItem(args[0], args[1]);
        break;
      case 'saveSystemSetup':
        result = saveSystemSetup(args[0]);
        break;
      case 'checkConfigStatus':
        result = checkConfigStatus();
        break;
      default:
        result = { success: false, error: 'Không hỗ trợ action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err: any) {
    const errorRes = {
      success: false,
      error: 'Lỗi xử lý API: ' + (err.message || String(err))
    };
    return ContentService.createTextOutput(JSON.stringify(errorRes))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Bao gồm file HTML con nếu cần (dùng cho inline styles/scripts nếu chia nhỏ)
 */
function include(filename: string): string {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Kiểm tra trạng thái cấu hình hệ thống
 */
function checkConfigStatus(): ApiResponse<{ isConfigured: boolean; hasSpreadsheet: boolean }> {
  try {
    const config = getSystemConfig();
    return {
      success: true,
      data: {
        isConfigured: config.isConfigured,
        hasSpreadsheet: Boolean(config.spreadsheetId)
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Lỗi khi kiểm tra trạng thái cấu hình'
    };
  }
}

/**
 * Cấu hình hệ thống từ Web UI (nếu chưa cấu hình qua Script Properties)
 */
function saveSystemSetup(params: {
  spreadsheetId: string;
  masterPassword: string;
  encryptionKey?: string;
}): ApiResponse<boolean> {
  try {
    if (!params.spreadsheetId || !params.masterPassword) {
      return {
        success: false,
        error: 'Vui lòng điền đầy đủ: SPREADSHEET_ID và APP_MASTER_PASSWORD!'
      };
    }

    saveSystemConfig({
      spreadsheetId: params.spreadsheetId.trim(),
      masterPassword: params.masterPassword.trim(),
      encryptionKey: (params.encryptionKey || '').trim()
    });

    // Tự động khởi tạo cấu trúc tab nếu cần
    initDatabase();

    return {
      success: true,
      data: true,
      message: 'Cấu hình hệ thống thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi thiết lập hệ thống: ' + (err.message || String(err))
    };
  }
}

/**
 * Xác thực đăng nhập bằng Master Password
 */
function login(password: string): ApiResponse<{ token: string; username: string }> {
  try {
    const config = getSystemConfig();
    if (!config.isConfigured) {
      return {
        success: false,
        error: 'Hệ thống chưa được cấu hình SPREADSHEET_ID hoặc MASTER_PASSWORD.',
        data: undefined
      };
    }

    if (!password || password.trim() !== config.masterPassword) {
      return {
        success: false,
        error: 'Mật khẩu quản trị không chính xác. Vui lòng thử lại!'
      };
    }

    // Tạo token phiên làm việc đơn giản dựa trên HMAC hoặc thời gian
    const token = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(
        'SESSION_' + new Date().toDateString(),
        config.masterPassword
      )
    );

    return {
      success: true,
      data: {
        token: token,
        username: 'Administrator'
      },
      message: 'Đăng nhập thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi xác thực: ' + (err.message || String(err))
    };
  }
}

/**
 * Lấy toàn bộ dữ liệu khởi tạo cho Dashboard: Staff, Emails, Channels
 * Tự động giải mã mật khẩu cho giao diện hiển thị an toàn trên client
 */
function getInitialData(): ApiResponse<InitialDataPayload> {
  try {
    const config = getSystemConfig();
    if (!config.isConfigured) {
      return {
        success: true,
        data: {
          staff: [],
          emails: [],
          channels: [],
          isConfigured: false
        }
      };
    }

    const staff = getStaffList();
    const emails = getEmailAccounts();
    const channels = getChannels();

    return {
      success: true,
      data: {
        staff,
        emails,
        channels,
        isConfigured: true
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi khi tải dữ liệu: ' + (err.message || String(err))
    };
  }
}

/**
 * Thêm mới hoặc cập nhật Email Account (Tự động mã hóa mật khẩu và 2FA)
 */
function saveEmail(emailData: Partial<EmailAccount>): ApiResponse<EmailAccount> {
  try {
    if (!emailData.email_address || !emailData.email_address.trim()) {
      return {
        success: false,
        error: 'Địa chỉ Email không được để trống!'
      };
    }

    const saved = saveEmailRecord(emailData);
    return {
      success: true,
      data: saved,
      message: 'Lưu tài khoản Email thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi khi lưu Email: ' + (err.message || String(err))
    };
  }
}

/**
 * Thêm mới hoặc cập nhật Kênh Mạng Xã Hội (Tự động mã hóa mật khẩu)
 */
function saveChannel(channelData: Partial<SocialChannel>): ApiResponse<SocialChannel> {
  try {
    if (!channelData.channel_name || !channelData.channel_name.trim()) {
      return {
        success: false,
        error: 'Tên kênh không được để trống!'
      };
    }

    const saved = saveChannelRecord(channelData);
    return {
      success: true,
      data: saved,
      message: 'Lưu kênh mạng xã hội thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi khi lưu Kênh: ' + (err.message || String(err))
    };
  }
}

/**
 * Thêm mới hoặc cập nhật Nhân sự (Staff)
 */
function saveStaff(staffData: Partial<Staff>): ApiResponse<Staff> {
  try {
    if (!staffData.full_name || !staffData.full_name.trim()) {
      return {
        success: false,
        error: 'Họ tên nhân viên không được để trống!'
      };
    }

    const saved = saveStaffRecord(staffData);
    return {
      success: true,
      data: saved,
      message: 'Lưu thông tin nhân sự thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi khi lưu Nhân sự: ' + (err.message || String(err))
    };
  }
}

/**
 * Xóa một bản ghi theo loại ('email' | 'channel' | 'staff') và ID
 */
function deleteItem(type: 'email' | 'channel' | 'staff', id: string): ApiResponse<boolean> {
  try {
    if (!type || !id) {
      return {
        success: false,
        error: 'Thiếu thông tin loại bản ghi hoặc ID cần xóa!'
      };
    }

    const ok = deleteRecord(type, id);
    if (!ok) {
      return {
        success: false,
        error: `Không tìm thấy bản ghi ${type} với ID: ${id}`
      };
    }

    return {
      success: true,
      data: true,
      message: 'Đã xóa bản ghi thành công!'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi khi xóa bản ghi: ' + (err.message || String(err))
    };
  }
}
