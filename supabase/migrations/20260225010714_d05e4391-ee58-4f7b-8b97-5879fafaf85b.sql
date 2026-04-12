
-- Create bulk CAPA audit sessions table
CREATE TABLE public.bulk_capa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_capa_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions"
  ON public.bulk_capa_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create bulk CAPA hazard entries table
CREATE TABLE public.bulk_capa_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.bulk_capa_sessions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  correction_plan TEXT,
  risk_score TEXT,
  justification TEXT,
  fk_probability DOUBLE PRECISION,
  fk_severity DOUBLE PRECISION,
  fk_frequency DOUBLE PRECISION,
  fk_risk_value DOUBLE PRECISION,
  fk_risk_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_capa_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage entries via session ownership"
  ON public.bulk_capa_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_capa_sessions
      WHERE id = bulk_capa_entries.session_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bulk_capa_sessions
      WHERE id = bulk_capa_entries.session_id
      AND user_id = auth.uid()
    )
  );

-- Updated at trigger for sessions
CREATE TRIGGER update_bulk_capa_sessions_updated_at
  BEFORE UPDATE ON public.bulk_capa_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
