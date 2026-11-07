-- Seed canonical interior projects for demonstration and testing
-- Deterministic UUIDs ensure foreign key integrity across modules.

INSERT INTO interior_projects (id, tenant_id, code, name, customer_id, customer_name, customer_phone, site_address, project_type, status, estimated_budget, target_completion_date, lead_architect_id, lead_architect_name)
SELECT 
  v.id,
  t.id AS tenant_id,
  v.code,
  v.name,
  v.customer_id,
  v.customer_name,
  v.customer_phone,
  v.site_address,
  v.project_type,
  v.status,
  v.estimated_budget,
  v.target_completion_date::date,
  COALESCE(u.id::text, '9077b10b-ee20-4058-907b-7a3e918b84c3'),
  v.lead_architect_name
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'admin'
CROSS JOIN (
  VALUES
    ('f6b027ee-494c-4c42-a6cd-01b18626c043'::uuid, 'INT-2024-001', 'Villa Sunrise Renovation', 'cust-001', 'Ahmad Santoso', '0901234567', 'Khu đô thị Ciputra, Tây Hồ, Hà Nội', 'villa', 'production', 2450000000, '2026-12-31', 'KTS. Hoàng Long'),
    ('7044e341-0a0b-4b10-a240-be5cb40b2fe0'::uuid, 'INT-2024-002', 'Dubai Luxury Villa Fitout', 'cust-002', 'Sheikh Mansoor', '0902345678', 'Palm Jumeirah Villa 42, Dubai', 'dinh_thu', 'installation', 3780000000, '2027-03-31', 'KTS. Lê Hoàng Sơn'),
    ('88113a2e-9f0e-44ca-a507-2853090212b9'::uuid, 'INT-2024-003', 'Penthouse Metropolis Liễu Giai', 'cust-003', 'Trịnh Thăng Bình', '0903456789', 'Tòa M1 Vinhomes Metropolis Liễu Giai', 'penthouse', 'handover', 2200000000, '2026-11-30', 'KTS. Hoàng Long'),
    ('d450fc00-a593-484f-a8ad-ff8aebf756df'::uuid, 'INT-2024-004', 'Duplex Aqua Bay Ecopark', 'cust-004', 'Phạm Hồng Nhung', '0904567890', 'Aqua Bay Sky Residences Ecopark', 'duplex', 'design', 850000000, '2027-01-15', 'KTS. Lê Hoàng Sơn')
) AS v(id, code, name, customer_id, customer_name, customer_phone, site_address, project_type, status, estimated_budget, target_completion_date, lead_architect_name)
WHERE t.product_key = 'bella_interior' OR (t.enabled_modules->>'bella_interior')::boolean = true
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  customer_name = EXCLUDED.customer_name,
  estimated_budget = EXCLUDED.estimated_budget;
