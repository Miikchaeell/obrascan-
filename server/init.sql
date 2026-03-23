-- Database Initialization Script
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'user', 'admin'
    is_active BOOLEAN NOT NULL DEFAULT false, -- For private beta approval
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    plan_type TEXT NOT NULL DEFAULT 'free', -- 'free', 'basic', 'pro', 'enterprise'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due'
    current_period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    elemento TEXT NOT NULL,
    sistema TEXT NOT NULL,
    dimensiones JSONB NOT NULL,
    materiales JSONB NOT NULL,
    total_cost NUMERIC NOT NULL,
    prices JSONB, -- Prices used at the time of calculation
    labor_prices JSONB, -- Labor prices
    performance NUMERIC, -- Performance factor
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for user projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
