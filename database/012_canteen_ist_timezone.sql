-- HUNGRY canteen schedules are campus-local IST schedules.
UPDATE public.canteens SET timezone = 'Asia/Kolkata' WHERE timezone <> 'Asia/Kolkata';

ALTER TABLE public.canteens
  ADD CONSTRAINT canteens_timezone_ist CHECK (timezone = 'Asia/Kolkata');
