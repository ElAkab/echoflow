/**
 * Utilitaire de journalisation d'audit pour Echoflow
 * 
 * Ce module fournit des fonctions pour loguer les événements de sécurité
 * dans la table audit_logs de manière typée et sécurisée.
 * 
 * Utilisation:
 * ```typescript
 * import { auditLog, AuditAction } from '@/lib/security/audit';
 * 
 * // Loguer une action
 * await auditLog({
 *   action: AuditAction.BYOK_KEY_CREATED,
 *   resourceType: 'AI_KEY',
 *   metadata: { key_last4: '1234' }
 * });
 * ```
 */

import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Actions d'audit disponibles (doivent correspondre à la contrainte CHECK en DB)
export enum AuditAction {
  // Authentification
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  LOGOUT = 'LOGOUT',
  MAGIC_LINK_SENT = 'MAGIC_LINK_SENT',
  OAUTH_CALLBACK = 'OAUTH_CALLBACK',
  
  // Clés API (BYOK)
  BYOK_KEY_CREATED = 'BYOK_KEY_CREATED',
  BYOK_KEY_UPDATED = 'BYOK_KEY_UPDATED',
  BYOK_KEY_DELETED = 'BYOK_KEY_DELETED',
  BYOK_KEY_TESTED = 'BYOK_KEY_TESTED',
  
  // Données utilisateur
  NOTE_CREATED = 'NOTE_CREATED',
  NOTE_UPDATED = 'NOTE_UPDATED',
  NOTE_DELETED = 'NOTE_DELETED',
  NOTE_VIEWED = 'NOTE_VIEWED',
  CATEGORY_CREATED = 'CATEGORY_CREATED',
  CATEGORY_UPDATED = 'CATEGORY_UPDATED',
  CATEGORY_DELETED = 'CATEGORY_DELETED',
  
  // Quiz et IA
  QUIZ_STARTED = 'QUIZ_STARTED',
  QUIZ_COMPLETED = 'QUIZ_COMPLETED',
  HINT_REQUESTED = 'HINT_REQUESTED',
  AI_MODEL_CHANGED = 'AI_MODEL_CHANGED',
  
  // Abonnement
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  CREDITS_PURCHASED = 'CREDITS_PURCHASED',
  CREDITS_CONSUMED = 'CREDITS_CONSUMED',
  
  // Sécurité
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

// Types de ressources
export type ResourceType = 
  | 'USER' 
  | 'PROFILE' 
  | 'NOTE' 
  | 'CATEGORY' 
  | 'AI_KEY' 
  | 'SUBSCRIPTION' 
  | 'SESSION' 
  | 'API_REQUEST';

// Interface pour les options de log
interface AuditLogOptions {
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

// Interface pour les options côté serveur (avec IP et User-Agent)
interface ServerAuditLogOptions extends AuditLogOptions {
  request?: Request;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Crée un log d'audit côté client (Browser)
 * Note: IP et User-Agent ne sont pas capturés côté client pour la confidentialité
 */
export async function auditLog(options: AuditLogOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    
    const { error } = await supabase.rpc('create_audit_log', {
      p_action: options.action,
      p_resource_type: options.resourceType || null,
      p_resource_id: options.resourceId || null,
      p_metadata: options.metadata || {},
    });

    if (error) {
      console.error('Failed to create audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception creating audit log:', err);
    return { success: false, error: 'Unknown error' };
  }
}

/**
 * Crée un log d'audit côté serveur (Server Actions / API Routes)
 * Capture automatiquement IP et User-Agent depuis la requête
 */
export async function auditLogServer(
  options: ServerAuditLogOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    
    // Extraire IP et User-Agent de la requête si fournie
    let ipAddress = options.ipAddress;
    let userAgent = options.userAgent;
    
    if (options.request) {
      // Next.js Request
      const headers = options.request.headers;
      userAgent = userAgent || headers.get('user-agent') || undefined;
      
      // X-Forwarded-For pour IP derrière proxy
      const forwardedFor = headers.get('x-forwarded-for');
      ipAddress = ipAddress || forwardedFor?.split(',')[0] || 'unknown';
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: options.action,
        resource_type: options.resourceType,
        resource_id: options.resourceId,
        metadata: {
          ...options.metadata,
          timestamp: new Date().toISOString(),
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (error) {
      console.error('Failed to create server audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Exception creating server audit log:', err);
    return { success: false, error: 'Unknown error' };
  }
}

/**
 * Récupère les logs d'audit de l'utilisateur courant
 * Utile pour le dashboard "Activité de sécurité"
 */
export async function getUserAuditLogs(
  limit: number = 50,
  offset: number = 0
): Promise<{ logs: any[] | null; error: string | null }> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return { logs: null, error: error.message };
    }

    return { logs: data, error: null };
  } catch (err) {
    console.error('Exception fetching audit logs:', err);
    return { logs: null, error: 'Unknown error' };
  }
}

/**
 * Wrapper pour loguer les opérations critiques avec try/catch automatique
 * Usage: wrapWithAudit(operation, auditOptions)
 */
export async function wrapWithAudit<T>(
  operation: () => Promise<T>,
  auditOptions: AuditLogOptions
): Promise<T> {
  try {
    const result = await operation();
    
    // Loguer le succès
    await auditLog({
      ...auditOptions,
      metadata: {
        ...auditOptions.metadata,
        status: 'success',
      },
    });
    
    return result;
  } catch (error) {
    // Loguer l'échec
    await auditLog({
      ...auditOptions,
      metadata: {
        ...auditOptions.metadata,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    throw error;
  }
}

// Export nommé pour compatibilité
export { createClient };
