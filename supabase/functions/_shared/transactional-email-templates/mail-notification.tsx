/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'
const SITE_URL = 'https://ordb.lovable.app'

interface MailNotificationProps {
  senderName?: string
  mailSubject?: string
  mailPreview?: string
}

const MailNotificationEmail = ({ senderName, mailSubject, mailPreview }: MailNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>📬 You've Got Mail from {senderName || 'someone'} on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📬 You've Got Mail!</Heading>
        <Text style={text}>
          <strong>{senderName || 'Someone'}</strong> sent you a message on <strong>{SITE_NAME}</strong>:
        </Text>
        <Container style={mailBox}>
          {mailSubject && (
            <Text style={mailSubjectStyle}>
              <strong>Subject:</strong> {mailSubject}
            </Text>
          )}
          {mailPreview && (
            <Text style={mailPreviewStyle}>{mailPreview}</Text>
          )}
        </Container>
        <Button style={button} href={SITE_URL}>
          Read &amp; Reply
        </Button>
        <Text style={footer}>
          Log in to {SITE_NAME} to view the full message and reply.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MailNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New message from ${data.senderName || 'someone'}: ${data.mailSubject || '(no subject)'}`,
  displayName: 'In-app mail notification',
  previewData: { senderName: 'John', mailSubject: 'Opposition research update', mailPreview: 'Check out the latest filing data for MN-02...' },
} satisfies TemplateEntry

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 15px' }
const mailBox = { backgroundColor: '#f0f0f0', border: '1px solid #808080', padding: '0', margin: '0 0 16px' }
const mailSubjectStyle = { fontSize: '12px', color: '#666666', padding: '8px 12px', margin: '0', borderBottom: '1px solid #c0c0c0' }
const mailPreviewStyle = { fontSize: '13px', color: '#222222', padding: '12px', margin: '0', whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#1a47a6', color: '#ffffff', fontSize: '13px', borderRadius: '0px', padding: '10px 20px', textDecoration: 'none', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif", display: 'inline-block' as const }
const footer = { fontSize: '11px', color: '#808080', margin: '20px 0 0' }
