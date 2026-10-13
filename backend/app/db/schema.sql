-- =============================================================================
-- TriageGuard Database Schema for Supabase (PostgreSQL)
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: tickets
-- Tracks all inbound tickets, sanitization, classification, routing, and audit traces
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL DEFAULT 'web',
    subject TEXT DEFAULT '',
    body TEXT NOT NULL,
    sanitized_text TEXT,
    intent TEXT NOT NULL DEFAULT 'good', -- 'good' | 'bad'
    category TEXT,                      -- e.g. 'account_access', 'billing', 'security'
    category_conf FLOAT8,               -- Confidence score [0.0 - 1.0]
    urgency TEXT,                       -- 'low' | 'medium' | 'high' | 'critical'
    urgency_conf FLOAT8,                -- Confidence score [0.0 - 1.0]
    team TEXT,                          -- Owning team e.g. 'security_tier2', 'support_tier1'
    route TEXT,                         -- 'AUTO_REPLY' | 'HUMAN_QUEUE' | 'SECURITY_REVIEW'
    route_reason TEXT,                  -- Decision reason or policy trigger
    draft TEXT,                         -- Auto-generated draft response if permitted
    guard_result JSONB,                 -- Prompt Guard scan scores & violation tiers
    trace JSONB,                        -- LangGraph node execution timing & spans
    risk_flags TEXT[] DEFAULT '{}',     -- Array of risk indicator tags
    customer_ref TEXT,                  -- Optional tenant or customer identifier
    status TEXT NOT NULL DEFAULT 'triaged', -- 'triaged' | 'in_review' | 'resolved' | 'quarantined'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for efficient querying & filtering
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets (ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_route ON public.tickets (route);
CREATE INDEX IF NOT EXISTS idx_tickets_urgency ON public.tickets (urgency);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_ref ON public.tickets (customer_ref);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_intent ON public.tickets (intent);

-- -----------------------------------------------------------------------------
-- 2. Table: sanitization_logs
-- Append-only audit trail of deterministic sanitization runs (PII, defanged URLs, injections)
-- -----------------------------------------------------------------------------
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

-- Index on customer_id & timestamp for audit compliance
CREATE INDEX IF NOT EXISTS idx_sanitization_logs_customer ON public.sanitization_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_sanitization_logs_created ON public.sanitization_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Setup
-- -----------------------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanitization_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users / anon with valid API keys
CREATE POLICY "Allow public read access to tickets"
    ON public.tickets FOR SELECT
    USING (true);

-- Allow authenticated backend (service_role or anon with key) to insert/update tickets
CREATE POLICY "Allow insert/update to tickets"
    ON public.tickets FOR ALL
    USING (true)
    WITH CHECK (true);

-- Allow insert and read to sanitization_logs
CREATE POLICY "Allow read access to sanitization logs"
    ON public.sanitization_logs FOR SELECT
    USING (true);

CREATE POLICY "Allow insert access to sanitization logs"
    ON public.sanitization_logs FOR INSERT
    WITH CHECK (true);
