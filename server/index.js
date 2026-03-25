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

// Global Request Logger with Header Debugging
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log(`>>> [${requestId}] ${req.method} ${req.url}`);
  console.log(`[${requestId}] HEADERS:`, {
    authorization: req.headers.authorization ? (req.headers.authorization.substring(0, 20) + '...') : 'MISSING',
    origin: req.headers.origin || 'NO ORIGIN',
    'content-type': req.headers['content-type']
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`<<< [${requestId}] ${req.method} ${req.url} - STATUS: ${res.statusCode} (${duration}ms)`);
  });
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

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sesión expirada' });
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
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'v11-stable' }));
app.get('/', (req, res) => res.send('ObraGo Backend Stable Live'));

// AUTH
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, hashedPassword, 'user', false]
    );
    res.json({ success: true, userId: user.id });
  } catch (error) {
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
      return res.status(403).json({ error: 'Cuenta no aprobada' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, is_active: user.is_active }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
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

// ANALYZE
app.post('/api/analyze', authenticateToken, checkUsageLimit, upload.single('image'), async (req, res) => {
  console.log('>>> ANALYZE START - User:', req.user.email);
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const base64Image = fs.readFileSync(req.file.path).toString('base64');
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: "Expert construction engineer. Extract structure, element, dimensions. Return strict JSON." },
                 { role: "user", content: [{ type: "text", text: "Analyze this image." }, { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }] }],
      response_format: { type: "json_object" }
    });
    const parsedData = JSON.parse(response.choices[0].message.content);
    console.log('<<< ANALYZE SUCCESS');
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
      `INSERT INTO projects (user_id, elemento, sistema, dimensiones, materiales, total_cost, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, projectData.elemento, projectData.sistema, JSON.stringify(projectData.dimensiones), JSON.stringify(projectData.materiales), projectData.totalCost, imageUrl]
    );
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SERVER RUNNING ON PORT ${port}`);
});
