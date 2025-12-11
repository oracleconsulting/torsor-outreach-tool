-- Query to see all directors imported from CSV with their confirmation status
-- This will show which addresses were AI confirmed vs CSV imported

SELECT 
  d.id,
  d.name as director_name,
  d.officer_id,
  d.address_source,
  d.address_verified_at,
  d.trading_address->>'address_line_1' as trading_line_1,
  d.trading_address->>'locality' as trading_town,
  d.trading_address->>'postal_code' as trading_postcode,
  d.contact_address->>'address_line_1' as contact_line_1,
  d.contact_address->>'locality' as contact_town,
  d.contact_address->>'postal_code' as contact_postcode,
  d.email,
  d.phone,
  d.linkedin_url,
  d.preferred_contact_method,
  COUNT(da.id) as appointment_count
FROM outreach.directors d
LEFT JOIN outreach.director_appointments da ON da.director_id = d.id
WHERE d.address_source IN ('csv_import', 'csv_import_ai_confirmed')
  AND d.address_verified_at >= NOW() - INTERVAL '1 day'  -- Last 24 hours
GROUP BY d.id, d.name, d.officer_id, d.address_source, d.address_verified_at,
         d.trading_address, d.contact_address, d.email, d.phone, d.linkedin_url, d.preferred_contact_method
ORDER BY d.address_verified_at DESC, d.address_source DESC;

-- Summary by confirmation status
SELECT 
  address_source,
  COUNT(*) as count,
  COUNT(CASE WHEN trading_address IS NOT NULL THEN 1 END) as has_trading_address,
  COUNT(CASE WHEN contact_address IS NOT NULL THEN 1 END) as has_contact_address,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as has_email,
  COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as has_phone
FROM outreach.directors
WHERE address_source IN ('csv_import', 'csv_import_ai_confirmed')
  AND address_verified_at >= NOW() - INTERVAL '1 day'
GROUP BY address_source
ORDER BY address_source DESC;

-- Detailed list of AI confirmed addresses
SELECT 
  d.name as director_name,
  d.address_source,
  d.address_verified_at,
  d.trading_address,
  d.contact_address,
  d.email,
  d.phone
FROM outreach.directors d
WHERE d.address_source = 'csv_import_ai_confirmed'
  AND d.address_verified_at >= NOW() - INTERVAL '1 day'
ORDER BY d.address_verified_at DESC;

