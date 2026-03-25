/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ordb'
const SITE_URL = 'https://ordb.lovable.app'

interface WelcomeProps {
  displayName?: string
}

const WelcomeEmail = ({ displayName }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — You're In!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🎉 Welcome to {SITE_NAME}!</Heading>
        <Text style={text}>
          {displayName ? `Hey ${displayName},` : 'Hey there,'} welcome to the Opposition Research Database. Your account is all set up and ready to go.
        </Text>
        <Text style={text}>
          Here's what you can explore:
        </Text>
        <Text style={listItem}>📋 <strong>Candidate Profiles</strong> — In-depth dossiers on every target</Text>
        <Text style={listItem}>🗺️ <strong>District Intelligence</strong> — Demographics, voting history, and Cook PVI</Text>
        <Text style={listItem}>📊 <strong>Polling &amp; Finance</strong> — Real-time data from FEC and state boards</Text>
        <Text style={listItem}>📬 <strong>In-App Mail</strong> — Secure messaging with your team</Text>
        <Button style={button} href={SITE_URL}>
          Log In to {SITE_NAME}
        </Button>
        <Text style={footer}>
          If you have questions, reach out to your team lead or admin.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}!`,
  displayName: 'Welcome email',
  previewData: { displayName: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 15px' }
const listItem = { fontSize: '12px', color: '#333333', lineHeight: '1.5', margin: '0 0 8px', paddingLeft: '8px' }
const button = { backgroundColor: '#1a47a6', color: '#ffffff', fontSize: '13px', borderRadius: '0px', padding: '10px 20px', textDecoration: 'none', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif", display: 'inline-block' as const, margin: '10px 0 20px' }
const footer = { fontSize: '11px', color: '#808080', margin: '20px 0 0' }
