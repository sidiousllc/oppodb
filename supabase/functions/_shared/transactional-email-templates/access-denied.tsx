/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'
const SITE_URL = 'https://ordb.lovable.app'

interface AccessDeniedProps {
  displayName?: string
  reason?: string
}

const AccessDeniedEmail = ({ displayName, reason }: AccessDeniedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your {SITE_NAME} access request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🚫 Access Request Denied</Heading>
        <Text style={text}>
          {displayName ? `Hi ${displayName},` : 'Hi there,'} unfortunately your access request to <strong>{SITE_NAME}</strong> was not approved at this time.
        </Text>
        {reason && (
          <Text style={reasonBlock}>
            <strong>Reason:</strong> {reason}
          </Text>
        )}
        <Text style={text}>
          If you believe this was an error, please contact your team administrator or reach out at{' '}
          <Link href={SITE_URL} style={link}>{SITE_URL}</Link>.
        </Text>
        <Text style={footer}>
          This is an automated notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccessDeniedEmail,
  subject: `Update on your ${SITE_NAME} access request`,
  displayName: 'Access request denied',
  previewData: { displayName: 'Jane', reason: 'Invitation required for this deployment.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 25px' }
const reasonBlock = { fontSize: '12px', color: '#333333', lineHeight: '1.5', margin: '0 0 25px', padding: '10px 12px', backgroundColor: '#f0f0f0', border: '1px solid #808080' }
const link = { color: '#1a47a6', textDecoration: 'underline' }
const footer = { fontSize: '11px', color: '#808080', margin: '30px 0 0' }
