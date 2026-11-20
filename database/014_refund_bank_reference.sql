-- Store the refund reference supplied by Razorpay's banking partner (RRN, ARN or UTR).
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS refund_reference text;

COMMENT ON COLUMN public.refunds.refund_reference IS
  'Bank reference supplied by Razorpay for a processed refund (RRN, ARN or UTR).';
