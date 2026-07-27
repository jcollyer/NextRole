-- Distinguish "no jobs open" from "jobs open, none matched the user's filters".
ALTER TABLE "ScanHistory"
ADD COLUMN "jobsMatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "strategy" TEXT;

-- A scan that finds nothing is no longer reported as a plain SUCCESS.
ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'EMPTY';
