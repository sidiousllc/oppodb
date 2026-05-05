// Legal policy content for OppoDB Holdings.
// Required by Paddle (Merchant of Record) for accepting payments.
// Review before publishing — adjust to match actual business operations.

export const LEGAL_COMPANY = {
  legalName: "OppoDB Holdings",
  tradingName: "OppoDB / ORO — Opposition Research Database",
  contactEmail: "support@oppodb.com",
  website: "https://oppodb.com",
  refundDays: 30,
  effectiveDate: "May 5, 2026",
} as const;

export type LegalDocId = "terms" | "privacy" | "refund" | "aup";

export const LEGAL_DOCS: Record<
  LegalDocId,
  { slug: string; title: string; icon: string; body: string }
> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    icon: "📜",
    body: `# Terms of Service

**Effective:** ${LEGAL_COMPANY.effectiveDate}

These Terms govern your use of the services provided by **${LEGAL_COMPANY.legalName}** ("we", "us", "our"), trading as ${LEGAL_COMPANY.tradingName}, available at ${LEGAL_COMPANY.website} (the "Service"). By creating an account, accessing, or using the Service, you agree to these Terms.

## 1. Who you are contracting with
You are entering into this agreement with ${LEGAL_COMPANY.legalName}. If you use the Service on behalf of an organization, you represent that you are authorized to bind that organization. Individual users must be of legal age to form a binding contract in their jurisdiction.

## 2. The Service
ORO is an opposition research and political intelligence platform. Features include candidate profiles, district intelligence, polling data, campaign finance, legislative tracking, AI-assisted research, and report exports. Specific features available depend on your subscription tier.

## 3. Accounts and credentials
You must provide accurate registration information and keep it updated. You are responsible for maintaining the confidentiality of your account credentials and for all activity occurring under your account. Notify us immediately of any unauthorized use.

## 4. Acceptable use
You must not misuse the Service. Prohibited activities include, without limitation:
- Unlawful, fraudulent, deceptive, or harassing activity
- Spam, unsolicited communications, or abuse of integrated communications features
- Infringing intellectual property, privacy, or publicity rights of any person
- Probing, scanning, or testing system vulnerability; bypassing authentication; introducing malware
- Scraping, mirroring, or systematically downloading content beyond what your plan permits
- Reselling, sublicensing, or providing access to non-authorized third parties
- Using outputs to defame, threaten, harass, or unlawfully target individuals
- Using AI features to generate disinformation, deepfakes, or content impersonating real people without consent

See our **Acceptable Use Policy** for further detail. Repeated or serious violations will result in termination.

## 5. Intellectual property
We and our licensors retain all rights, title, and interest in and to the Service, including its software, data compilations, design, and brand. Subject to your compliance with these Terms, we grant you a limited, revocable, non-exclusive, non-transferable license to access and use the Service for your internal business or personal research purposes within your selected plan. Content you upload remains yours; you grant us a limited license to host, store, process, and display it solely to provide the Service.

## 6. Restrictions
You will not (a) reverse engineer, decompile, or attempt to derive source code, except to the extent permitted by applicable law; (b) circumvent technical limits or rate limits; (c) use the Service to build a competing product; (d) remove proprietary notices.

## 7. Service availability
We work to keep the Service available and reliable, but we do not warrant that it will be uninterrupted, error-free, or that defects will be corrected. Maintenance windows, third-party outages, and force majeure events may affect availability.

## 8. Payments, subscriptions, taxes, and refunds
Our order process is conducted by our online reseller **Paddle.com**. Paddle.com is the **Merchant of Record** for all our orders. Paddle provides all customer service inquiries and handles returns. Payment, billing, tax, cancellation, and refund mechanics are governed by [Paddle's Buyer Terms](https://www.paddle.com/legal/checkout-buyer-terms). See our **Refund Policy** for our money-back guarantee window.

Subscriptions renew automatically at the end of each billing period until canceled. You can cancel at any time through the customer portal; access continues until the end of the paid period.

## 9. Suspension and termination
We may suspend or terminate your access for: (a) material breach of these Terms; (b) non-payment; (c) suspected fraud or security risk; (d) repeated or serious violations of the Acceptable Use Policy; or (e) when required by law. You may close your account at any time. Upon termination, your right to use the Service ends. We may retain account data for a reasonable period to comply with legal obligations.

## 10. Disclaimer of warranties
To the fullest extent permitted by law, the Service is provided **"as is"** and **"as available"** without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, accuracy, or quiet enjoyment. Research outputs, AI-generated content, polling figures, and forecasts are informational; you are responsible for verifying material facts before relying on them.

## 11. Limitation of liability
To the fullest extent permitted by law, our aggregate liability arising out of or relating to these Terms or the Service will not exceed the fees you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, special, consequential, or exemplary damages, including loss of profits, data, goodwill, or business opportunity. Nothing in these Terms excludes liability for fraud, willful misconduct, death, personal injury, or any other liability that cannot be limited by law.

## 12. Indemnification
You will defend, indemnify, and hold harmless ${LEGAL_COMPANY.legalName} from claims arising out of (a) content you upload or publish through the Service; (b) your unlawful or infringing use of the Service; or (c) your breach of these Terms.

## 13. AI features
The Service uses AI models to generate research summaries, candidate issue analyses, and other content. AI outputs may be inaccurate, incomplete, or biased and are not a substitute for legal, electoral, financial, or professional advice. You are responsible for your prompts, your verification of outputs, and your use of generated content. We may filter, refuse, or remove outputs that violate the Acceptable Use Policy.

## 14. Changes to the Service or Terms
We may update the Service and these Terms from time to time. Material changes will be communicated via the Service or email. Continued use after changes take effect constitutes acceptance.

## 15. Governing law and disputes
These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-laws principles. The courts located in Delaware will have exclusive jurisdiction over disputes, except that either party may seek injunctive relief in any court of competent jurisdiction to protect its intellectual property.

## 16. Assignment
You may not assign these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition, or sale of assets.

## 17. Force majeure
Neither party is liable for delay or failure to perform caused by events beyond reasonable control (acts of God, war, civil unrest, labor disputes, internet or utility failures, governmental acts).

## 18. Contact
${LEGAL_COMPANY.legalName} — ${LEGAL_COMPANY.contactEmail}
`,
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Notice",
    icon: "🔒",
    body: `# Privacy Notice

**Effective:** ${LEGAL_COMPANY.effectiveDate}

This Notice explains how **${LEGAL_COMPANY.legalName}** ("we"), trading as ${LEGAL_COMPANY.tradingName}, collects and uses personal data when you use ${LEGAL_COMPANY.website} (the "Service"). We act as the **data controller** for personal data described below.

## 1. Categories of personal data we collect
- **Account data:** name, display name, email, password hash, role, tier, organization affiliation
- **Authentication data:** session tokens, OAuth identifiers (e.g., Google), login timestamps, IP address used to sign in
- **Profile and preference data:** theme, layout preferences, sidebar choices
- **Usage and telemetry:** pages visited, features used, search queries, error logs, device and browser metadata, approximate IP-based location, page-load performance
- **Research workspace content:** notes, tags, saved candidates, custom reports, war-room messages, uploaded files
- **Communications data:** support requests, transactional emails (delivery, opens), newsletter preferences
- **Subscription data:** subscription tier, status, period dates, Paddle customer and subscription IDs (the **payment card and billing address are collected directly by Paddle** — we do not see or store full card numbers)

## 2. Why we use your data and our legal basis
| Purpose | Legal basis |
|---|---|
| Create and operate your account, deliver the Service | Contract performance |
| Authenticate you, prevent fraud, secure the Service | Legitimate interests; legal obligation |
| Process subscriptions and entitlements (via Paddle) | Contract performance |
| Send transactional emails (receipts, alerts, password resets) | Contract performance |
| Send product updates and marketing where you have opted in | Consent (you can withdraw at any time) |
| Improve features, debug, measure performance | Legitimate interests |
| Respond to support requests | Contract performance; legitimate interests |
| Comply with legal, tax, and regulatory obligations | Legal obligation |

## 3. Who we share data with
- **Paddle** — Merchant of Record for all sales; processes payments, subscription management, tax compliance, invoicing, and refunds. See [Paddle's Privacy Notice](https://www.paddle.com/legal/privacy).
- **Hosting and backend infrastructure** — cloud providers that host the database, edge functions, and storage used to deliver the Service.
- **Email delivery** — transactional email service provider used to send authentication, billing, and notification emails.
- **Analytics and error monitoring** — providers that help us understand product usage and surface bugs (no sale of personal data).
- **AI model providers** — when you use AI-assisted features, the prompts and selected research context are sent to model providers solely to generate the response.
- **Authentication provider** — Google OAuth (only if you sign in with Google).
- **Professional advisers** — legal, accounting, and compliance advisers under confidentiality obligations.
- **Authorities** — when required by law, lawful request, or to protect rights, safety, or the integrity of the Service.

We do **not** sell personal data.

## 4. International data transfers
Our infrastructure is hosted in the United States and the European Union. Where data is transferred outside the UK/EEA, we rely on appropriate safeguards such as Standard Contractual Clauses or adequacy decisions.

## 5. Retention
- Account and subscription data: kept for as long as your account is active and for a reasonable period after closure to comply with legal and tax obligations (typically 6–7 years for financial records).
- Usage and telemetry: typically up to 24 months.
- Support messages: typically up to 36 months.
- Backups: rotated and overwritten on a routine cycle.
We delete or anonymize data when it is no longer needed for the purposes above.

## 6. Your rights
Depending on where you live, you may have the right to: access your data, correct inaccuracies, request deletion or restriction, object to processing, request portability, and withdraw consent. UK/EEA users have these rights under the UK GDPR / GDPR and may complain to their supervisory authority. We respond to requests within one month.

To exercise rights, email **${LEGAL_COMPANY.contactEmail}**.

## 7. Security
We use appropriate technical and organisational measures including TLS in transit, encryption at rest for sensitive fields, AES-256-GCM for stored API keys and offline caches, role-based access control, audit logging, and least-privilege service accounts. No system is perfectly secure; please use a strong password and notify us of any suspicious activity.

## 8. Cookies and similar technologies
We use cookies and local storage that are **strictly necessary** to authenticate you, remember preferences, and secure the Service. We also use limited analytics and performance cookies to understand and improve usage. You can manage cookies through your browser; disabling essential cookies will prevent the Service from functioning.

## 9. Children
The Service is not directed to children under 16, and we do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it.

## 10. Changes
We may update this Notice. Material changes will be communicated via the Service or email.

## 11. Contact
${LEGAL_COMPANY.legalName} — ${LEGAL_COMPANY.contactEmail}
`,
  },

  refund: {
    slug: "refund",
    title: "Refund Policy",
    icon: "💸",
    body: `# Refund Policy

**Effective:** ${LEGAL_COMPANY.effectiveDate}

We want you to be happy with ${LEGAL_COMPANY.tradingName}.

## ${LEGAL_COMPANY.refundDays}-day money-back guarantee
We offer a **${LEGAL_COMPANY.refundDays}-day money-back guarantee** on subscription purchases. If you are not satisfied, you may request a full refund within ${LEGAL_COMPANY.refundDays} days of your initial purchase date.

## How to request a refund
Refunds are processed by our payment provider, **Paddle**, the Merchant of Record for all our orders. To request a refund:

1. Visit **[paddle.net](https://paddle.net)** and look up your order using the email address you used at checkout, or
2. Email us at **${LEGAL_COMPANY.contactEmail}** and we will assist with the request.

## Renewals and one-time purchases
Subscription renewals (after the initial term) and one-time report unlocks are reviewed on a case-by-case basis. If a renewal charged unexpectedly because you forgot to cancel, contact us within 14 days and we will work with you in good faith.

## Cancellation
You can cancel a subscription at any time from the **Manage / Cancel** option in your billing window. Cancellation stops future renewals — you keep access until the end of the current billing period.

## Chargebacks
Please contact us before initiating a chargeback. Most issues can be resolved quickly through Paddle or directly with our support team.

## Contact
${LEGAL_COMPANY.legalName} — ${LEGAL_COMPANY.contactEmail}
`,
  },

  aup: {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    icon: "🛡️",
    body: `# Acceptable Use Policy

**Effective:** ${LEGAL_COMPANY.effectiveDate}

This Acceptable Use Policy ("AUP") supplements our Terms of Service and applies to all users of ${LEGAL_COMPANY.tradingName} provided by ${LEGAL_COMPANY.legalName}.

## 1. Lawful, ethical research
ORO supports political research, civic engagement, and journalism. You agree to use the Service only for lawful purposes and in compliance with all applicable election, campaign-finance, lobbying, data-protection, and intellectual-property laws.

## 2. Prohibited content and conduct
You may not use the Service to:
- Harass, threaten, defame, dox, or stalk any individual
- Generate or distribute disinformation, fabricated quotes, or synthetic media (deepfakes) impersonating real people without clear disclosure and consent where required
- Produce content that incites violence, hatred, or discrimination against a protected group
- Engage in voter suppression, intimidation, or interference with the electoral process
- Coordinate or facilitate illegal activity, fraud, or unauthorized political coordination
- Infringe copyright, trademark, trade secret, publicity, or privacy rights
- Process special-category personal data (health, religion, sexual orientation, biometric, genetic) without a lawful basis
- Scrape, harvest, or extract data from third-party services in violation of their terms or rate limits

## 3. Security and integrity
You may not:
- Probe, scan, or test the vulnerability of the Service or any related infrastructure
- Bypass authentication, authorization, rate limits, or technical measures
- Introduce malware, ransomware, worms, or any malicious code
- Interfere with other users' access or with the integrity of stored data
- Reverse engineer the Service except as permitted by law
- Use automated tools, bots, or scrapers in a way that exceeds documented API limits or harms performance

## 4. AI features
When using AI-assisted features:
- You are responsible for your prompts and how you use outputs
- You will not jailbreak the model, attempt to extract system prompts, or use the model to generate content prohibited above
- You will verify factual claims before relying on or publishing them
- You will not use AI outputs to impersonate real individuals in misleading ways

## 5. Sharing and access
- Accounts are for the named user or organization; do not share credentials
- Premium features and exports are licensed to your account; do not redistribute datasets or reports outside your organization unless your plan explicitly permits it
- API and MCP access keys are sensitive; rotate immediately if leaked

## 6. Reporting abuse
If you believe content or activity on the Service violates this AUP, report it to **${LEGAL_COMPANY.contactEmail}**. Include URLs, screenshots, and a description of the issue. Rights-holders may submit takedown requests to the same address.

## 7. Enforcement
Violations may result in content removal, output filtering, feature throttling, account suspension, or termination, and we may refer serious violations to law enforcement. We reserve the right to investigate and cooperate with authorities when required by law. Repeated infringement of intellectual-property rights will result in account termination.

## 8. Contact
${LEGAL_COMPANY.legalName} — ${LEGAL_COMPANY.contactEmail}
`,
  },
};

export const LEGAL_DOC_LIST: { id: LegalDocId; slug: string; title: string; icon: string }[] =
  Object.entries(LEGAL_DOCS).map(([id, d]) => ({
    id: id as LegalDocId,
    slug: d.slug,
    title: d.title,
    icon: d.icon,
  }));
