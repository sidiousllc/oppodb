/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'
const SITE_URL = 'https://ordb.lovable.app'

interface InviteLinkProps {
  inviterName?: string
  inviteUrl?: string
  role?: string
}

const InviteLinkEmail = ({ inviterName, inviteUrl, role }: InviteLinkProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📩 You're Invited!</Heading>
        <Text style={text}>
          <strong>{inviterName || 'An administrator'}</strong> has invited you to join <strong>{SITE_NAME}</strong>
          {role && role !== 'user' ? ` as a ${role}` : ''}.
        </Text>
        <Text style={text}>
          Click the button below to accept the invitation and create your account.
        </Text>
        <Button style={button} href={inviteUrl || SITE_URL}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          This invitation link will expire. If you weren't expecting this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InviteLinkEmail,
  subject: `You've been invited to join ${SITE_NAME}`,
  displayName: 'Invite link',
  previewData: { inviterName: 'Admin', inviteUrl: 'https://ordb.lovable.app/auth?invite=abc123', role: 'premium' },
} satisfies TemplateEntry

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#1a47a6', color: '#ffffff', fontSize: '13px', borderRadius: '0px', padding: '10px 20px', textDecoration: 'none', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif", display: 'inline-block' as const }
const footer = { fontSize: '11px', color: '#808080', margin: '30px 0 0' }
