/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as accessApproved } from './access-approved.tsx'
import { template as accessDenied } from './access-denied.tsx'
import { template as mailNotification } from './mail-notification.tsx'
import { template as inviteLink } from './invite-link.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'access-approved': accessApproved,
  'access-denied': accessDenied,
  'mail-notification': mailNotification,
  'invite-link': inviteLink,
}
