-- Delete the lowercase duplicates (sort_order = 99)
DELETE FROM wiki_pages WHERE sort_order = 99;

-- Fix slugs on the remaining pages to match the static page slugs used in the frontend
UPDATE wiki_pages SET slug = 'overview' WHERE slug = '01-Overview';
UPDATE wiki_pages SET slug = 'candidate-profiles' WHERE slug = '02-Candidate-Profiles';
UPDATE wiki_pages SET slug = 'district-intelligence' WHERE slug = '03-District-Intelligence';
UPDATE wiki_pages SET slug = 'polling-data' WHERE slug = '04-Polling-Data';
UPDATE wiki_pages SET slug = 'campaign-finance' WHERE slug = '05-Campaign-Finance';
UPDATE wiki_pages SET slug = 'state-legislative-districts' WHERE slug = '06-State-Legislative-Districts';
UPDATE wiki_pages SET slug = 'additional-features' WHERE slug = '07-Additional-Features';
UPDATE wiki_pages SET slug = 'authentication-and-user-management' WHERE slug = '08-Authentication-and-User-Management';
UPDATE wiki_pages SET slug = 'api-access' WHERE slug = '09-API-Access';
UPDATE wiki_pages SET slug = 'ui-design-system' WHERE slug = '10-UI-Design-System';
UPDATE wiki_pages SET slug = 'data-sync-and-sources' WHERE slug = '11-Data-Sync-and-Sources';
UPDATE wiki_pages SET slug = 'cook-ratings-and-forecasting' WHERE slug = '12-Cook-Ratings-and-Forecasting';
UPDATE wiki_pages SET slug = 'admin-panel' WHERE slug = '13-Admin-Panel';
UPDATE wiki_pages SET slug = 'research-tools' WHERE slug = '14-Research-Tools';
UPDATE wiki_pages SET slug = 'android-app' WHERE slug = '15-Android-App';
UPDATE wiki_pages SET slug = 'prediction-market-trading' WHERE slug = '16-Prediction-Market-Trading';
UPDATE wiki_pages SET slug = 'leghub' WHERE slug = '17-LegHub';
UPDATE wiki_pages SET slug = 'oppodb-search' WHERE slug = '18-OppoDB-Search';
UPDATE wiki_pages SET slug = 'oppohub' WHERE slug = '19-OppoHub';
UPDATE wiki_pages SET slug = 'messaginghub' WHERE slug = '20-MessagingHub';