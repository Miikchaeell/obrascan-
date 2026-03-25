import dotenv from 'dotenv';
dotenv.config({ override: true });
console.log("SERVER STARTING (MINIMAL)...");

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pkg from 'pg';
const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';

// DB Pool Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

const app = express();
const port = process.env.PORT || 4000;

// 1. MIDDLEWARES (Clean Order)
app.use(cors()); // Start with simplest CORS as requested
app.use(express.json());
app.use(cookieParser());

// 2. LOGGING (No wildcards)
app.use((req, res, next) => {
  console.log(`>>> ${req.method} ${req.url}`);
  next();
});

// 3. HEALTH CHECK (Requested)
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'v10-minimal' });
});

// 4. MAIN ROUTE
app.get('/', (req, res) => {
  res.send('ObraGo Backend Minimal Live');
});

// 5. SERVER START
console.log("PORT:", port);
app.listen(port, '0.0.0.0', () => {
  console.log(`SERVER RUNNING ON PORT ${port}`);
});

/* 
  LOGICA TEMPORALMENTE DESACTIVADA PARA ESTABILIZACIÓN:
  - /api/auth/*
  - /api/analyze
  - /api/projects
*/
