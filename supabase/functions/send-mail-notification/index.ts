import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SITE_NAME = 'ordb'
const SENDER_DOMAIN = 'notify.oppodb.com'
const FROM_DOMAIN = 'notify.oppodb.com'

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

  // Build email HTML
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#c0c0c0;font-family:Tahoma,Geneva,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#c0c0c0;padding:24px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #808080;box-shadow:2px 2px 0 #000;">
        <tr>
          <td style="background:linear-gradient(90deg,#000080,#1084d0);padding:6px 12px;">
            <span style="color:#fff;font-size:14px;font-weight:bold;">📬 You've Got Mail!</span>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:13px;color:#333;">
              <strong>${senderName}</strong> sent you a message on <strong>${SITE_NAME}</strong>:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;border:1px solid #808080;margin:0 0 16px;">
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #c0c0c0;font-size:12px;color:#666;">
                  <strong>Subject:</strong> ${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </td>
              </tr>
              <tr>
                <td style="padding:12px;font-size:13px;color:#222;white-space:pre-wrap;">${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
              </tr>
            </table>
            <p style="margin:0;font-size:11px;color:#888;">
              Log in to <a href="https://oppodb.com" style="color:#000080;">oppodb.com</a> to reply.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#c0c0c0;padding:8px 12px;border-top:1px solid #808080;text-align:center;">
            <span style="font-size:10px;color:#666;">Sent from ${SITE_NAME}</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `${senderName} sent you a message on ${SITE_NAME}:\n\nSubject: ${subject}\n\n${bodyText}\n\nLog in to https://oppodb.com to reply.`

  // Enqueue the email
  const messageId = crypto.randomUUID()

  await adminClient.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'mail_notification',
    recipient_email: recipientEmail,
    status: 'pending',
  })

  const { error: enqueueError } = await adminClient.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      run_id: crypto.randomUUID(),
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: `New message from ${senderName}: ${subject}`,
      html,
      text,
      purpose: 'transactional',
      label: 'mail_notification',
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue mail notification', { error: enqueueError })
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
