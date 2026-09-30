/**
 * @OnlyCurrentDoc
 */

// ============================================================================
// DATABASE SERVICE CHO GOOGLE SHEETS
// Thao tác CRUD trên 3 tabs: Staff, Emails, Channels
// Tự động khởi tạo tab và header nếu chưa có, hỗ trợ alias tên cột
// ============================================================================

const TAB_STAFF = 'Staff';
const TAB_EMAILS = 'Emails';
const TAB_CHANNELS = 'Channels';

const DEFAULT_HEADERS: Record<string, string[]> = {
  [TAB_STAFF]: ['staff_id', 'full_name', 'department', 'phone', 'status', 'notes'],
  [TAB_EMAILS]: ['email_id', 'email_address', 'password_enc', 'recovery_email', 'recovery_phone', 'two_factor_enc', 'assigned_staff_id', 'status', 'notes', 'updated_at'],
  [TAB_CHANNELS]: ['channel_id', 'email_id', 'platform', 'channel_name', 'channel_url', 'login_username', 'password_enc', 'assigned_staff_id', 'status', 'notes', 'updated_at']
};

/**
 * Lấy đối tượng Spreadsheet:
 * Ưu tiên bảng tính hiện tại (Container-bound) để không yêu cầu quyền Drive rộng
 */
function getDbSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    // Ignore and fallback
  }

  const config = getSystemConfig();
  if (config.spreadsheetId) {
    return (SpreadsheetApp as any)['openById'](config.spreadsheetId);
  }
  throw new Error('Chưa kết nối được với bảng tính Google Sheets.');
}

/**
 * Lấy Sheet theo tên tab, tự động tạo nếu chưa tồn tại
 */
function getOrCreateSheet(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, tabName: string): GoogleAppsScript.Spreadsheet.Sheet {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    const headers = DEFAULT_HEADERS[tabName] || [];
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.setFrozenRows(1);
    }
  } else if (sheet.getLastRow() === 0) {
    // Tab rỗng hoàn toàn, thêm headers
    const headers = DEFAULT_HEADERS[tabName] || [];
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2E8F0');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Lấy map index cột từ dòng header (hỗ trợ alias)
 */
function getHeaderMap(sheet: GoogleAppsScript.Spreadsheet.Sheet): Record<string, number> {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map: Record<string, number> = {};

  headerValues.forEach((val: any, idx: number) => {
    if (val !== undefined && val !== null) {
      const colName = String(val).trim().toLowerCase();
      map[colName] = idx + 1; // 1-based index
    }
  });

  return map;
}

/**
 * Tìm cột phù hợp dựa theo danh sách alias
 */
function findColIndex(headerMap: Record<string, number>, aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (headerMap[key] !== undefined) {
      return headerMap[key];
    }
  }
  return undefined;
}

/**
 * Tạo mã ID tự tăng (ST001, EM001, CH001)
 */
function generateNextId(existingIds: string[], prefix: string): string {
  let maxNum = 0;
  const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (const id of existingIds) {
    const match = String(id).match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

// ----------------------------------------------------------------------------
// THAO TÁC VỚI BẢNG STAFF
// ----------------------------------------------------------------------------

function getStaffList(): Staff[] {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_STAFF);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headerMap = getHeaderMap(sheet);

  const colId = findColIndex(headerMap, ['staff_id', 'id']) || 1;
  const colName = findColIndex(headerMap, ['full_name', 'name']) || 2;
  const colDept = findColIndex(headerMap, ['department', 'dept']) || 3;
  const colPhone = findColIndex(headerMap, ['phone', 'contact_info', 'contact']) || 4;
  const colStatus = findColIndex(headerMap, ['status']) || 5;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 6;

  const staffList: Staff[] = [];
  for (const row of values) {
    const staffId = String(row[colId - 1] || '').trim();
    if (!staffId) continue;

    staffList.push({
      staff_id: staffId,
      full_name: String(row[colName - 1] || '').trim(),
      department: String(row[colDept - 1] || '').trim(),
      phone: String(row[colPhone - 1] || '').trim(),
      status: String(row[colStatus - 1] || 'ACTIVE').trim(),
      notes: String(row[colNotes - 1] || '').trim()
    });
  }

  return staffList;
}

function saveStaffRecord(data: Partial<Staff>): Staff {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_STAFF);
  const headerMap = getHeaderMap(sheet);
  const staffList = getStaffList();

  const colId = findColIndex(headerMap, ['staff_id', 'id']) || 1;
  const colName = findColIndex(headerMap, ['full_name', 'name']) || 2;
  const colDept = findColIndex(headerMap, ['department', 'dept']) || 3;
  const colPhone = findColIndex(headerMap, ['phone', 'contact_info', 'contact']) || 4;
  const colStatus = findColIndex(headerMap, ['status']) || 5;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 6;

  let staffId = (data.staff_id || '').trim();
  let rowIndex = -1;

  if (staffId) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === staffId) {
          rowIndex = i + 2;
          break;
        }
      }
    }
  } else {
    staffId = generateNextId(staffList.map(s => s.staff_id), 'ST');
  }

  const result: Staff = {
    staff_id: staffId,
    full_name: data.full_name || '',
    department: data.department || '',
    phone: data.phone || '',
    status: data.status || 'ACTIVE',
    notes: data.notes || ''
  };

  if (rowIndex > 0) {
    // Update
    sheet.getRange(rowIndex, colName).setValue(result.full_name);
    sheet.getRange(rowIndex, colDept).setValue(result.department);
    sheet.getRange(rowIndex, colPhone).setValue(result.phone);
    sheet.getRange(rowIndex, colStatus).setValue(result.status);
    sheet.getRange(rowIndex, colNotes).setValue(result.notes || '');
  } else {
    // Insert new row
    const newRow: any[] = new Array(sheet.getLastColumn()).fill('');
    newRow[colId - 1] = result.staff_id;
    newRow[colName - 1] = result.full_name;
    newRow[colDept - 1] = result.department;
    newRow[colPhone - 1] = result.phone;
    newRow[colStatus - 1] = result.status;
    newRow[colNotes - 1] = result.notes || '';
    sheet.appendRow(newRow);
  }

  return result;
}

// ----------------------------------------------------------------------------
// THAO TÁC VỚI BẢNG EMAILS
// ----------------------------------------------------------------------------

function getEmailAccounts(): EmailAccount[] {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_EMAILS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headerMap = getHeaderMap(sheet);

  const colId = findColIndex(headerMap, ['email_id', 'id']) || 1;
  const colAddress = findColIndex(headerMap, ['email_address', 'email', 'parent_email']) || 2;
  const colPass = findColIndex(headerMap, ['password_enc', 'password']) || 3;
  const colRecEmail = findColIndex(headerMap, ['recovery_email', 'rec_email']) || 4;
  const colRecPhone = findColIndex(headerMap, ['recovery_phone', 'rec_phone']) || 5;
  const colTwoFa = findColIndex(headerMap, ['two_factor_enc', 'two_fa_backup', '2fa', 'two_factor']) || 6;
  const colStaff = findColIndex(headerMap, ['assigned_staff_id', 'managed_by', 'staff_id', 'assigned_to']) || 7;
  const colStatus = findColIndex(headerMap, ['status']) || 8;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 9;
  const colUpdated = findColIndex(headerMap, ['updated_at', 'updated']) || 10;

  const emails: EmailAccount[] = [];
  for (const row of values) {
    const emailId = String(row[colId - 1] || '').trim();
    const emailAddress = String(row[colAddress - 1] || '').trim();
    if (!emailId && !emailAddress) continue;

    const encPass = String(row[colPass - 1] || '');
    const enc2Fa = String(row[colTwoFa - 1] || '');

    emails.push({
      email_id: emailId,
      email_address: emailAddress,
      password_enc: encPass,
      password_plain: decrypt(encPass),
      recovery_email: String(row[colRecEmail - 1] || '').trim(),
      recovery_phone: String(row[colRecPhone - 1] || '').trim(),
      two_factor_enc: enc2Fa,
      two_factor_plain: decrypt(enc2Fa),
      assigned_staff_id: String(row[colStaff - 1] || '').trim(),
      status: String(row[colStatus - 1] || 'ACTIVE').trim(),
      notes: String(row[colNotes - 1] || '').trim(),
      updated_at: String(row[colUpdated - 1] || '')
    });
  }

  return emails;
}

function saveEmailRecord(data: Partial<EmailAccount>): EmailAccount {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_EMAILS);
  const headerMap = getHeaderMap(sheet);
  const existingEmails = getEmailAccounts();

  const colId = findColIndex(headerMap, ['email_id', 'id']) || 1;
  const colAddress = findColIndex(headerMap, ['email_address', 'email']) || 2;
  const colPass = findColIndex(headerMap, ['password_enc', 'password']) || 3;
  const colRecEmail = findColIndex(headerMap, ['recovery_email', 'rec_email']) || 4;
  const colRecPhone = findColIndex(headerMap, ['recovery_phone', 'rec_phone']) || 5;
  const colTwoFa = findColIndex(headerMap, ['two_factor_enc', 'two_fa_backup', '2fa', 'two_factor']) || 6;
  const colStaff = findColIndex(headerMap, ['assigned_staff_id', 'managed_by', 'staff_id', 'assigned_to']) || 7;
  const colStatus = findColIndex(headerMap, ['status']) || 8;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 9;
  const colUpdated = findColIndex(headerMap, ['updated_at', 'updated']) || 10;

  let emailId = (data.email_id || '').trim();
  let rowIndex = -1;

  if (emailId) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === emailId) {
          rowIndex = i + 2;
          break;
        }
      }
    }
  } else {
    emailId = generateNextId(existingEmails.map(e => e.email_id), 'EM');
  }

  // Mật khẩu & 2FA: Nếu truyền dạng plain thì mã hóa, nếu đã là enc thì giữ nguyên
  let passEnc = data.password_enc || '';
  if (data.password_plain !== undefined) {
    passEnc = encrypt(data.password_plain);
  }
  let twoFaEnc = data.two_factor_enc || '';
  if (data.two_factor_plain !== undefined) {
    twoFaEnc = encrypt(data.two_factor_plain);
  }

  const nowIso = new Date().toISOString();
  const result: EmailAccount = {
    email_id: emailId,
    email_address: (data.email_address || '').trim(),
    password_enc: passEnc,
    password_plain: decrypt(passEnc),
    recovery_email: (data.recovery_email || '').trim(),
    recovery_phone: (data.recovery_phone || '').trim(),
    two_factor_enc: twoFaEnc,
    two_factor_plain: decrypt(twoFaEnc),
    assigned_staff_id: (data.assigned_staff_id || '').trim(),
    status: data.status || 'ACTIVE',
    notes: data.notes || '',
    updated_at: nowIso
  };

  if (rowIndex > 0) {
    // Update row
    sheet.getRange(rowIndex, colAddress).setValue(result.email_address);
    sheet.getRange(rowIndex, colPass).setValue(result.password_enc);
    sheet.getRange(rowIndex, colRecEmail).setValue(result.recovery_email);
    sheet.getRange(rowIndex, colRecPhone).setValue(result.recovery_phone);
    sheet.getRange(rowIndex, colTwoFa).setValue(result.two_factor_enc);
    sheet.getRange(rowIndex, colStaff).setValue(result.assigned_staff_id);
    sheet.getRange(rowIndex, colStatus).setValue(result.status);
    sheet.getRange(rowIndex, colNotes).setValue(result.notes || '');
    if (colUpdated) sheet.getRange(rowIndex, colUpdated).setValue(result.updated_at);
  } else {
    // Insert new row
    const newRow: any[] = new Array(sheet.getLastColumn()).fill('');
    newRow[colId - 1] = result.email_id;
    newRow[colAddress - 1] = result.email_address;
    newRow[colPass - 1] = result.password_enc;
    newRow[colRecEmail - 1] = result.recovery_email;
    newRow[colRecPhone - 1] = result.recovery_phone;
    newRow[colTwoFa - 1] = result.two_factor_enc;
    newRow[colStaff - 1] = result.assigned_staff_id;
    newRow[colStatus - 1] = result.status;
    newRow[colNotes - 1] = result.notes || '';
    if (colUpdated) newRow[colUpdated - 1] = result.updated_at;
    sheet.appendRow(newRow);
  }

  return result;
}

// ----------------------------------------------------------------------------
// THAO TÁC VỚI BẢNG CHANNELS
// ----------------------------------------------------------------------------

function getChannels(): SocialChannel[] {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_CHANNELS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headerMap = getHeaderMap(sheet);

  const colId = findColIndex(headerMap, ['channel_id', 'id']) || 1;
  const colEmailId = findColIndex(headerMap, ['email_id', 'parent_email', 'email']) || 2;
  const colPlatform = findColIndex(headerMap, ['platform']) || 3;
  const colName = findColIndex(headerMap, ['channel_name', 'name']) || 4;
  const colUrl = findColIndex(headerMap, ['channel_url', 'url', 'link']) || 5;
  const colUsername = findColIndex(headerMap, ['login_username', 'username', 'login_id']) || 6;
  const colPass = findColIndex(headerMap, ['password_enc', 'password']) || 7;
  const colStaff = findColIndex(headerMap, ['assigned_staff_id', 'assigned_to', 'staff_id', 'managed_by']) || 8;
  const colStatus = findColIndex(headerMap, ['status']) || 9;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 10;
  const colUpdated = findColIndex(headerMap, ['updated_at', 'updated']) || 11;

  const channels: SocialChannel[] = [];
  for (const row of values) {
    const channelId = String(row[colId - 1] || '').trim();
    if (!channelId) continue;

    const encPass = String(row[colPass - 1] || '');

    channels.push({
      channel_id: channelId,
      email_id: String(row[colEmailId - 1] || '').trim(),
      platform: String(row[colPlatform - 1] || 'Other').trim(),
      channel_name: String(row[colName - 1] || '').trim(),
      channel_url: String(row[colUrl - 1] || '').trim(),
      login_username: String(row[colUsername - 1] || '').trim(),
      password_enc: encPass,
      password_plain: decrypt(encPass),
      assigned_staff_id: String(row[colStaff - 1] || '').trim(),
      status: String(row[colStatus - 1] || 'ACTIVE').trim(),
      notes: String(row[colNotes - 1] || '').trim(),
      updated_at: String(row[colUpdated - 1] || '')
    });
  }

  return channels;
}

function saveChannelRecord(data: Partial<SocialChannel>): SocialChannel {
  const ss = getDbSpreadsheet();
  const sheet = getOrCreateSheet(ss, TAB_CHANNELS);
  const headerMap = getHeaderMap(sheet);
  const existingChannels = getChannels();

  const colId = findColIndex(headerMap, ['channel_id', 'id']) || 1;
  const colEmailId = findColIndex(headerMap, ['email_id', 'parent_email', 'email']) || 2;
  const colPlatform = findColIndex(headerMap, ['platform']) || 3;
  const colName = findColIndex(headerMap, ['channel_name', 'name']) || 4;
  const colUrl = findColIndex(headerMap, ['channel_url', 'url', 'link']) || 5;
  const colUsername = findColIndex(headerMap, ['login_username', 'username', 'login_id']) || 6;
  const colPass = findColIndex(headerMap, ['password_enc', 'password']) || 7;
  const colStaff = findColIndex(headerMap, ['assigned_staff_id', 'assigned_to', 'staff_id', 'managed_by']) || 8;
  const colStatus = findColIndex(headerMap, ['status']) || 9;
  const colNotes = findColIndex(headerMap, ['notes', 'note']) || 10;
  const colUpdated = findColIndex(headerMap, ['updated_at', 'updated']) || 11;

  let channelId = (data.channel_id || '').trim();
  let rowIndex = -1;

  if (channelId) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === channelId) {
          rowIndex = i + 2;
          break;
        }
      }
    }
  } else {
    channelId = generateNextId(existingChannels.map(c => c.channel_id), 'CH');
  }

  let passEnc = data.password_enc || '';
  if (data.password_plain !== undefined) {
    passEnc = encrypt(data.password_plain);
  }

  const nowIso = new Date().toISOString();
  const result: SocialChannel = {
    channel_id: channelId,
    email_id: (data.email_id || '').trim(),
    platform: (data.platform || 'Other').trim(),
    channel_name: (data.channel_name || '').trim(),
    channel_url: (data.channel_url || '').trim(),
    login_username: (data.login_username || '').trim(),
    password_enc: passEnc,
    password_plain: decrypt(passEnc),
    assigned_staff_id: (data.assigned_staff_id || '').trim(),
    status: data.status || 'ACTIVE',
    notes: data.notes || '',
    updated_at: nowIso
  };

  if (rowIndex > 0) {
    // Update row
    sheet.getRange(rowIndex, colEmailId).setValue(result.email_id);
    sheet.getRange(rowIndex, colPlatform).setValue(result.platform);
    sheet.getRange(rowIndex, colName).setValue(result.channel_name);
    sheet.getRange(rowIndex, colUrl).setValue(result.channel_url);
    sheet.getRange(rowIndex, colUsername).setValue(result.login_username);
    sheet.getRange(rowIndex, colPass).setValue(result.password_enc);
    sheet.getRange(rowIndex, colStaff).setValue(result.assigned_staff_id);
    sheet.getRange(rowIndex, colStatus).setValue(result.status);
    sheet.getRange(rowIndex, colNotes).setValue(result.notes || '');
    if (colUpdated) sheet.getRange(rowIndex, colUpdated).setValue(result.updated_at);
  } else {
    // Insert new row
    const newRow: any[] = new Array(sheet.getLastColumn()).fill('');
    newRow[colId - 1] = result.channel_id;
    newRow[colEmailId - 1] = result.email_id;
    newRow[colPlatform - 1] = result.platform;
    newRow[colName - 1] = result.channel_name;
    newRow[colUrl - 1] = result.channel_url;
    newRow[colUsername - 1] = result.login_username;
    newRow[colPass - 1] = result.password_enc;
    newRow[colStaff - 1] = result.assigned_staff_id;
    newRow[colStatus - 1] = result.status;
    newRow[colNotes - 1] = result.notes || '';
    if (colUpdated) newRow[colUpdated - 1] = result.updated_at;
    sheet.appendRow(newRow);
  }

  return result;
}

// ----------------------------------------------------------------------------
// XÓA BẢN GHI (DELETE ITEM)
// ----------------------------------------------------------------------------

function deleteRecord(type: 'email' | 'channel' | 'staff', id: string): boolean {
  if (!id) return false;
  const ss = getDbSpreadsheet();
  let tabName = '';
  let idAliases: string[] = [];

  if (type === 'email') {
    tabName = TAB_EMAILS;
    idAliases = ['email_id', 'id'];
  } else if (type === 'channel') {
    tabName = TAB_CHANNELS;
    idAliases = ['channel_id', 'id'];
  } else if (type === 'staff') {
    tabName = TAB_STAFF;
    idAliases = ['staff_id', 'id'];
  } else {
    throw new Error('Loại bản ghi không hợp lệ: ' + type);
  }

  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const headerMap = getHeaderMap(sheet);
  const colId = findColIndex(headerMap, idAliases) || 1;

  const ids = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id.trim()) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }

  return false;
}
