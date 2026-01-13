-- AlterTable
-- Шаг 1: Добавляем новые колонки
ALTER TABLE "campaign_global_settings" ADD COLUMN "delayBetweenMessagesMs" INTEGER DEFAULT 5000;
ALTER TABLE "campaign_global_settings" ADD COLUMN "delayBetweenContactsMs" INTEGER DEFAULT 60000;

-- Шаг 2: Заполняем новые колонки средними значениями из старых (или дефолтными)
UPDATE "campaign_global_settings"
SET 
  "delayBetweenMessagesMs" = COALESCE(
    ("minDelayBetweenMessagesMs" + "maxDelayBetweenMessagesMs") / 2,
    5000
  ),
  "delayBetweenContactsMs" = COALESCE(
    ("minDelayBetweenContactsMs" + "maxDelayBetweenContactsMs") / 2,
    60000
  );

-- Шаг 3: Удаляем старые колонки
ALTER TABLE "campaign_global_settings" DROP COLUMN "minDelayBetweenMessagesMs";
ALTER TABLE "campaign_global_settings" DROP COLUMN "maxDelayBetweenMessagesMs";
ALTER TABLE "campaign_global_settings" DROP COLUMN "minDelayBetweenContactsMs";
ALTER TABLE "campaign_global_settings" DROP COLUMN "maxDelayBetweenContactsMs";






