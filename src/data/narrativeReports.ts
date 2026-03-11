export interface NarrativeReport {
  name: string;
  slug: string;
  content: string;
}

export const narrativeReports: NarrativeReport[] = [
  { name: "Blowing Up the Debt and Deficit", slug: "blowing-up-the-debt-and-deficit", content: `Trump's policies increased federal deficit while raising costs for families. His "One Big Beautiful Bill" adds around $3.2–$3.6 trillion to deficits over ten years, mostly from large tax cuts that aren't fully paid for. At the same time, broad new tariffs act like a tax on consumers, pushing up prices and cutting purchasing power. Cuts to IRS funding further reduce revenue collection, which widens the deficit and lets more tax cheating slip through. Other policy moves shift costs onto households—like ending the credit-card late fee cap, restarting student-loan interest and collections, and cutting Medicaid/CHIP—leaving more people uninsured and paying more out of pocket.

### Key Points:
- The reconciliation law will increase primary deficits by about $3.2 trillion over 2025–2034, with tax cuts driving $4.3 trillion in revenue loss and only $1.4 trillion in offsets
- The Tax Policy Center estimates a 10% worldwide tariff plus 60% on Chinese goods lowers average after-tax household income by about $1,800 in 2025
- Nearly half of large U.S. firms already raised prices due to tariffs and most expect further hikes
- IRS funding cuts reduce revenue collection by $400–500 billion over 10 years
- The credit-card late fee cap was struck down, reversing $10 billion/year in consumer savings
- Student loan interest restarted and aggressive collections resumed, with 5.3 million accounts in default` },

  { name: "Hiding the Ball on Presidential Health", slug: "presidential-health-transparency", content: `Since January 2025, the White House has shared limited and selective information about Trump's health, often delaying details or offering short summaries instead of full records. He had a full physical in April and another checkup in October, which raised questions because it came only six months later.

### Key Points:
- After Trump's April physical, the White House released only a three-page summary declaring Trump "fully fit" rather than providing underlying records
- In October, Trump made a second Walter Reed visit just six months after the April exam — the White House issued only a brief memo lacking April's detail level
- When reporters asked whether October's "advanced imaging" included an MRI, the press secretary declined to confirm; Trump later acknowledged an MRI but refused to say why
- Trump was diagnosed with chronic venous insufficiency causing leg swelling, with a visible hand bruise attributed to handshaking and aspirin use
- French President Macron corrected Trump on a basic fact in a February meeting, adding to concerns about accuracy and judgment
- Polling shows most Americans expect presidents to release health information that could affect their ability to serve` },

  { name: "Trump and MAGA's War on Rural Hospitals and Care", slug: "war-on-rural-health-care", content: `In 2025, a series of federal moves made it harder for people in rural areas to get basic health care. Funding freezes delayed money to community health centers and cut off Title X services like birth control, STI testing, and cancer screenings in several states.

### Key Points:
- A White House-directed grant pause caused community health centers in at least 10 states to lose or delay access to federal funds — CHCs serve more than 32 million people
- HHS withheld roughly $65.8 million in Title X grants, leaving seven states with no Title X-funded services
- The 2025 reconciliation law's Medicaid work requirements will cause 7.6 million Americans to lose Medicaid coverage, with rural adults particularly vulnerable
- Navigator funding was slashed 90%, from $98.7 million to $10 million, just ahead of open enrollment
- Rural areas with 20% or more of residents on Medicaid (over 600 counties) face the greatest loss of coverage and provider revenue
- Visa processing slowdowns and new fees threatened the pipeline of international medical graduates who serve as 28% of physicians in health professional shortage areas
- More than 150 rural hospitals have closed since 2010, with more expected due to these cuts` },

  { name: "War on Homeowners", slug: "war-on-homeowners", content: `Trump and Republican policies are making it harder and more expensive for families to own a home. Tariffs on lumber, cabinets, and other goods raise building and repair costs, adding thousands to the price of a typical house.

### Key Points:
- New tariffs of 10% on lumber and 25% on kitchen cabinets could add $7,500–$10,000 to the cost of an average new home
- Crackdowns on law-abiding immigrant workers shrink the construction workforce — roughly a third of U.S. construction workers are immigrants
- Mass deportations would worsen the housing shortage by reducing new-home supply
- Rollbacks of energy standards and paused rebates mean bigger utility bills and fewer discounts for upgrades
- Weaker disaster rules and a possible flood-insurance lapse increase risk and can delay home sales
- Uncertainty around Fannie Mae and Freddie Mac privatization could raise mortgage rates by 60–90 basis points, adding $1,200–$1,800 per year to a $300,000 mortgage
- The administration blocked $150 million in clean energy programs and weatherization grants for homeowners` },
];

export function searchNarrativeReports(query: string): NarrativeReport[] {
  if (!query.trim()) return narrativeReports;
  const q = query.toLowerCase();
  return narrativeReports.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.content.toLowerCase().includes(q)
  );
}
