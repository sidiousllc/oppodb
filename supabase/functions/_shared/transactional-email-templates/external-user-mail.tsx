/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'

interface ExternalUserMailProps {
  senderName?: string
  senderUsername?: string
  senderReplyEmail?: string
  mailSubject?: string
  mailBody?: string
}

const ExternalUserMailEmail = ({
  senderName,
  senderUsername,
  senderReplyEmail,
  mailSubject,
  mailBody,
}: ExternalUserMailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{mailSubject || `New message from ${senderName || 'a user'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{mailSubject || 'New message'}</Heading>
        <Text style={meta}>
          From: <strong>{senderName || senderUsername || 'A user'}</strong>
          {senderUsername ? ` <${senderUsername}@oppodb.com>` : ''}
        </Text>
        {senderReplyEmail ? (
          <Text style={meta}>
            Reply directly to: <strong>{senderReplyEmail}</strong>
          </Text>
        ) : null}
        <Hr style={hr} />
        <Section>
          <Text style={bodyText}>{mailBody || ''}</Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Sent via {SITE_NAME}. Replies to this address are not monitored — please reply to the sender's address above.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ExternalUserMailEmail,
  subject: (data: Record<string, any>) =>
    (data?.mailSubject as string) || `New message from ${data?.senderName || 'a user'}`,
  displayName: 'External user mail',
  previewData: {
    senderName: 'Jane Doe',
    senderUsername: 'jane',
    senderReplyEmail: 'jane@example.com',
    mailSubject: 'Quick question',
    mailBody: 'Hi there,\n\nWanted to follow up on our last conversation.\n\nThanks!',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#000000', margin: '0 0 16px' }
const meta = { fontSize: '12px', color: '#55575d', margin: '0 0 6px' }
const bodyText = { fontSize: '14px', color: '#222222', lineHeight: '1.55', whiteSpace: 'pre-wrap' as const, margin: '12px 0' }
const hr = { borderColor: '#e5e5e5', margin: '16px 0' }
const footer = { fontSize: '11px', color: '#999999', margin: '20px 0 0' }
