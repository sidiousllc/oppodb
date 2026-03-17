
ALTER TABLE public.mn_cfb_candidates
ADD COLUMN yearly_breakdown JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.mn_cfb_candidates.yearly_breakdown IS 'Array of {year, contributions, expenditures, contribution_count, expenditure_count} for YoY charts';
