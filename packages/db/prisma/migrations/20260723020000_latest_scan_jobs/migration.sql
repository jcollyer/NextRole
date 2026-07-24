ALTER TABLE "Job"
ADD COLUMN "discoveredByScan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;

-- Backfill the source values used by the existing careers-page scanner.
UPDATE "Job"
SET "discoveredByScan" = true
WHERE "source" IN ('Careers page scan', 'Greenhouse job board');

CREATE INDEX "Job_companyId_discoveredByScan_isCurrent_idx"
ON "Job"("companyId", "discoveredByScan", "isCurrent");
