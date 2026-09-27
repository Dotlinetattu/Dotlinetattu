-- Prevent concurrent reservations from claiming the same time range.
-- Preflight on 2026-09-24 found no overlapping scheduled appointments.

CREATE EXTENSION IF NOT EXISTS btree_gist;

UPDATE appointments
SET duration_hours = 2
WHERE duration_hours IS NULL;

ALTER TABLE appointments
  ALTER COLUMN duration_hours SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_duration_hours_positive'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_duration_hours_positive
      CHECK (duration_hours > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_no_scheduled_overlap'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_scheduled_overlap
      EXCLUDE USING gist (
        date WITH =,
        tsrange(
          date + time,
          date + time + (duration_hours * INTERVAL '1 hour'),
          '[)'
        ) WITH &&
      )
      WHERE (status = 'SCHEDULED');
  END IF;
END $$;

-- The public website uses server actions and the service role. Browser clients
-- must never be allowed to create or alter appointments directly.
DROP POLICY IF EXISTS "Allow all operations on appointments" ON appointments;
