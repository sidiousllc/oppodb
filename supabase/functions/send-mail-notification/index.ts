import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify user token
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { recipientUserId: string; subject: string; bodyText: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { recipientUserId, subject, bodyText } = body
  if (!recipientUserId || !subject || !bodyText) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use service role to look up recipient email
  const adminClient = createClient(supabaseUrl, supabaseServiceKey)

  const { data: recipientData, error: recipientError } = await adminClient.auth.admin.getUserById(recipientUserId)
  if (recipientError || !recipientData?.user?.email) {
    return new Response(JSON.stringify({ error: 'Recipient not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const recipientEmail = recipientData.user.email

  // Get sender display name
  const { data: senderProfile } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const senderName = senderProfile?.display_name || user.email?.split('@')[0] || 'Someone'

  // Generate a unique idempotency key for this mail notification
  const idempotencyKey = `mail-notification-${crypto.randomUUID()}`

  // Route through send-transactional-email which handles rendering,
  // suppression checks, unsubscribe tokens, and proper queue enqueuing
  const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateName: 'mail-notification',
      recipientEmail,
      idempotencyKey,
      templateData: {
        senderName,
        mailSubject: subject,
        mailPreview: bodyText.length > 200 ? bodyText.substring(0, 200) + '...' : bodyText,
      },
    }),
  })

  if (!sendResponse.ok) {
    const errorBody = await sendResponse.text()
    console.error('Failed to send mail notification', {
      status: sendResponse.status,
      error: errorBody,
    })
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
