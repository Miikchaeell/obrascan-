import dotenv from 'dotenv';
dotenv.config({ override: true });
console.log("SERVER STARTING (STABLE)...");

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';

// [v5.0] Robust Nodemailer Configuration for Render (SSL Port 465)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, 
  greetingTimeout: 10000,   
  socketTimeout: 20000      
});

// [v5.0] Safe Email Helper (Non-blocking)
const safeSendMail = async (options) => {
  try {
    console.log(`📧 Attempting to send email to: ${options.to} - Subject: ${options.subject}`);
    const info = await transporter.sendMail(options);
    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error("❌ NODEMAILER DELIVERY FAILURE:", error.message);
    if (error.code === 'ENETUNREACH') {
      console.warn("⚠️ Network unreachable at SMTP Port. Check Render outbound restrictions.");
    }
    return { success: false, error: error.message };
  }
};

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ NODEMAILER ERROR:", error);
  } else {
    console.log("✅ NODEMAILER IS READY TO SEND EMAILS");
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const JWT_SECRET = process.env.JWT_SECRET || 'obra-super-secret-key';

// DB Pool Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// AUTO MIGRATION
pool.query(`
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS selected_system_id TEXT;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS performance NUMERIC;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS labor_rate NUMERIC;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
  UPDATE users SET status = 'approved' WHERE role IN ('admin', 'superadmin') AND status IS NULL;

  CREATE TABLE IF NOT EXISTS ai_corrections (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    image_url TEXT,
    detected_id TEXT,
    corrected_id TEXT,
    confidence NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log("DB MIGRATION SUCCESSFUL"))
  .catch(err => console.error("DB MIGRATION ERROR:", err));

// Auto-initialize DB tables on startup
const initDB = async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    await pool.query(schema);
    
    // Run migrations safely
    const migrationPath = path.join(__dirname, 'migrations', '001_make_superadmin.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migration);
      console.log('✅ Migraciones aplicadas correctamente.');
    }
    console.log('✅ Base de datos inicializada.');
  } catch (err) {
    console.error('❌ Error inicializando BD:', err);
  }
};
initDB();

const app = express();
const port = process.env.PORT || 4000;

// 1. CORS CONFIGURATION (No wildcards)
const allowedOrigins = [
  'https://obrascan.vercel.app',
  'https://obrago.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || isProduction === false) {
      callback(null, true);
    } else {
      console.warn("CORS Blocked for origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Preflight handling for ALL routes using a specific middleware instead of '*'
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.set('trust proxy', 1);
app.use(cookieParser());

// Webhook needs raw body - specific route
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const planType = session.metadata.planType;
      const userId = session.metadata.userId;
      await pool.query(
        `INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, current_period_end)
         VALUES ($1, $2, $3, 'active', to_timestamp($4))
         ON CONFLICT (stripe_subscription_id) DO UPDATE 
         SET plan_type = $3, status = 'active', current_period_end = to_timestamp($4)`,
        [userId, session.subscription, planType, session.expires_at]
      );
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token || token === 'null' || token === 'undefined' || token === '') {
    return res.status(401).json({ error: 'TOKEN NO RECIBIDO' });
  }

  // Verificación JWT solicitada por el CTO
  try {
    const user = jwt.verify(token, JWT_SECRET);
    console.log("TOKEN OK:", { id: user.id, email: user.email, status: user.status });
    
    // [v3.1] Force status check from DB to prevent stale tokens
    // We'll skip this for now to avoid too many DB calls, but let's at least check the token status
    if (user.status === 'pending' || user.status === 'rejected') {
       if (user.role !== 'admin' && user.role !== 'superadmin') {
         return res.status(403).json({ error: 'TU_CUENTA_PENDIENTE_DE_APROBACION' });
       }
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.log("JWT ERROR:", err.message);
    const decoded = jwt.decode(token);
    console.log("PAYLOAD DE TOKEN FALLIDO:", JSON.stringify(decoded));
    return res.status(403).json({ error: 'Sesión expirada o token inválido' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado' });
  }
};

const checkUsageLimit = async (req, res, next) => {
  const userId = req.user.id;
  const { rows: [sub] } = await pool.query('SELECT plan_type FROM subscriptions WHERE user_id = $1', [userId]);
  const plan = sub ? sub.plan_type : 'free';
  const { rows: [count] } = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
  const projectCount = parseInt(count.count);
  if (plan === 'free' && projectCount >= 3) {
    return res.status(403).json({ error: 'Límite alcanzado.' });
  }
  next();
};

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// ROUTES
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'v15-STABLE-SMTP' }));
app.get('/', (req, res) => res.send('ObraGo Backend Stable Live'));

// AUTH
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
      'INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hashedPassword, 'user', 'pending']
    );

    // [v3.0] Notify Admin
    const adminEmail = 'michael.seura.delgado@gmail.com';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const approveLink = `${backendUrl}/api/admin/user-action?userId=${user.id}&action=approved&token=${JWT_SECRET}`;
    const rejectLink = `${backendUrl}/api/admin/user-action?userId=${user.id}&action=rejected&token=${JWT_SECRET}`;

    const mailOptions = {
      from: `"ObraGo Admin" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `Nuevo usuario registrado: ${email}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #f97316;">Solicitud de Registro ObraGo</h2>
          <p>Se ha registrado un nuevo usuario:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          <div style="margin-top: 30px; display: flex; gap: 10px;">
            <a href="${approveLink}" style="background: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">APROBAR</a>
            <a href="${rejectLink}" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-left: 10px;">RECHAZAR</a>
          </div>
          <p style="margin-top: 20px; font-size: 11px; color: #888;">Acción manual requerida para habilitar acceso.</p>
        </div>
      `
    };

    // [v5.0] RESILIENT ADMIN NOTIFICATION (Non-blocking)
    safeSendMail(mailOptions); 

    res.json({ 
      success: true, 
      userId: user.id, 
      message: "Registro exitoso. Tu cuenta está en revisión. El administrador ha sido notificado." 
    });
  } catch (error) {
    if (error.code === '23505') {
       return res.status(409).json({ error: "El email ya está registrado." });
    }
    res.status(500).json({ error: error.message });
  }
});

// [v4.0] FEEDBACK CORRECTION ENDPOINT
app.post('/api/feedback/correction', authenticateToken, async (req, res) => {
  const { imageUrl, detectedId, correctedId, confidence } = req.body;
  try {
    await pool.query(
      'INSERT INTO ai_corrections (user_id, image_url, detected_id, corrected_id, confidence) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, imageUrl, detectedId, correctedId, confidence]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("FEEDBACK ERROR:", error);
    res.status(500).json({ error: "No se pudo guardar la corrección" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // [v3.0] Manual Approval System
    if (user.status === 'pending' && user.role !== 'admin' && user.role !== 'superadmin') {
       return res.status(403).json({ error: 'TU_CUENTA_AUN_NO_HA_SIDO_APROBADA' });
    }
    if (user.status === 'rejected' && user.role !== 'admin' && user.role !== 'superadmin') {
       return res.status(403).json({ error: 'TU_ACCESO_FUE_RECHAZADO' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role, status: user.status } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [v3.0] ADMIN USER ACTION (Approve/Reject)
app.get('/api/admin/user-action', async (req, res) => {
  const { userId, action, token } = req.query;
  
  if (token !== JWT_SECRET) {
    return res.status(403).send("Token de seguridad inválido para esta acción.");
  }

  try {
    const { rows: [user] } = await pool.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING email', [action, userId]);
    
    if (!user) return res.status(404).send("Usuario no encontrado.");

    // Notify User
    const subject = action === 'approved' ? '¡Tu cuenta ObraGo ha sido aprobada!' : 'Solicitud de acceso ObraGo';
    const message = action === 'approved' 
      ? 'Tu cuenta ha sido aprobada con éxito. Ya puedes ingresar sistema y gestionar tus proyectos.'
      : 'Lamentamos informarte que tu solicitud de acceso a la beta privada ha sido rechazada por el momento.';

    const mailOptions = {
      from: `"ObraGo" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #f97316;">ObraGo Access Status</h2>
          <p>${message}</p>
          ${action === 'approved' ? `<a href="https://obrago.vercel.app/login" style="display: inline-block; background: #f97316; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 20px;">INGRESAR AHORA</a>` : ''}
          <p style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888;">© 2026 ObraGo Construction Suite</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Error enviando correo a usuario:", err));

    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: ${action === 'approved' ? '#22c55e' : '#ef4444'}">Usuario ${action === 'approved' ? 'Aprobado' : 'Rechazado'}</h1>
        <p>El estado del usuario <b>${user.email}</b> ha sido actualizado a: <b>${action}</b></p>
        <p>Se ha enviado un correo de notificación al usuario.</p>
      </div>
    `);
  } catch (error) {
    res.status(500).send("Error procesando acción: " + error.message);
  }
});

// PASSWORD RECOVERY (v2.3)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const { rows: [user] } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Generate a simple 1H recovery token
    const recoveryToken = jwt.sign({ id: user.id, type: 'recovery' }, JWT_SECRET, { expiresIn: '1h' });
    
    // [v3.1] REAL EMAIL SENDING
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${recoveryToken}`;
    
    const mailOptions = {
      from: `"ObraGo Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Restablecer tu contraseña de ObraGo",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #f97316;">Recuperación de Contraseña</h2>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
          <a href="${resetLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold;">RESTABLECER CONTRASEÑA</a>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">Si no solicitaste este cambio, puedes ignorar este correo. El enlace expira en 1 hora.</p>
        </div>
      `
    };

    // [v5.0] RESILIENT PASSWORD RECOVERY (Non-blocking)
    safeSendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: "Si el correo está registrado, recibirás instrucciones en breve. Por favor revisa tu bandeja de entrada o spam." 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'recovery') throw new Error('Token inválido para recuperación');
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.id]);
    
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(400).json({ error: 'Token expirado o inválido' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const { rows: [user] } = await pool.query('SELECT id, email, role, status FROM users WHERE id = $1', [req.user.id]);
  const { rows: [sub] } = await pool.query('SELECT plan_type FROM subscriptions WHERE user_id = $1', [req.user.id]);
  res.json({ user, plan: sub ? sub.plan_type : 'free' });
});

// ANALYZE
app.post('/api/analyze', authenticateToken, checkUsageLimit, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const base64Image = fs.readFileSync(req.file.path).toString('base64');
    const systemPrompt = `Eres un Ingeniero Civil experto en Cubicaciones y Presupuestos de Obra para el mercado chileno.
Tu misión es identificar la PARTIDA DE OBRA exacta en una imagen para generar un APU profesional.

DEBES devolver estrictamente un JSON con esta estructura:
{
  "partida": "string (Categoría principal, ej: Cierros Provisorios)",
  "subtipo": "string (Descripción técnica específica detectada)",
  "sistema_id": "string (ID exacto del catálogo: cie_prov_osb | cie_prov_zinc | cie_prov_raschel | tabique_st | cielo_falso_st | radier_estandar)",
  "dimensiones": {
    "largo": "number (m)",
    "ancho": "number (m)",
    "espesor": "number (m)"
  },
  "confianza": "number (0.0 a 1.0)",
  "calidad_analisis": {
    "iluminacion": "buena | deficiente",
    "enfoque": "nitido | borroso",
    "advertencia": "string (vacío si es bueno, o mensaje de por qué la imagen es difícil)"
  },
  "alternativas": ["string (IDs de otras partidas posibles si hay duda)"],
  "recomendacion_cuadrilla": "string (ej: Maestro + Ayudante)"
}

REGLAS DE ORO:
1. NO clasifiques como 'tabique_st' si ves un cierre de madera/zinc en exterior (es faena provisoria).
2. 'sistema_id' DEBE ser uno de: cie_prov_osb, cie_prov_zinc, cie_prov_raschel, tabique_st, cielo_falso_st, radier_estandar.
3. El espesor es crítico: Cierres (0.05m), Tabiques (0.10m), Radier (0.10m).
4. Si la confianza es < 0.7, detalla el motivo en la advertencia.`;
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ 
        role: "system", 
        content: systemPrompt
      },
      { 
        role: "user", 
        content: [
          { type: "text", text: "Analyze this image for construction budgeting." }, 
          { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }
        ] 
      }],
      response_format: { type: "json_object" }
    });
    const parsedData = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, data: parsedData, imageUrl: `/uploads/${req.file.filename}` });
  } catch (error) {
    console.error('<<< ANALYZE ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PROJECTS
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { rows: projects } = await pool.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY date DESC', [req.user.id]);
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const projectData = JSON.parse(req.body.projectData);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : projectData.image;
    const { rows: [project] } = await pool.query(
      `INSERT INTO projects (user_id, elemento, sistema, dimensiones, materiales, total_cost, image_url, prices, labor_prices, performance, selected_system_id, labor_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        req.user.id, 
        projectData.elemento, 
        projectData.sistema, 
        JSON.stringify(projectData.dimensiones), 
        JSON.stringify(projectData.materiales), 
        projectData.totalCost.total, 
        imageUrl, 
        JSON.stringify(projectData.prices), 
        JSON.stringify(projectData.labor_prices), 
        projectData.performance,
        projectData.selectedSystemId,
        projectData.labor_rate
      ]
    );
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SERVER RUNNING ON PORT ${port}`);
});
