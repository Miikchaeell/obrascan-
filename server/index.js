import dotenv from 'dotenv';
dotenv.config({ override: true });
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

    console.log('✅ Base de datos inicializada o verificada (Tablas creadas).');
  } catch (err) {
    console.error('❌ Error inicializando BD:', err);
  }
};
initDB();

const app = express();
const port = process.env.PORT || 4000;

app.get('/', (req, res) => res.send('ObraGo Backend Live'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', environment: process.env.NODE_ENV }));

// Proper CORS for production
app.options('*', cors());
app.use(cors({
  origin: [
    "https://obrascan.vercel.app", // Ensure this matches Vercel production domain
    "https://obrago.vercel.app",
    "http://localhost:5555"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ],
  credentials: true
}));

app.set('trust proxy', 1);
app.use(cookieParser());

// Webhook needs raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerId = session.customer;
    const planType = session.metadata.planType;
    const userId = session.metadata.userId;

    // Update or Insert subscription
    await pool.query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, current_period_end)
       VALUES ($1, $2, $3, 'active', to_timestamp($4))
       ON CONFLICT (stripe_subscription_id) DO UPDATE 
       SET plan_type = $3, status = 'active', current_period_end = to_timestamp($4)`,
      [userId, session.subscription, planType, session.expires_at]
    );
  }

  res.json({ received: true });
});

app.use(express.json());

// Auth Middleware
const authenticateToken = (req, res, next) => {
  console.log("--- DEBUG NETWORK ---");
  console.log("METHOD:", req.method);
  console.log("ORIGIN:", req.headers.origin);
  console.log("AUTH HEADER BACKEND FINAL:", req.headers.authorization);
  console.log("AC REQUEST HEADERS:", req.headers['access-control-request-headers']);
  console.log("----------------------");

  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const extracted = authHeader.split(' ')[1];
    if (extracted && extracted !== 'null' && extracted !== 'undefined' && extracted !== '') {
      token = extracted;
      console.log('3. Token extraído del Header correctamente.');
    } else {
      console.log('3. Header Bearer presente, pero el token era null/vacio/undefined.');
    }
  } else {
    console.log('3. No se detectó Header Authorization o no inicia con Bearer.');
  }

  // Fallback to cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
    console.log('4. Fallback a Cookie: Se logró extraer token de cookie.');
  } else if (!token) {
    console.log('4. Fallback a Cookie: No hay token en req.cookies.');
  }
  
  if (!token) {
    console.log("5. Veredicto Final: NO HAY TOKEN VÁLIDO. Rebotando con 401.");
    return res.status(401).json({ error: 'TOKEN NO RECIBIDO' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("5. Veredicto Final: TOKEN INVÁLIDO O EXPIRADO ->", err.message);
      return res.status(403).json({ error: 'Sesión expirada' });
    }
    console.log("5. Veredicto Final: AUTENTICACIÓN EXITOSA para ->", user.email);
    
    // Check if user is active (Private Beta)
    if (user.is_active === false && user.role !== 'admin' && user.role !== 'superadmin') {
       return res.status(403).json({ error: 'Cuenta pendiente de aprobación (Beta Privada)' });
    }

    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado: Se requiere ser Administrador' });
  }
};

// Check Project Limits Middleware
const checkUsageLimit = async (req, res, next) => {
  const userId = req.user.id;
  const { rows: [sub] } = await pool.query('SELECT plan_type FROM subscriptions WHERE user_id = $1', [userId]);
  const plan = sub ? sub.plan_type : 'free';

  const { rows: [count] } = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
  const projectCount = parseInt(count.count);

  if (plan === 'free' && projectCount >= 3) {
    return res.status(403).json({ error: 'Límite alcanzado. Actualiza tu plan para seguir cubicando.' });
  }
  next();
};

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files for images
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// AUTH ENDPOINTS
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows: existingUsers } = await pool.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(existingUsers[0].count) === 0;
    
    // Auto-activate and make admin if it's the first user or matches INITIAL_ADMIN_EMAIL
    const role = (isFirstUser || email === process.env.INITIAL_ADMIN_EMAIL) ? 'admin' : 'user';
    const isActive = (isFirstUser || email === process.env.INITIAL_ADMIN_EMAIL);

    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id, email, role, is_active',
      [email, hashedPassword, role, isActive]
    );

    res.json({ 
      success: true, 
      user, 
      message: isActive ? 'Cuenta creada' : 'Cuenta registrada. Esperando aprobación de administrador.' 
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.is_active && user.role !== 'admin') {
      return res.status(403).json({ error: 'Tu cuenta aún no ha sido aprobada para la Beta Privada.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, is_active: user.is_active }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    console.log("LOGIN RESPONSE BACKEND TOKEN EXISTS:", !!token);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const responsePayload = { success: true, token, user: { id: user.id, email: user.email, role: user.role } };
    console.log("LOGIN RESPONSE BACKEND:", responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const { rows: [user] } = await pool.query('SELECT id, email, role, is_active FROM users WHERE id = $1', [req.user.id]);
  const { rows: [sub] } = await pool.query('SELECT plan_type FROM subscriptions WHERE user_id = $1', [req.user.id]);
  res.json({ user, plan: sub ? sub.plan_type : 'free' });
});

// ADMIN ENDPOINTS
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { rows: users } = await pool.query('SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/users/:id/activate', authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STRIPE ENDPOINTS
app.post('/api/stripe/create-checkout', authenticateToken, async (req, res) => {
  const { planType, priceId } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/scanner?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId: req.user.id, planType }
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TEST ENDPOINT
app.post('/api/auth-header-test', (req, res) => {
  console.log("--- DEBUG TEST ENDPOINT ---");
  console.log("METHOD:", req.method);
  console.log("ORIGIN:", req.headers.origin);
  console.log("AUTH HEADER TEST BACKEND:", req.headers.authorization);
  console.log("---------------------------");
  res.json({
    receivedAuthorization: req.headers.authorization || null,
    origin: req.headers.origin || null,
    method: req.method
  });
});

// ANALYZE ENDPOINT
app.post('/api/analyze', authenticateToken, checkUsageLimit, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const base64Image = fs.readFileSync(req.file.path).toString('base64');
    const mimeType = req.file.mimetype;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Expert construction engineer. Extract structure, element, dimensions. Return strict JSON." },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Analyze this image for construction materials and dimensions." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "construction_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              elemento: { type: "string" },
              sistema_constructivo: { type: "string" },
              dimensiones: {
                type: "object",
                properties: { alto_m: { type: "number" }, ancho_m: { type: "number" }, espesor_m: { type: "number" } },
                required: ["alto_m", "ancho_m", "espesor_m"],
                additionalProperties: false
              },
              materiales_detectados: { type: "array", items: { type: "string" } },
              nivel_avance: { type: "string" },
              confianza: { type: "string" },
              observaciones: { type: "string" }
            },
            required: ["elemento", "sistema_constructivo", "dimensiones", "materiales_detectados", "nivel_avance", "confianza", "observaciones"],
            additionalProperties: false
          }
        }
      }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, data: parsedData, imageUrl: `/uploads/${req.file.filename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PROJECTS ENDPOINTS
app.post('/api/projects', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const projectData = JSON.parse(req.body.projectData);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : projectData.image;

    const { rows: [project] } = await pool.query(
      `INSERT INTO projects (user_id, elemento, sistema, dimensiones, materiales, total_cost, prices, labor_prices, performance, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.id, 
        projectData.elemento, 
        projectData.sistema, 
        projectData.dimensiones, 
        JSON.stringify(projectData.materiales), 
        projectData.totalCost, 
        JSON.stringify(projectData.prices),
        JSON.stringify(projectData.laborPrices),
        projectData.performance,
        imageUrl
      ]
    );

    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { rows: [sub] } = await pool.query('SELECT plan_type FROM subscriptions WHERE user_id = $1', [req.user.id]);
    const plan = sub ? sub.plan_type : 'free';

    // If free, maybe limit what they see in history? 
    // For now, let's keep all their 3 projects visible.
    const { rows: projects } = await pool.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY date DESC', [req.user.id]);
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Production server strictly listening on 0.0.0.0:${port}`);
});

