/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'
const SITE_URL = 'https://ordb.lovable.app'

interface AccessApprovedProps {
  displayName?: string
}

const AccessApprovedEmail = ({ displayName }: AccessApprovedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your access request has been approved!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>✅ Access Approved</Heading>
        <Text style={text}>
          {displayName ? `Hi ${displayName},` : 'Hi there,'} great news — your access request to <strong>{SITE_NAME}</strong> has been approved by an administrator.
        </Text>
        <Text style={text}>
          You can now log in and start using the platform.
        </Text>
        <Button style={button} href={SITE_URL}>
          Log In Now
        </Button>
        <Text style={footer}>
          If you didn't request access, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccessApprovedEmail,
  subject: `Your ${SITE_NAME} access request has been approved`,
  displayName: 'Access request approved',
  previewData: { displayName: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#1a47a6', color: '#ffffff', fontSize: '13px', borderRadius: '0px', padding: '10px 20px', textDecoration: 'none', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif", display: 'inline-block' as const }
const footer = { fontSize: '11px', color: '#808080', margin: '30px 0 0' }
