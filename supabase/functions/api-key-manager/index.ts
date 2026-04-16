import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateApiKey(name: string): { key: string; prefix: string; hash: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'oppodb_' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const randomPart = Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const fullKey = prefix + randomPart
  
  return {
    key: fullKey,
    prefix,
    hash: ''
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from session token
    const sessionToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id')
      .eq('token', sessionToken)
      .single()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, ...payload } = await req.json()

    // Create API key
    if (action === 'create') {
      const { keyName, customKey } = payload

      if (!keyName || keyName.length < 3) {
        return new Response(JSON.stringify({ error: 'Key name must be at least 3 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check if user has permission (Viewers can't create keys)
      const { data: memberships } = await supabase
        .from('group_members')
        .select('user_groups(permissions)')
        .eq('user_id', session.user_id)

      const permissions = memberships?.flatMap((m: any) => m.user_groups?.permissions || []) || []
      
      if (!permissions.includes('create_keys') && !permissions.includes('admin')) {
        return new Response(JSON.stringify({ error: 'Permission denied. You need "create_keys" permission.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Generate or use custom key
      let keyData
      if (customKey && customKey.startsWith('oppodb_') && customKey.length >= 20) {
        const prefix = customKey.slice(0, 16)
        keyData = { key: customKey, prefix, hash: '' }
      } else {
        keyData = generateApiKey(keyName)
      }

      const { data, error } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: session.user_id,
          key_name: keyName,
          key_prefix: keyData.prefix,
          key_hash: keyData.hash || keyData.key // Store hash for validation
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        apiKey: {
          id: data.id,
          name: data.key_name,
          key: keyData.key,
          prefix: data.key_prefix,
          createdAt: data.created_at
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List API keys
    if (action === 'list') {
      const { data: keys } = await supabase
        .from('user_api_keys')
        .select('id, key_name, key_prefix, created_at, last_used_at, revoked_at')
        .eq('user_id', session.user_id)
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ keys: keys || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Revoke API key
    if (action === 'revoke') {
      const { keyId } = payload

      const { error } = await supabase
        .from('user_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId)
        .eq('user_id', session.user_id)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin: list all API keys
    if (action === 'admin-list') {
      const { data: adminSession } = await supabase
        .from('user_sessions')
        .select('user_id, auth_users(role)')
        .eq('token', sessionToken)
        .single()

      if (adminSession?.auth_users?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: keys } = await supabase
        .from('user_api_keys')
        .select('id, key_name, key_prefix, created_at, last_used_at, revoked_at, user_id, auth_users(email)')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ keys: keys || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
