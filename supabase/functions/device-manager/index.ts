import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify API key middleware
async function verifyRequest(req: Request): Promise<{ userId: string | null; role: string | null }> {
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key')
  const sessionToken = req.headers.get('Authorization')?.replace('Bearer ', '')

  if (!apiKey && !sessionToken) {
    return { userId: null, role: null }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  if (sessionToken) {
    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id, auth_users(role)')
      .eq('token', sessionToken)
      .single()

    if (session) {
      return { userId: session.user_id, role: session.auth_users?.role || null }
    }
  }

  if (apiKey) {
    // Validate API key
    const { data: keyData } = await supabase
      .from('user_api_keys')
      .select('user_id, revoked_at')
      .ilike('key_prefix', `${apiKey.slice(0, 12)}%`)
      .is('revoked_at', null)
      .single()

    if (keyData) {
      // Update last used
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyData.user_id)

      return { userId: keyData.user_id, role: 'user' }
    }
  }

  return { userId: null, role: null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, role } = await verifyRequest(req)
    const { action, ...payload } = await req.json()

    // --- Device Labels ---

    // Set device label
    if (action === 'set-label') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { deviceId, label, color, notes } = payload

      if (!deviceId || !label) {
        return new Response(JSON.stringify({ error: 'deviceId and label required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('device_labels')
        .upsert({
          device_id: deviceId,
          user_id: userId,
          label,
          color: color || '#3B82F6',
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, deviceLabel: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get device labels
    if (action === 'get-labels') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data } = await supabase
        .from('device_labels')
        .select('*')
        .eq('user_id', userId)

      return new Response(JSON.stringify({ labels: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete device label
    if (action === 'delete-label') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { deviceId } = payload

      await supabase
        .from('device_labels')
        .delete()
        .eq('device_id', deviceId)
        .eq('user_id', userId)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- Device Settings ---

    // Set device settings
    if (action === 'set-settings') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { deviceId, trackingEnabled, notifyRadius } = payload

      if (!deviceId) {
        return new Response(JSON.stringify({ error: 'deviceId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('device_settings')
        .upsert({
          device_id: deviceId,
          user_id: userId,
          tracking_enabled: trackingEnabled !== undefined ? trackingEnabled : true,
          notify_radius: notifyRadius || 100,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, settings: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get device settings
    if (action === 'get-settings') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { deviceId } = payload

      const { data } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', userId)
        .single()

      return new Response(JSON.stringify({ settings: data || { deviceId, tracking_enabled: true, notify_radius: 100 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get all devices for user
    if (action === 'get-devices') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get distinct device IDs that have sent data
      const { data: locations } = await supabase
        .from('location_data')
        .select('device_id, device_model, android_version')
        .order('timestamp', { ascending: false })

      // Extract unique devices
      const deviceMap = new Map()
      for (const loc of locations || []) {
        if (!deviceMap.has(loc.device_id)) {
          deviceMap.set(loc.device_id, {
            deviceId: loc.device_id,
            deviceModel: loc.device_model,
            androidVersion: loc.android_version,
            lastSeen: loc.timestamp
          })
        }
      }

      // Get labels for these devices
      const { data: labels } = await supabase
        .from('device_labels')
        .select('*')
        .eq('user_id', userId)

      // Get settings for these devices
      const { data: settings } = await supabase
        .from('device_settings')
        .select('*')
        .eq('user_id', userId)

      const devices = Array.from(deviceMap.values()).map(d => ({
        ...d,
        label: labels?.find(l => l.device_id === d.deviceId)?.label || null,
        color: labels?.find(l => l.device_id === d.deviceId)?.color || '#3B82F6',
        notes: labels?.find(l => l.device_id === d.deviceId)?.notes || null,
        trackingEnabled: settings?.find(s => s.device_id === d.deviceId)?.tracking_enabled ?? true,
        notifyRadius: settings?.find(s => s.device_id === d.deviceId)?.notify_radius || 100
      }))

      return new Response(JSON.stringify({ devices }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin: list all devices
    if (action === 'admin-get-devices' && role === 'admin') {
      const { data: locations } = await supabase
        .from('location_data')
        .select('device_id, device_model, android_version, timestamp')
        .order('timestamp', { ascending: false })

      const deviceMap = new Map()
      for (const loc of locations || []) {
        if (!deviceMap.has(loc.device_id)) {
          deviceMap.set(loc.device_id, {
            deviceId: loc.device_id,
            deviceModel: loc.device_model,
            androidVersion: loc.android_version,
            lastSeen: loc.timestamp,
            totalPoints: 0
          })
        }
        deviceMap.get(loc.device_id).totalPoints++
      }

      const { data: labels } = await supabase.from('device_labels').select('*')

      const devices = Array.from(deviceMap.values()).map(d => ({
        ...d,
        label: labels?.find(l => l.device_id === d.deviceId)?.label || null,
        color: labels?.find(l => l.device_id === d.deviceId)?.color || '#3B82F6'
      }))

      return new Response(JSON.stringify({ devices }), {
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