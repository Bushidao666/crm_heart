alter table if exists heart.equipe add column if not exists last_session jsonb;

update heart.equipe
set last_session = jsonb_strip_nulls(
  jsonb_build_object(
    'ip_address', metadata->>'ip_address',
    'geolocation', metadata->'geolocation',
    'user_agent', metadata->>'user_agent',
    'last_geolocation_at', metadata->>'last_geolocation_at'
  )
)
where metadata ?| array['ip_address','geolocation','user_agent','last_geolocation_at'];

update heart.equipe
set metadata = metadata - 'ip_address' - 'geolocation' - 'user_agent' - 'last_geolocation_at'
where metadata ?| array['ip_address','geolocation','user_agent','last_geolocation_at'];
