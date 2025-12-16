export interface TelegramBotSettings {
  chatId: string | null;
  isVerified: boolean;
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
  notifyOnProgress50?: boolean;
  notifyOnProgress75?: boolean;
  notifyOnProgress90?: boolean;
  notifyOnProfileIssue?: boolean;
  notifyOnLoginRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SetupTelegramBotResponse {
  message: string;
  verifyCode?: string;
  expiresIn?: number;
}

export interface VerifyTelegramBotResponse {
  message: string;
}

export interface TestTelegramBotResponse {
  message: string;
}

export interface UpdateTelegramNotificationsInput {
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
  notifyOnProgress50?: boolean;
  notifyOnProgress75?: boolean;
  notifyOnProgress90?: boolean;
  notifyOnProfileIssue?: boolean;
  notifyOnLoginRequired?: boolean;
}




