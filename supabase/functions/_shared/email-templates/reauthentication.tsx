/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#c0c0c0', fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }
const container = { padding: '20px 25px', backgroundColor: '#ffffff', border: '2px solid #808080' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 20px' }
const text = { fontSize: '13px', color: '#333333', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = { fontFamily: "'VT323', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#1a47a6', margin: '0 0 30px', letterSpacing: '4px' }
const footer = { fontSize: '11px', color: '#808080', margin: '30px 0 0' }
