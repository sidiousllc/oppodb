INSERT INTO public.user_roles (user_id, role) 
VALUES ('5abb4a2e-5154-480b-aee0-7fe4c69f6cea', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;