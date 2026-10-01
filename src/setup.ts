// ============================================================================
// SETUP UTILITIES CHO SMM ACCOUNT & MEDIA MANAGER
// Thiết lập biến môi trường và khởi tạo cơ sở dữ liệu Google Sheets
// ============================================================================

/**
 * Hàm khởi tạo hoặc cập nhật Script Properties thủ công qua Apps Script Editor
 */
function setupInitialProperties(spreadsheetId: string, masterPassword: string, secretKey?: string): void {
  saveSystemConfig({
    spreadsheetId,
    masterPassword,
    encryptionKey: secretKey || ''
  });
  console.log('✅ Đã lưu cấu hình Script Properties thành công!');
}

/**
 * Khởi tạo 3 tab và header tương ứng trên Google Sheets đã cấu hình
 */
function initDatabase(): void {
  const ss = getDbSpreadsheet();
  getOrCreateSheet(ss, TAB_STAFF);
  getOrCreateSheet(ss, TAB_EMAILS);
  getOrCreateSheet(ss, TAB_CHANNELS);
  console.log('✅ Đã khởi tạo hoàn tất cấu trúc 3 tab: Staff, Emails, Channels!');
}

/**
 * Hàm kiểm tra nhanh tính toàn vẹn của module mã hóa AES-256
 */
function testEncryption(): void {
  const testPlain = 'MySecretP@ssw0rd! 2026';
  const testKey = 'MySuperSecureMasterKey1234567890';
  const enc = encrypt(testPlain, testKey);
  const dec = decrypt(enc, testKey);

  console.log('Original :', testPlain);
  console.log('Encrypted:', enc);
  console.log('Decrypted:', dec);

  if (testPlain === dec) {
    console.log('🎉 AES-256 mã hóa và giải mã chính xác 100%!');
  } else {
    console.error('❌ Thử nghiệm mã hóa thất bại!');
  }
}
