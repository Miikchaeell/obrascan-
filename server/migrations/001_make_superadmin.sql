-- Agregar columnas si no existen
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Actualizar al usuario maestro (Promoción vía DB, no hardcodeado en la lógica de Node)
UPDATE users SET 
    role = 'superadmin', 
    status = 'approved'
WHERE email = 'michael.seura.delgado@gmail.com';
