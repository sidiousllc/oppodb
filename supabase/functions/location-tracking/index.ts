import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getErrorMessage } from "../_shared/errors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Verify API key or session
async function verifyRequest(req: Request): Promise<{ userId: string | null; isValid: boolean }> {
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key')
  const sessionToken = req.headers.get('Authorization')?.replace('Bearer ', '')

  if (!apiKey && !sessionToken) {
    return { userId: null, isValid: false }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check session first
  if (sessionToken) {
    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id')
      .eq('token', sessionToken)
      .single()

    if (session) {
      return { userId: session.user_id, isValid: true }
    }
  }

  // Check API key
  if (apiKey) {
    // Find key by prefix match
    const prefix = apiKey.slice(0, 16)
    const { data: keyData } = await supabase
      .from('user_api_keys')
      .select('id, user_id, revoked_at')
      .ilike('key_prefix', `${prefix}%`)
      .is('revoked_at', null)
      .single()

    if (keyData) {
      // Update last used
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyData.id)

      return { userId: keyData.user_id, isValid: true }
    }
  }

  return { userId: null, isValid: false }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, isValid } = await verifyRequest(req)

    // --- GET: Retrieve location data ---
    if (req.method === 'GET' || (req.method === 'POST' && !userId)) {
      // Public endpoint for getting location data - requires valid API key
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Valid API key or session required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const url = new URL(req.url)
      const deviceId = url.searchParams.get('device')
      const limit = parseInt(url.searchParams.get('limit') || '100')

      let query = supabase
        .from('location_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      const { data: locations, error } = await query

      if (error) throw error

      // Get device labels
      const { data: labels } = await supabase.from('device_labels').select('*')

      // Map labels to locations
      const enrichedLocations = (locations || []).map(loc => ({
        ...loc,
        label: labels?.find(l => l.device_id === loc.device_id)?.label || null,
        color: labels?.find(l => l.device_id === loc.device_id)?.color || '#3B82F6'
      }))

      return new Response(JSON.stringify({
        locations: enrichedLocations,
        total: enrichedLocations.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- POST: Send location update ---
    const body = await req.json()

    // Require valid API key for sending data
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Valid API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { deviceId, latitude, longitude, accuracy, timestamp, androidVersion, deviceModel, carrier, phoneNumber } = body

    if (!deviceId || latitude === undefined || longitude === undefined) {
      return new Response(JSON.stringify({ error: 'deviceId, latitude, and longitude required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if device tracking is enabled for this user
    if (userId) {
      const { data: settings } = await supabase
        .from('device_settings')
        .select('tracking_enabled')
        .eq('device_id', deviceId)
        .eq('user_id', userId)
        .single()

      if (settings && !settings.tracking_enabled) {
        return new Response(JSON.stringify({ error: 'Tracking disabled for this device' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Insert location data
    const { data, error } = await supabase
      .from('location_data')
      .insert({
        device_id: deviceId,
        user_id: userId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        timestamp: timestamp || Date.now(),
        android_version: androidVersion || null,
        device_model: deviceModel || null,
        carrier: carrier || null,
        phone_number: phoneNumber || null
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      id: data.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
