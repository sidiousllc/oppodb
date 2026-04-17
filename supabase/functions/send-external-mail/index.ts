import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { template as externalMailTemplate } from '../_shared/transactional-email-templates/external-user-mail.tsx'

// Configuration — must match send-transactional-email
const SITE_NAME = 'ordb'
const SENDER_DOMAIN = 'notify.oppodb.com'
// User-facing alias domain. Must be a verified sender for the email provider.
// notify.oppodb.com is the verified subdomain so we send AS username@notify.oppodb.com
// but display the From header using oppodb.com via FROM_DOMAIN.
const FROM_DOMAIN = 'oppodb.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function slugifyUsername(input: string): string {
  const base = (input || '').toLowerCase().trim()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
  return base.slice(0, 40) || 'user'
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user || !user.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse body
  let recipientEmail = ''
  let mailSubject = ''
  let mailBody = ''
  try {
    const b = await req.json()
    recipientEmail = String(b.recipientEmail || '').trim()
    mailSubject = String(b.subject || '').trim().slice(0, 200)
    mailBody = String(b.body || '').trim().slice(0, 5000)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return new Response(JSON.stringify({ error: 'Valid recipientEmail is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!mailSubject || !mailBody) {
    return new Response(JSON.stringify({ error: 'subject and body are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey)

  // Sender identity
  const { data: profile } = await admin
    .from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const senderName = (profile?.display_name as string | undefined) || user.email.split('@')[0]
  const senderUsername = slugifyUsername(profile?.display_name || user.email.split('@')[0])
  const senderReplyEmail = user.email

  const normalizedRecipient = recipientEmail.toLowerCase()

  // Suppression check
  const { data: suppressed } = await admin
    .from('suppressed_emails').select('id').eq('email', normalizedRecipient).maybeSingle()
  if (suppressed) {
    return new Response(JSON.stringify({ success: false, reason: 'email_suppressed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Unsubscribe token (one per recipient)
  let unsubscribeToken: string
  const { data: existing } = await admin
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalizedRecipient).maybeSingle()
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token as string
  } else if (!existing) {
    unsubscribeToken = generateToken()
    await admin.from('email_unsubscribe_tokens').upsert(
      { token: unsubscribeToken, email: normalizedRecipient },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    const { data: stored } = await admin
      .from('email_unsubscribe_tokens').select('token').eq('email', normalizedRecipient).maybeSingle()
    unsubscribeToken = (stored?.token as string) || unsubscribeToken
  } else {
    return new Response(JSON.stringify({ success: false, reason: 'email_suppressed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Render template
  const props = { senderName, senderUsername, senderReplyEmail, mailSubject, mailBody }
  const html = await renderAsync(React.createElement(externalMailTemplate.component, props))
  const text = await renderAsync(React.createElement(externalMailTemplate.component, props), { plainText: true })

  const messageId = crypto.randomUUID()
  const idempotencyKey = `external-mail-${user.id}-${messageId}`

  // From: username@oppodb.com (display), with sender_domain = verified subdomain
  const fromAddress = `${senderName} <${senderUsername}@${FROM_DOMAIN}>`

  await admin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'external-user-mail',
    recipient_email: recipientEmail,
    status: 'pending',
    metadata: { sender_user_id: user.id, sender_username: senderUsername },
  })

  const { error: enqueueError } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: fromAddress,
      reply_to: senderReplyEmail,
      sender_domain: SENDER_DOMAIN,
      subject: mailSubject,
      html,
      text,
      purpose: 'transactional',
      label: 'external-user-mail',
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue external mail', { error: enqueueError })
    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'external-user-mail',
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ success: true, queued: true, from: fromAddress, replyTo: senderReplyEmail }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
