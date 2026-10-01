// ============================================================================
// CONFIGURATION MANAGER CHO SMM ACCOUNT & MEDIA MANAGER
// Bảo mật: Đọc từ Google Apps Script ScriptProperties, không hardcode secret.
// ============================================================================

const SCRIPT_PROP_SPREADSHEET_ID = 'SPREADSHEET_ID';
const SCRIPT_PROP_MASTER_PASSWORD = 'APP_MASTER_PASSWORD';
const SCRIPT_PROP_ENCRYPTION_KEY = 'ENCRYPTION_SECRET_KEY';

/**
 * Lấy cấu hình hệ thống từ Script Properties
 */
function getSystemConfig(): SystemConfig {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(SCRIPT_PROP_SPREADSHEET_ID) || '';
  const masterPassword = props.getProperty(SCRIPT_PROP_MASTER_PASSWORD) || '';
  const encryptionKey = props.getProperty(SCRIPT_PROP_ENCRYPTION_KEY) || '';

  const isConfigured = Boolean(spreadsheetId && masterPassword);

  return {
    spreadsheetId,
    masterPassword,
    encryptionKey,
    isConfigured
  };
}

/**
 * Lưu cấu hình hệ thống vào Script Properties
 */
function saveSystemConfig(config: Partial<{
  spreadsheetId: string;
  masterPassword: string;
  encryptionKey: string;
}>): void {
  const props = PropertiesService.getScriptProperties();
  const current = getSystemConfig();

  if (config.spreadsheetId !== undefined) {
    props.setProperty(SCRIPT_PROP_SPREADSHEET_ID, config.spreadsheetId.trim());
  }
  if (config.masterPassword !== undefined) {
    props.setProperty(SCRIPT_PROP_MASTER_PASSWORD, config.masterPassword.trim());
  }
  if (config.encryptionKey !== undefined) {
    props.setProperty(SCRIPT_PROP_ENCRYPTION_KEY, config.encryptionKey.trim());
  }
}
