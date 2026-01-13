-- CreateTable
CREATE TABLE "template_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "template_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "messengerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "template_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "template_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "fileMimeType" TEXT,
    "delayAfterMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT NOT NULL,
    "clientGroupId" TEXT NOT NULL,
    "campaignType" TEXT NOT NULL,
    "messengerType" TEXT NOT NULL,
    "universalTarget" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "processedContacts" INTEGER NOT NULL DEFAULT 0,
    "successfulContacts" INTEGER NOT NULL DEFAULT 0,
    "failedContacts" INTEGER NOT NULL DEFAULT 0,
    "skippedContacts" INTEGER NOT NULL DEFAULT 0,
    "scheduleConfig" TEXT,
    "filterConfig" TEXT,
    "optionsConfig" TEXT,
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "pausedAt" DATETIME,
    "completedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaigns_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaign_profiles_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientPhoneId" TEXT NOT NULL,
    "profileId" TEXT,
    "messenger" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_messages_clientPhoneId_fkey" FOREIGN KEY ("clientPhoneId") REFERENCES "client_phones" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_messages_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_global_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pauseMode" INTEGER NOT NULL DEFAULT 2,
    "minDelayBetweenContactsMs" INTEGER NOT NULL DEFAULT 30000,
    "maxDelayBetweenContactsMs" INTEGER NOT NULL DEFAULT 120000,
    "minDelayBetweenMessagesMs" INTEGER NOT NULL DEFAULT 3000,
    "maxDelayBetweenMessagesMs" INTEGER NOT NULL DEFAULT 10000,
    "maxContactsPerProfilePerHour" INTEGER NOT NULL DEFAULT 100,
    "maxContactsPerProfilePerDay" INTEGER NOT NULL DEFAULT 500,
    "defaultWorkHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "defaultWorkHoursEnd" TEXT NOT NULL DEFAULT '21:00',
    "defaultWorkDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "typingSimulationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "typingSpeedCharsPerSec" INTEGER NOT NULL DEFAULT 50,
    "maxRetriesOnError" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 30000,
    "pauseOnCriticalError" BOOLEAN NOT NULL DEFAULT true,
    "profileHealthCheckIntervalMs" INTEGER NOT NULL DEFAULT 30000,
    "autoResumeAfterRestart" BOOLEAN NOT NULL DEFAULT false,
    "keepCompletedCampaignsDays" INTEGER NOT NULL DEFAULT 90,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "warmupDay1To3Limit" INTEGER NOT NULL DEFAULT 50,
    "warmupDay4To7Limit" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "user_campaign_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "maxActiveCampaigns" INTEGER NOT NULL DEFAULT 3,
    "maxTemplates" INTEGER NOT NULL DEFAULT 100,
    "maxTemplateCategories" INTEGER NOT NULL DEFAULT 20,
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 50,
    "maxTotalStorageMb" INTEGER NOT NULL DEFAULT 1000,
    "allowScheduledCampaigns" BOOLEAN NOT NULL DEFAULT true,
    "allowUniversalCampaigns" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "user_campaign_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_telegram_bots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "chatId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyCode" TEXT,
    "verifyCodeExpiresAt" DATETIME,
    "notifyOnStart" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnComplete" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnError" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnProgress50" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnProgress75" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnProgress90" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnProfileIssue" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLoginRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_telegram_bots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "regionId" TEXT,
    "groupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCampaignAt" DATETIME,
    "campaignCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clients_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clients_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "client_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_clients" ("createdAt", "firstName", "groupId", "id", "lastName", "middleName", "regionId", "status", "userId") SELECT "createdAt", "firstName", "groupId", "id", "lastName", "middleName", "regionId", "status", "userId" FROM "clients";
DROP TABLE "clients";
ALTER TABLE "new_clients" RENAME TO "clients";
CREATE INDEX "clients_userId_idx" ON "clients"("userId");
CREATE INDEX "clients_regionId_idx" ON "clients"("regionId");
CREATE INDEX "clients_groupId_idx" ON "clients"("groupId");
CREATE INDEX "clients_status_idx" ON "clients"("status");
CREATE INDEX "clients_userId_status_idx" ON "clients"("userId", "status");
CREATE INDEX "clients_userId_groupId_idx" ON "clients"("userId", "groupId");
CREATE INDEX "clients_lastCampaignAt_idx" ON "clients"("lastCampaignAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "template_categories_userId_idx" ON "template_categories"("userId");

-- CreateIndex
CREATE INDEX "template_categories_userId_orderIndex_idx" ON "template_categories"("userId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "template_categories_userId_name_key" ON "template_categories"("userId", "name");

-- CreateIndex
CREATE INDEX "templates_userId_idx" ON "templates"("userId");

-- CreateIndex
CREATE INDEX "templates_categoryId_idx" ON "templates"("categoryId");

-- CreateIndex
CREATE INDEX "templates_userId_categoryId_idx" ON "templates"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "templates_type_idx" ON "templates"("type");

-- CreateIndex
CREATE INDEX "templates_messengerType_idx" ON "templates"("messengerType");

-- CreateIndex
CREATE INDEX "templates_isActive_idx" ON "templates"("isActive");

-- CreateIndex
CREATE INDEX "templates_userId_isActive_idx" ON "templates"("userId", "isActive");

-- CreateIndex
CREATE INDEX "template_items_templateId_idx" ON "template_items"("templateId");

-- CreateIndex
CREATE INDEX "template_items_templateId_orderIndex_idx" ON "template_items"("templateId", "orderIndex");

-- CreateIndex
CREATE INDEX "campaigns_userId_idx" ON "campaigns"("userId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_userId_status_idx" ON "campaigns"("userId", "status");

-- CreateIndex
CREATE INDEX "campaigns_campaignType_idx" ON "campaigns"("campaignType");

-- CreateIndex
CREATE INDEX "campaigns_scheduledAt_idx" ON "campaigns"("scheduledAt");

-- CreateIndex
CREATE INDEX "campaigns_archivedAt_idx" ON "campaigns"("archivedAt");

-- CreateIndex
CREATE INDEX "campaigns_createdAt_idx" ON "campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "campaign_profiles_campaignId_idx" ON "campaign_profiles"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_profiles_profileId_idx" ON "campaign_profiles"("profileId");

-- CreateIndex
CREATE INDEX "campaign_profiles_status_idx" ON "campaign_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_profiles_campaignId_profileId_key" ON "campaign_profiles"("campaignId", "profileId");

-- CreateIndex
CREATE INDEX "campaign_messages_campaignId_idx" ON "campaign_messages"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_messages_campaignId_status_idx" ON "campaign_messages"("campaignId", "status");

-- CreateIndex
CREATE INDEX "campaign_messages_profileId_idx" ON "campaign_messages"("profileId");

-- CreateIndex
CREATE INDEX "campaign_messages_profileId_status_idx" ON "campaign_messages"("profileId", "status");

-- CreateIndex
CREATE INDEX "campaign_messages_clientPhoneId_idx" ON "campaign_messages"("clientPhoneId");

-- CreateIndex
CREATE INDEX "campaign_messages_status_idx" ON "campaign_messages"("status");

-- CreateIndex
CREATE INDEX "campaign_logs_campaignId_idx" ON "campaign_logs"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_logs_campaignId_level_idx" ON "campaign_logs"("campaignId", "level");

-- CreateIndex
CREATE INDEX "campaign_logs_level_idx" ON "campaign_logs"("level");

-- CreateIndex
CREATE INDEX "campaign_logs_createdAt_idx" ON "campaign_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_campaign_limits_userId_key" ON "user_campaign_limits"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_telegram_bots_userId_key" ON "user_telegram_bots"("userId");

-- CreateIndex
CREATE INDEX "client_phones_phone_idx" ON "client_phones"("phone");

-- CreateIndex
CREATE INDEX "client_phones_whatsAppStatus_idx" ON "client_phones"("whatsAppStatus");

-- CreateIndex
CREATE INDEX "client_phones_telegramStatus_idx" ON "client_phones"("telegramStatus");
