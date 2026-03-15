UPDATE state_legislative_profiles
SET district_number = regexp_replace(district_number, '^0+', '')
WHERE district_number ~ '^0+[0-9]+$'
  AND length(district_number) > 1;