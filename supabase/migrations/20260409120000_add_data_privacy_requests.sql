-- KVKK Data Privacy Requests Table
-- Stores user requests for data access, correction, deletion, and objection
-- Required for KVKK Madde 11 compliance

CREATE TABLE IF NOT EXISTS public.data_privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'view', 'correction', 'deletion', 'objection')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.data_privacy_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own requests
CREATE POLICY "Users can view own data privacy requests"
  ON public.data_privacy_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create data privacy requests"
  ON public.data_privacy_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_privacy_requests_user_id ON public.data_privacy_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_privacy_requests_status ON public.data_privacy_requests(status);

-- Add consent fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS consent_data_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consent_version TEXT;
