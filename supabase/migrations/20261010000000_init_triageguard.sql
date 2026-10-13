-- =============================================================================
-- Migration: 20261010000000_init_triageguard.sql
-- TriageGuard initial schema: tickets, sanitization_logs, RLS, indexes
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL DEFAULT 'web',
    subject TEXT DEFAULT '',
    body TEXT NOT NULL,
    sanitized_text TEXT,
    intent TEXT NOT NULL DEFAULT 'good',
    category TEXT,
    category_conf FLOAT8,
    urgency TEXT,
    urgency_conf FLOAT8,
    team TEXT,
    route TEXT,
    route_reason TEXT,
    draft TEXT,
    guard_result JSONB,
    trace JSONB,
    risk_flags TEXT[] DEFAULT '{}',
    customer_ref TEXT,
    status TEXT NOT NULL DEFAULT 'triaged',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets (ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_route ON public.tickets (route);
CREATE INDEX IF NOT EXISTS idx_tickets_urgency ON public.tickets (urgency);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_ref ON public.tickets (customer_ref);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_intent ON public.tickets (intent);

-- Sanitization Audit Logs Table
CREATE TABLE IF NOT EXISTS public.sanitization_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT NOT NULL,
    raw_preview TEXT,
    sanitized_text TEXT,
    pii_detected JSONB,
    urls_defanged TEXT[] DEFAULT '{}',
    injections_detected TEXT[] DEFAULT '{}',
    processing_time_ms FLOAT8 DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sanitization_logs_customer ON public.sanitization_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_sanitization_logs_created ON public.sanitization_logs (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanitization_logs ENABLE ROW LEVEL SECURITY;

-- Default permissive policies for authenticated and anon roles with project keys
CREATE POLICY "Allow public read access to tickets"
    ON public.tickets FOR SELECT
    USING (true);

CREATE POLICY "Allow insert/update to tickets"
    ON public.tickets FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow read access to sanitization logs"
    ON public.sanitization_logs FOR SELECT
    USING (true);

CREATE POLICY "Allow insert access to sanitization logs"
    ON public.sanitization_logs FOR INSERT
    WITH CHECK (true);
