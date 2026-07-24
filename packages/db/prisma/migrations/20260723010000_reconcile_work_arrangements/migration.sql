-- Reconcile databases that applied the original job-preferences migration,
-- which created a singular TEXT column, with the current Prisma schema.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "workArrangements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'workArrangement'
  ) THEN
    EXECUTE $migration$
      UPDATE "User"
      SET "workArrangements" = ARRAY[
        CASE "workArrangement"
          WHEN 'REMOTE_PREFERRED' THEN 'REMOTE'
          WHEN 'ONSITE_PREFERRED' THEN 'ONSITE'
          WHEN 'HYBRID_PREFERRED' THEN 'HYBRID'
          ELSE "workArrangement"
        END
      ]
      WHERE "workArrangement" IS NOT NULL
        AND cardinality("workArrangements") = 0
    $migration$;

    ALTER TABLE "User" DROP COLUMN "workArrangement";
  END IF;
END $$;
