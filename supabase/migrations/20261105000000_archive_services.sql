ALTER TABLE public.services ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
