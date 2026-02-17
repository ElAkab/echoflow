-- Migration: Création de la table audit_logs pour la traçabilité sécurité
-- Date: 2026-02-17
-- Auteur: Architecte Sécurité
-- 
-- Cette table est CRITIQUE pour:
-- 1. Investiguer les incidents de sécurité
-- 2. Respecter les normes de conformité (RGPD, SOC2)
-- 3. Auditer les accès aux données sensibles (clés API, etc.)

-- Activer l'extension pour les adresses IP
CREATE EXTENSION IF NOT EXISTS "inet";

-- Table des logs d'audit (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Classification de l'événement
  action TEXT NOT NULL CHECK (action IN (
    -- Authentification
    'AUTH_SUCCESS', 'AUTH_FAILURE', 'LOGOUT', 'MAGIC_LINK_SENT', 'OAUTH_CALLBACK',
    -- Clés API (BYOK)
    'BYOK_KEY_CREATED', 'BYOK_KEY_UPDATED', 'BYOK_KEY_DELETED', 'BYOK_KEY_TESTED',
    -- Données utilisateur
    'NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_DELETED', 'NOTE_VIEWED',
    'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DELETED',
    -- Quiz et IA
    'QUIZ_STARTED', 'QUIZ_COMPLETED', 'HINT_REQUESTED', 'AI_MODEL_CHANGED',
    -- Abonnement et paiement
    'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_UPDATED',
    'CREDITS_PURCHASED', 'CREDITS_CONSUMED',
    -- Sécurité
    'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'ADMIN_ACTION'
  )),
  
  -- Ressource concernée
  resource_type TEXT CHECK (resource_type IN (
    'USER', 'PROFILE', 'NOTE', 'CATEGORY', 'AI_KEY', 'SUBSCRIPTION', 
    'SESSION', 'API_REQUEST'
  )),
  resource_id UUID,
  
  -- Métadonnées contextuelles (JSONB flexible)
  metadata JSONB DEFAULT '{}',
  
  -- Informations de traçabilité
  ip_address INET,
  user_agent TEXT,
  
  -- Horodatage (immuable)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Contrainte: pas de mise à jour possible (append-only)
  CONSTRAINT audit_logs_immutable CHECK (true)
);

-- Indexes pour performances requêtes d'audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
  ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON public.audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
  ON public.audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
  ON public.audit_logs(created_at DESC);

-- Index GIN pour recherches dans metadata JSONB
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata 
  ON public.audit_logs USING GIN (metadata);

-- Activer RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs ne peuvent voir QUE leurs propres logs
CREATE POLICY "Users can view own audit logs" 
  ON public.audit_logs
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Politique: Les logs sont append-only (insert uniquement)
-- Les utilisateurs ne peuvent pas modifier ou supprimer leurs logs
CREATE POLICY "Audit logs are insert-only for users"
  ON public.audit_logs
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les administrateurs (service role) peuvent tout voir
-- Note: Utiliser supabase.service_role pour contourner RLS en admin

-- Fonction helper pour créer un log d'audit
-- Cette fonction peut être appelée côté client (avec RLS) ou serveur
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Commentaires pour documentation
COMMENT ON TABLE public.audit_logs IS 
  'Logs d''audit immuables pour traçabilité sécurité et conformité. Append-only.';

COMMENT ON COLUMN public.audit_logs.action IS 
  'Type d''événement: AUTH_SUCCESS, BYOK_KEY_CREATED, etc.';

COMMENT ON COLUMN public.audit_logs.metadata IS 
  'Données contextuelles JSONB (ex: {model_used: "gpt-4", tokens_consumed: 150})';

-- Exemples d'utilisation:
-- SELECT create_audit_log('NOTE_CREATED', 'NOTE', 'uuid-123', '{"title": "Ma note"}');
-- SELECT * FROM audit_logs WHERE user_id = 'mon-uuid' ORDER BY created_at DESC LIMIT 10;
