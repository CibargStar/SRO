-- CreateTable
CREATE TABLE "messenger_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icon" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "profile_messenger_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" DATETIME,
    "lastStatusChangeAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profile_messenger_accounts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "profile_messenger_accounts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "messenger_services" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messenger_check_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "checkIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "messenger_check_configs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "messenger_services" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "messenger_services_name_key" ON "messenger_services"("name");

-- CreateIndex
CREATE INDEX "messenger_services_name_idx" ON "messenger_services"("name");

-- CreateIndex
CREATE INDEX "messenger_services_enabled_idx" ON "messenger_services"("enabled");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_profileId_idx" ON "profile_messenger_accounts"("profileId");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_serviceId_idx" ON "profile_messenger_accounts"("serviceId");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_status_idx" ON "profile_messenger_accounts"("status");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_isEnabled_idx" ON "profile_messenger_accounts"("isEnabled");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_profileId_isEnabled_idx" ON "profile_messenger_accounts"("profileId", "isEnabled");

-- CreateIndex
CREATE INDEX "profile_messenger_accounts_profileId_serviceId_isEnabled_idx" ON "profile_messenger_accounts"("profileId", "serviceId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "profile_messenger_accounts_profileId_serviceId_key" ON "profile_messenger_accounts"("profileId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "messenger_check_configs_serviceId_key" ON "messenger_check_configs"("serviceId");
