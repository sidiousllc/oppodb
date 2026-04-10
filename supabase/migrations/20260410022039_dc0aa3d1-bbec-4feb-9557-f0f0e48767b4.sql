ALTER TABLE public.profiles
ADD COLUMN windows_theme text NOT NULL DEFAULT 'win98',
ADD COLUMN dark_mode boolean NOT NULL DEFAULT false;