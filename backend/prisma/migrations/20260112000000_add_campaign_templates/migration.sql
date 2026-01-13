-- CreateTable: campaign_templates (многие-ко-многим связь между кампаниями и шаблонами)
CREATE TABLE "campaign_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_templates_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_templates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "campaign_templates_campaignId_idx" ON "campaign_templates"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_templates_templateId_idx" ON "campaign_templates"("templateId");

-- CreateIndex
CREATE INDEX "campaign_templates_campaignId_orderIndex_idx" ON "campaign_templates"("campaignId", "orderIndex");

-- CreateIndex (уникальность: один шаблон - одно вхождение в кампанию)
CREATE UNIQUE INDEX "campaign_templates_campaignId_templateId_key" ON "campaign_templates"("campaignId", "templateId");

-- Миграция данных: переносим существующие templateId из campaigns в campaign_templates
-- Каждая существующая кампания получит свой шаблон с orderIndex = 0
INSERT INTO "campaign_templates" ("id", "campaignId", "templateId", "orderIndex", "createdAt")
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) as id,
    "id" as campaignId,
    "templateId" as templateId,
    0 as orderIndex,
    CURRENT_TIMESTAMP as createdAt
FROM "campaigns"
WHERE "templateId" IS NOT NULL;
