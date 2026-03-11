import { initCandidates } from "./candidates";

// All candidate data pre-fetched from the Research Books MCP
const candidateData = [
  { name: "Andy Ogles", slug: "andy-ogles", content: `Andy Ogles fabricated his resume — claiming to be an economist after earning a C in his only economics course — and is now the subject of an active FBI criminal investigation after reporting a $320,000 campaign loan that was actually $20,000, triggering a unanimous 6-0 ethics referral for a full House investigation. Before Congress, he led the Americans for Prosperity campaign that killed Medicaid expansion for over 300,000 Tennesseans. He raised nearly $25,000 using a photo of his stillborn baby for a children's burial garden that was never built — and has never accounted for the money.

In Congress, his first bill sought to repeal the $35 insulin cap for seniors, he publicly declared he wants to "be the guy that kills" the ACA, and he called Medicaid recipients "losers in their mama's basement" the morning he voted for a bill that Nashville's mayor estimated would strip 62,000 of his own constituents of medical coverage.` },
  
  { name: "Anna Paulina Luna", slug: "anna-paulina-luna", content: `Anna Paulina Luna is the Republican U.S. Representative for Florida's 13th Congressional District. Known for her strong alignment with MAGA and the House Freedom Caucus.

**Key Vulnerabilities:**
- Support for Policies Driving Up Costs through Trump-era trade war and tariff policies
- Votes for Medicaid & Social Security Cuts risking health coverage for 34,000 district residents
- Extremism, Partisan Performance, and Divisive Rhetoric
- House Freedom Caucus alignment threatening government shutdowns
- Anti-Abortion Record including celebrating Roe v. Wade's overturning` },

  { name: "Ashley Hinson", slug: "ashley-hinson", content: `Ashley Hinson is a Republican U.S. Representative from Iowa's 2nd Congressional District. A former broadcast journalist.

**Key Vulnerabilities:**
- Tariffs, Trade Policy, and Agricultural Interests: support for Trump-style tariffs hurting Iowa's agricultural economy
- Out of Touch With Cost Of Living Challenges: votes against minimum wage and worker protections
- Health Care: opposed capping insulin prices and negotiating Medicare drug prices
- Voted for bill estimated to kick 17 million Americans off health insurance` },

  { name: "Buddy Carter", slug: "buddy-carter", content: `Buddy Carter is a pharmacist worth an estimated $28-33 million whose own pharmacy distributed nearly 3 million opioid pills in Chatham County while his primary opioid supplier McKesson gave him $55,000 in campaign contributions. He accepted over $500,000 from the pharmaceutical industry while voting against $35 insulin caps — calling it a "socialist plan" — and voting for $625 billion in Medicaid cuts that could leave 750,000 Georgians uninsured.

He voted against every major job-creating law of the past decade — the Infrastructure Law, the CHIPS Act, and the Inflation Reduction Act — then took credit for the $7.6 billion Hyundai Metaplant those laws brought to his district.` },

  { name: "Carlos De La Cruz", slug: "carlos-de-la-cruz", content: `Carlos De La Cruz thought he could win the TX-35 election on family ties alone. He was eager to be "Trump's wingman" if elected to Congress. He has touted endorsements from President Donald Trump and Speaker Mike Johnson, even though their policies have caused pain for many Texans.

**Key Issues:**
- Backed Trump and Johnson's agenda of cutting health care for 17 million Americans
- Supported bill triggering major cuts to Medicare
- Supported tariffs raising prices and damaging Texas' economy
- Backed largest cut to SNAP in history` },

  { name: "Chuck Edwards", slug: "chuck-edwards", content: `Chuck Edwards is the Republican U.S. Representative for North Carolina. He voted for devastating health care cuts and defended Trump's tariffs that hurt North Carolina families and businesses.

**Key Vulnerabilities:**
- Voted for bill kicking 17 million Americans off health insurance
- Voted for massive Medicare cuts
- Defended tariffs hurting NC economy
- Supported DOGE cuts affecting services` },

  { name: "Dan Sullivan", slug: "dan-sullivan", content: `Dan Sullivan voted for the "One Big Beautiful Bill" that resulted in over 37,000 Alaskans losing health coverage. He claimed Alaska was in "good shape" regarding Medicaid funding, calling it a "big win" for rural hospitals. However, CMS capped usage of the $50 billion Rural Health Transformation Fund at 15%.

He voted for legislation that reduced funding for public broadcasting by $1.1 billion, endangering life-saving Native Alaskan radio stations. He supported tariffs that endangered the Alaskan economy and voted to cut food assistance programs.` },

  { name: "Derek Dooley", slug: "derek-dooley", content: `Derek Dooley is a nepo baby who couldn't win as a football coach for Georgia's arch-rival Tennessee. He was eager to strip away Georgians' health care and cheered Trump as he decimated Georgia's economy.

He mocked the ACA's enhanced premium subsidies and opposed their extension. An estimated 460,000 Georgians could lose their health insurance without the subsidies. He supported Trump's 'Big Beautiful Bill' and praised Trump's tariffs while dismissing Georgians' economic pain.` },

  { name: "Derrick Van Orden", slug: "derrick-van-orden", content: `Derrick Van Orden has been a headache for the district. He backed ripping health care from thousands of Wisconsinites, defended Trump's tariffs as they rattled farm country, cheered on cuts and chaos that slowed Social Security. He can't control his temper—from the Prairie du Chien library blow-up to berating teen Senate pages.

He promised no "single nickel reduction" in benefits, then voted for a bill kicking 17 million Americans off health insurance. He was the deciding vote to protect Trump's tariffs that were crushing Wisconsin farmers.` },

  { name: "Eli Crane", slug: "eli-crane", content: `Eli Crane is out-of-touch with his constituents because he doesn't live in the district he represents. He voted to cut critical health insurance programs and raise costs for Arizonans. He backed legislation that threatened the Medicaid benefits of more than 41,000 Arizonans in his district.

He repeatedly praised Trump's DOGE despite the risk it posed to constituents' Social Security benefits. He supported Trump's tariffs that were hurting small businesses and raising grocery prices. He even admitted he isn't a good congressman.` },

  { name: "Gabe Evans", slug: "gabe-evans", content: `Perpetual liar Gabe Evans ran on public safety and making life more affordable, then voted to cut services and raise costs on Coloradans. He voted to kick more than 29,000 Coloradans off their health insurance, for massive cuts to Medicare, and to make it harder for his neighbors to buy food.

He cast the deciding vote to protect Trump's tariffs. He cast the deciding vote to protect accused pedophiles named in the Epstein files. Then he stood by while Trump laid off Coloradans and gutted the Social Security agency.` },

  { name: "Jack Ciattarelli", slug: "jack-ciattarelli", content: `Jack Ciattarelli is the Republican candidate for Governor of New Jersey.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: supported 20-week abortion ban, opposed Planned Parenthood funding
- Called to Repeal and Replace the ACA, described Medicaid cuts as a "grand experiment"
- Wanted to Slash Pension Benefits
- Planned to Defund Public Schools
- Was Paid to Downplay Opioid Risks through Galen Publishing ($12.2M)` },

  { name: "Jason Miyares", slug: "jason-miyares", content: `Jason Miyares is the Virginia Attorney General running for Governor.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: supported anti-abortion pregnancy centers, overturning Roe v. Wade
- Threat to Democracy: supported legislation disenfranchising voters
- Supported Defunding Public Schools
- Anti-Equality Agenda: voted against banning conversion therapy
- Opposed Medicaid Expansion covering 400,000 Virginians` },

  { name: "Jeff Hurd", slug: "jeff-hurd", content: `Jeff Hurd is the Republican U.S. Representative for Colorado's 3rd Congressional District. He positions himself as a "mainstream" conservative but faces significant vulnerabilities.

**Key Vulnerabilities:**
- Tensions between establishment support and MAGA base
- Voted for House budget resolutions cutting Medicaid by hundreds of billions
- Supported tariffs threatening Colorado's agricultural sector
- Ambiguous stance on Trump created party loyalty questions` },

  { name: "Jeffrey Van Drew", slug: "jeff-van-drew", content: `Jeff Van Drew's policies have harmed everyday people:
- Backed tariffs that raise prices for families
- Backed Social Security cuts and a higher retirement age
- Backed abortion restrictions eliminating access for millions
- Cast a deciding vote to cut Medicaid and push millions off coverage
- Voted against Medicare drug reforms that lower costs for seniors
- Cast a deciding vote blocking immediate release of the Epstein files
- Took credit for earmarks in spending bills he voted against` },

  { name: "Jen Kiggans", slug: "jen-kiggans", content: `Jen Kiggans is the biggest threat to her constituents' well-being. She voted to kick Virginians off health coverage by supporting the Big Ugly Bill, breaking her numerous earlier promises. She called the bill a "win" despite a major hospital at risk of closing.

She sided with Big Pharma over Virginia seniors, opposed the Inflation Reduction Act. She told Virginians who lost their job due to DOGE cuts to "go out and get" another job. She ran away when asked why she refused to protect veterans from predatory payday lenders.` },

  { name: "John Cornyn", slug: "john-cornyn", content: `John Cornyn is the senior U.S. Senator from Texas.

**Key Vulnerabilities:**
- Voted to benefit large corporations with Trump Tax Cuts
- Bad for women and sought to restrict abortion rights
- Repeatedly failed to protect Social Security benefits
- Opposed Medicaid expansions and backed conservative reforms
- Backed Medicare cuts and privatization
- Key player in GOP's frenzy to repeal the ACA
- DC insider and creature of the swamp` },

  { name: "John King", slug: "john-king", content: `John King is a Republican candidate in Georgia.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: defended Texas' Heartbeat Law
- Blocked Access to Affordable Health Care through Georgia Access program
- Backed DOGE efforts at Georgians' expense
- Supported Trump's economy-wrecking tariffs
- Ran a notorious metro Atlanta speed trap
- Fear mongered and spread dangerous conspiracy theories` },

  { name: "John Lujan", slug: "john-lujan", content: `John Lujan has long pretended to be a moderate Republican but pledged to support Trump's agenda. That agenda has included ripping health care from 17 million Americans, making the largest cut to SNAP in history, and imposing tariffs that raised costs on Texans.

He supported school vouchers at the expense of public schools. He's an anti-choice extremist who supported Texas' near-total abortion ban. He even said if he had a daughter who was raped, he would tell her to carry the baby to term.` },

  { name: "Joni Ernst", slug: "joni-ernst", content: `Joni Ernst is the U.S. Senator from Iowa.

**Key Vulnerabilities:**
- Opposed Affordable Healthcare: voted 20+ times to repeal the ACA
- Anti-Abortion Extremist: supported 6-week ban, personhood amendment
- Supported DOGE and gutting of government services
- All in for Trump's tariffs despite previously opposing them
- Had romantic relationships with officials that lobbied her committee
- Supported privatizing Social Security` },

  { name: "Juan Ciscomani", slug: "juan-ciscomani", content: `Ciscomani pretended to be an independent voice for Arizona, but he was just another far-right Republican. He repeatedly promised to protect Arizonans' health care then voted to cut them. Nearly 32,000 Arizonans could lose health coverage.

He defended Trump's tariffs despite knowing they were hurting Arizona families. He voted six times to protect the tariffs, including casting the deciding vote. He defended DOGE as it attacked Social Security and federal workers.` },

  { name: "Ken Calvert", slug: "ken-calvert", content: `It's been 30 years, and all Calvert has delivered for Southern Californians is health care cuts, higher costs, and threats to their benefits, all while lining his own pockets.

He broke his promise and voted to take health coverage from Southern Californians. He voted for massive Medicare cuts then lied to constituents about it. He defended Trump's tariffs and made suspicious stock trades worth millions.` },

  { name: "Mariannette Miller-Meeks", slug: "mariannette-miller-meeks", content: `Miller-Meeks is wrong for IA-01. She voted to kick thousands of Iowans off their health insurance, to make it harder to afford groceries, and defended tariffs that crush Iowa farmers.

As a former doctor, she betrayed her patients by voting for devastating health care cuts. She was in the pocket of Big Pharma, accepting donations from insulin manufacturers while voting against insulin price caps. She faced a residency complaint about where she actually lives and votes.` },

  { name: "María Salazar", slug: "maria-salazar", content: `María Elvira Salazar is the Republican U.S. Representative for Florida's 27th Congressional District.

**Key Vulnerabilities:**
- Economic Trust and hypocrisy: voted against bipartisan initiatives then took credit
- Mixed messaging on health care
- Anti-Abortion Record despite diverse district
- Campaign finance scrutiny and personal financial troubles
- Inconsistent record on LGBTQ rights` },

  { name: "Mike Collins", slug: "mike-collins", content: `Mike Collins is a nepo baby Internet troll who wants to cut Medicaid, privatize Medicare, and raise the Social Security retirement age. He voted for a bill kicking 17 million Americans off health insurance. More than 500,000 Georgians could lose coverage.

He mocked the ACA's enhanced premium subsidies. He praised Trump's trade wars and told Americans to "trust the process." He claimed "blue collar people" do not "participate in the stock market."` },

  { name: "Mike Lawler", slug: "mike-lawler", content: `Mike Lawler sells a moderate brand, but he is a far-right gaslighter when it matters. He backed the largest Medicaid cut in history to fund tax cuts for billionaires after repeatedly promising the opposite.

He defended Trump's tariffs even while admitting they'd hurt New Yorkers. He cheered a plan that hollowed out Social Security service. He came up short on tax relief for New Yorkers and demonstrated poor judgement.` },

  { name: "Mike Rogers", slug: "mike-rogers", content: `Florida resident Mike Rogers has championed policies that have hurt Michigan families, small businesses and farmers.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: opposed Prop 3, supported Dobbs, tried to restrict IVF
- Bad for Michigan Seniors: voted to turn Medicare into a voucher program
- In the pocket of Big Pharma
- Supported bad trade deals harming Michigan's economy
- Used position to line his and his wife's pockets` },

  { name: "Nick Begich", slug: "nick-begich", content: `Nick Begich is the Republican representative serving Alaska.

**Key Vulnerabilities:**
- Questions about loyalty and authenticity from Democratic family legacy
- Controversies surrounding business practices and offshore employment
- Ties to conspiratorial publishing (Earthpulse Press)
- Social Security and health care voting record
- Reliance on personal wealth for campaigns` },

  { name: "Nick LaLota", slug: "nick-lalota", content: `Nick LaLota is a Republican Congressman representing New York's 1st District.

**Key Vulnerabilities:**
- Residency: does not live in NY-1, repeatedly criticized for it
- Ties to Trump and extreme partisanship despite marketing as independent
- Mixed record on policing and local government
- Voted in near lockstep with Republican majority (95%+ of the time)` },

  { name: "Pat Harrigan", slug: "pat-harrigan", content: `Pat Harrigan is a North Carolina Republican.

**Key Vulnerabilities:**
- Anti-Abortion Extremist
- Voted for the Big Ugly Bill hurting North Carolina
- Defended January 6 rioters
- Supported DOGE cuts harming NC
- Supported Trump's destructive tariffs
- District-hopped and lied about residency
- Endorsed by "Black Nazi" Mark Robinson` },

  { name: "Rich McCormick", slug: "rich-mccormick", content: `Rich McCormick is a Georgia Republican.

**Key Vulnerabilities:**
- Anti-Abortion Extremist: defended Georgia's Heartbeat Law
- Supported gutting Social Security, said Republicans have to "deny" it
- Opposed access to affordable health care including for seniors
- Backed DOGE efforts at Georgians' expense
- Supported Trump's economy-wrecking tariffs
- Compared angry town hall attendees to January 6th insurrectionists` },

  { name: "Rob Bresnahan", slug: "rob-bresnahan", content: `Rob Bresnahan sold a blue-collar brand but governs like another rich guy who profits from the swamp. He repeatedly promised to protect benefits then voted to kick thousands of Pennsylvanians off health coverage.

He was the deciding vote to protect Trump's tariffs. He played games on DOGE while Social Security backlogs grew. He broke his own pledge to ban congressional stock trading and bought a secret helicopter.` },

  { name: "Ryan Mackenzie", slug: "ryan-mackenzie", content: `Mackenzie is a MAGA-aligned partisan posing as a pragmatist. He backed ripping health coverage from thousands of Pennsylvanians, opposed making prescription drugs cheaper for Lehigh Valley seniors.

He was the deciding vote to protect Trump's tariffs. He got caught lying to women in his own community. More than 26,000 Pennsylvanians in his district could lose health coverage.` },

  { name: "Ryan Zinke", slug: "ryan-zinke", content: `Zinke talks like a Montana independent, but he votes like a big city swamp creature. He backed bills that kick thousands of Montanans off their health coverage, sided with tariffs that raise costs and hurt Montana farmers.

He already left one DC job in scandal. He twice cosponsored legislation to repeal the Inflation Reduction Act. He was the deciding vote to protect Trump's tariffs. An estimated 27,000 Montanans could lose health coverage.` },

  { name: "Scott Perry", slug: "scott-perry", content: `Scott Perry is out of step with Harrisburg–York–Cumberland. He spent his clout trying to overturn an election, pushing a national abortion ban, voting against infrastructure and veterans' care.

He voted for devastating health care cuts — more than 23,000 Pennsylvanians could lose coverage. He sided with Big Pharma over Pennsylvanians. He was the deciding vote to protect Trump's tariffs. He trafficked in antisemitic conspiracy theories.` },

  { name: "Susan Collins", slug: "susan-collins", content: `Susan Collins has proven unwilling to stand up to Trump in a state that has repeatedly rejected him.

**Key Vulnerabilities:**
- Bad for Mainers' health care: repeatedly voted against ACA tax credit extensions
- Directly curtailed abortion rights by confirming Supreme Court justices
- Accepted thousands from insurance conglomerates while Mainers face skyrocketing premiums
- More than 50,000 Mainers facing doubled, tripled, or quadrupled premiums` },

  { name: "Thom Tillis", slug: "thom-tillis", content: `Thom Tillis is the U.S. Senator from North Carolina.

**Key Vulnerabilities:**
- Had no spine and was a flip-flopper on multiple issues
- Anti-Abortion Extremist: supported personhood amendment
- Bad for affordable healthcare: voted 20 times to repeal ACA
- Supported tax cuts for the rich
- Supported Trump's tariffs
- Bad for workers: opposed unions, minimum wage
- Weak on defending Social Security` },

  { name: "Tom Barrett", slug: "tom-barrett", content: `Tom Barrett's record is out of step with Michiganders. He voted to take health care away from thousands of Michiganders while pretending to care about cuts. He signed a performative letter urging no Medicaid cuts, then voted for them.

He sided with Big Pharma over patients. He defended DOGE as it destabilized Social Security and NIH research funding. His campaign misled Black voters on when to vote.` },

  { name: "Tom Kean, Jr.", slug: "tom-kean", content: `Multimillionaire Tom Kean, Jr. is a flip-flopper who will say and do anything to get elected. He voted to take Medicaid benefits and food assistance away from constituents. He backed Trump's unpopular tariffs.

He swore to put his stocks in a blind trust then violated the STOCK Act. He was silent when DOGE threatened thousands of constituents' jobs. More than 20,000 New Jerseyans could lose health coverage.` },

  { name: "Winsome Earle-Sears", slug: "winsome-earle-sears", content: `Winsome Earle-Sears is a Virginia gubernatorial candidate.

**Key Vulnerabilities:**
- Supported firing federal workers and embraced DOGE
- Supports defunding public schools
- Anti-LGBTQ bigot: opposed same-sex marriage
- Blamed mass shootings on abortion
- Opposed red flag laws
- Mischaracterized Brown v. Board of Education` },

  { name: "Young Kim", slug: "young-kim", content: `Young Kim is a California Republican.

**Key Vulnerabilities:**
- Voted to protect Trump's tariffs damaging to Californians
- Voted for the largest Medicaid cut in history, betraying 74,000 people in her district that rely on Medicaid and CHIP` },

  { name: "Zach Nunn", slug: "zach-nunn", content: `Nunn isn't working for IA-03. He backed taking health care from thousands of Iowans, defended Trump tariffs that hit Iowa pocketbooks and farms.

He voted for devastating Medicaid cuts after claiming he was "fully committed" to protecting Medicaid. He spent $12,000 of taxpayer money on slick ads promoting the bill. He chose Big Pharma over cheaper prescription drugs for Iowa seniors. He was the deciding vote to protect Trump's tariffs.` },

  { name: "Abe Hamadeh", slug: "abe-hamadeh", content: `Abe Hamadeh voted for the One Big Beautiful Bill Act, which CBO estimated would cut $911 billion from Medicaid and leave 10.9 million more Americans uninsured — including more than 300,000 Arizonans — then falsely claimed the bill included "no cuts to Medicaid," a claim PolitiFact rated as false.

He voted against extending ACA premium subsidies as Arizona marketplace premiums surged 29–35%. He defended tariffs that economists call a $2,600-per-year hidden tax on Arizona families. The bill he voted for cut $187 billion from SNAP — the largest cut to food assistance in history.

Before Congress, Hamadeh was a serial election denier who filed four lawsuits to overturn his 280-vote loss and was sanctioned by the Arizona Supreme Court for misrepresenting facts.` },

  { name: "Addison McDowell", slug: "addison-mcdowell", content: `Addison McDowell was a Blue Cross Blue Shield lobbyist until the day he launched his congressional campaign — then voted for $1 trillion in Medicaid cuts threatening coverage for more than 670,000 North Carolinians.

He slashed $187 billion from SNAP, the largest cut to food assistance in history, while representing one of the most food-insecure metro areas in the country. He told ABC News to "trust the president" on tariffs that are now costing the average household $1,300 a year.

He has never held a single in-person town hall to face the constituents dealing with these consequences.` },

  { name: "Andy Harris", slug: "andy-harris", content: `Andy Harris is a physician who demanded his own taxpayer-funded health insurance start immediately — then spent 15 years voting to repeal the ACA that cut the uninsured rate in his district by 54%.

As Freedom Caucus chair, he pushed to accelerate Medicaid changes that could strip coverage from 24,000 people in his own district. He voted for the One Big Beautiful Bill's $186 billion SNAP cut — the largest in history — threatening 33,613 households in his district.

He voted to overturn the 2020 election even after the Capitol was stormed, then tried to bring a concealed gun onto the House floor two weeks later. He accepted over $1.3 million from health sector PACs including a donation from Purdue Pharma during the opioid crisis.` },

  { name: "Brad Knott", slug: "brad-knott", content: `Brad Knott voted for the One Big Beautiful Bill — cutting $1 trillion from Medicaid, nearly $200 billion from SNAP, and repealing clean energy tax credits used by 89,000 North Carolina households.

He voted against extending ACA subsidies and refused to comment, driving a 28.6% average premium spike for nearly one million North Carolinians. He voted to protect Trump's tariffs while Johnston County farmers described existential anxiety.

Before Congress, Knott voted in five elections from the wrong address — a potential Class I felony — and his campaign was launched with over $700,000 from his brother's single-candidate super PAC.` },

  { name: "Dan Meuser", slug: "dan-meuser", content: `Dan Meuser voted against the Inflation Reduction Act that capped insulin at $35/month and let Medicare negotiate drug prices. After ACA subsidies expired, 85,000 Pennsylvanians lost coverage, with rural counties hit hardest.

He voted for the One Big Beautiful Bill, which will strip Medicaid from nearly 18,000 people and SNAP benefits from 8,185 people in his own district — and called those numbers "complete, utter nonsense."

He praised Trump's tariffs as a "golden era in manufacturing" while the U.S. lost over 40,000 manufacturing jobs. He was caught violating the STOCK Act twice — hiding up to $600,000 in COVID-era stock trades and a $750K-to-$1.5M NVIDIA sale.` },

  { name: "Daniel Webster", slug: "daniel-webster", content: `Daniel Webster has held elected office continuously for 46 years yet is ranked as one of the least effective members of Congress — 58 bills sponsored, zero signed into law. He promised not to "pull the rug" on health care, then switched his vote to pass the AHCA.

He voted for the One Big Beautiful Bill that cut $3.8 billion from Florida's health care system. A Central Florida father with diabetes saw his premium jump from $28 to $733/month after subsidies he voted to let expire.

He has not held a single in-person town hall since 2011 and has a decades-long affiliation with a ministry whose founder resigned over sexual harassment allegations.` },

  { name: "Darrell Issa", slug: "darrell-issa", content: `The third-wealthiest member of Congress ($283 million net worth), Darrell Issa secured $815,000 in earmarks to widen roads next to his own commercial properties and violated the STOCK Act by disclosing up to $175 million in Treasury bond sales approximately 500 days late.

He voted 17 times to repeal the ACA, told a constituent whose son has diabetes to "hopefully" not get a condition, and voted for the One Big Beautiful Bill's $186 billion SNAP cut while delivering an average $66,000 tax cut to the richest 1%.

He was indicted for grand theft auto before entering politics, suspected of arson after increasing factory fire insurance by 462%, and convicted of carrying a concealed weapon. He refused to hold a town hall for eight years.` },

  { name: "French Hill", slug: "french-hill", content: `French Hill is a millionaire former banker who chairs the committee regulating the banking industry. He voted for up to $1 trillion in Medicaid cuts, then told constituents he had "never voted to end Medicare or Medicaid."

He told a reporter he opposes tariffs the day after voting to keep Trump's Canada tariffs — tariffs that could close 1 in 3 Arkansas farms. He voted for $186 billion in SNAP cuts in the state ranked dead last for food insecurity.

With $20.4 million net worth and only 0.73% of donations from small donors, his defining vulnerability is the gap between what he says and what he does.` },

  { name: "Glenn Grothman", slug: "glenn-grothman", content: `Glenn Grothman represents the district with more manufacturing jobs than almost any other — but consistently works against workers and farmers. He endorsed Trump's tariffs projected to cost Wisconsin dairy farmers $1-2 billion.

He voted for a bill that would strip coverage from 276,175 Wisconsinites and personally introduced an amendment to kick young adults off their parents' insurance. He voted against the $35 insulin cap and called expanded health coverage a "nightmare."

He proposed eliminating the mandatory day off for Wisconsin workers and has a decades-long record of inflammatory statements including calling Kwanzaa a fraud and saying "money is more important for men."` },

  { name: "Jay Obernolte", slug: "jay-obernolte", content: `Jay Obernolte voted for the largest Medicaid cut in the program's 60-year history — $911 billion — in a district where 48% of residents depend on Medi-Cal. He claimed "no one is being forced off Medicaid" despite CBO projecting 7.5 million will lose coverage.

He initially voted against blocking tariff oversight, then flipped under pressure from GOP leadership and refused to explain why — while the Inland Empire lost 26,000 logistics jobs.

He objected to the 2020 election results hours after the January 6 attack, and when 200 constituents booed him off stage at a town hall, he cancelled future in-person events.` },

  { name: "Lauren Boebert", slug: "lauren-boebert", content: `Lauren Boebert promised "I will never vote for legislation that will leave Coloradans without health care coverage" — then voted for the largest Medicaid cuts in American history, threatening 230,000 Coloradans including nearly 45,000 children in her district.

She called the Inflation Reduction Act "a complete scam" even as it funded an $200 million expansion creating 850 jobs in Pueblo. She voted against every major jobs bill, then shamelessly claimed credit for the funding they delivered.

She was escorted out of a theater for groping her date and vaping, and used campaign donor money for personal rent.` },

  { name: "Neal Dunn", slug: "neal-dunn", content: `Neal Dunn markets himself as a doctor who understands health care, but accepted over $273,000 from health industry donors then voted against the $35 insulin cap and Medicare drug price negotiation — in a district where uninsured rates top 40%.

He voted for the One Big Beautiful Bill that slashed $300 billion from SNAP and $700 billion from Medicaid. He violated the STOCK Act and has announced his retirement while rumored to resign early.

He voted to keep Trump's tariffs on Canada that economists called a "Category 5 economic hurricane" for Florida.` },

  { name: "Richard Hudson", slug: "richard-hudson", content: `Richard Hudson was the top pharmaceutical PAC recipient in Congress ($240,600), voted against the $35 insulin cap and drug price negotiation, and personally inserted a provision to block Medicaid expansion in North Carolina.

Expansion eventually covered 600,000+ people — no thanks to Hudson. He voted against the CHIPS Act that funded a $5 billion Wolfspeed plant creating 1,800 jobs in his own district, then called the One Big Beautiful Bill "the most pro-worker, pro-family legislation in decades."

When constituents tried to confront him, he told fellow Republicans to stop holding in-person town halls entirely.` },

  { name: "Stephanie Bice", slug: "stephanie-bice", content: `Stephanie Bice campaigned on lowering prescription drug costs — then voted against every bill that did, including the $35 insulin cap. She voted for the One Big Beautiful Bill that could strip Medicaid from 174,000 Oklahomans.

She dismissed critics as "fear-mongering" while the bill delivers over $50,000/year in tax cuts to the top 1%. She voted against the infrastructure law that sent $6.4 billion to Oklahoma — after earmarking $20 million in the same bill.

She votes with her party 97% of the time and voted to overturn the 2020 election.` },

  { name: "Tim Moore", slug: "tim-moore", content: `Tim Moore blocked Medicaid expansion for a decade as NC House Speaker, costing $20 billion in federal funding while 12 rural hospitals closed — then took credit when expansion passed.

In Congress, he voted for the One Big Beautiful Bill whose cuts could trigger NC's automatic expansion termination, threatening 680,000 enrollees. He told constituents to "pay a little more" for tariffed goods as NC lost 7,200 manufacturing jobs.

He privately invested up to $245,000 betting against the economy he publicly champions, while failing to disclose hundreds of thousands in stock trades around Trump's tariff announcement.` },

  { name: "Tom McClintock", slug: "tom-mcclintock", content: `Tom McClintock voted for a bill putting 56% of adult Medi-Cal enrollees in his district at risk — then told them only people who "refuse to get up off the couch" would lose coverage. He admitted tariffs are "bad public policy" then voted to keep them in place.

He voted against the infrastructure law that funded $45 million in highway projects and $100 million in broadband in his own district. He cheered when the Trump administration killed a $1.2 billion hydrogen project that would have created 220,000 jobs.

When hundreds of constituents packed a town hall to beg him not to repeal the ACA, he voted for it anyway.` },

  { name: "Tony Wied", slug: "tony-wied", content: `Tony Wied pledged he would "never do anything to pull" the ACA, then voted for a bill that would strip health insurance from 270,000 Wisconsinites. He enthusiastically backed tariffs costing Wisconsin dairy farmers $1-2 billion.

He filed 11 stock transactions worth up to $6.5 million in a single month while voting on policies that move markets. He ducked in-person town halls and left Medicaid advocates waiting outside his locked office.

Green Bay's mayor called the bill Wied voted for one that "literally makes the poor poorer, and the rich richer."` },

  { name: "Victoria Spartz", slug: "victoria-spartz", content: `Victoria Spartz declared herself a "hard no" on the budget bill, then flipped after Trump screamed at her and called her "a fake Republican." She voted for a law projected to strip Medicaid from nearly 12 million people.

She criticized Biden's 9-18% lumber tariffs, then voted to protect Trump's far larger 25% tariffs on Canada — triggering 900 layoffs at Stellantis plants in Kokomo, in her own district.

The House Ethics Committee investigated her for staff abuse including throwing furniture at aides. She was charged with bringing a gun through airport security and called President Zelensky a "moron."` },

  { name: "Virginia Foxx", slug: "virginia-foxx", content: `Virginia Foxx called the ACA "more dangerous than terrorism" and has spent two decades voting against every effort to make health care accessible — from children's insurance to $35 insulin to Medicaid itself.

As Rules Committee chairwoman, she used her gavel to shield Trump's tariffs from congressional repeal while NC lost 7,200 manufacturing jobs. She collected over $665,000 from the for-profit education industry while chairing the committee that oversees them.

She told students she has "very little tolerance" for their debt despite paying $87.50 a semester for her own UNC degree.` },

  { name: "Aaron Bean", slug: "aaron-bean", content: `Aaron Bean voted to kick more than 55,000 Floridians off health coverage and passed the biggest cuts to SNAP in history, ignoring that 46,000+ households in his district relied on the program.

He launched the Congressional DOGE Caucus and said he was "thrilled" and "proud" to work with the agency — even as DOGE eliminated constituents' jobs and hamstrung Social Security.

He called to "dismantle" the ACA even though 4.7 million Floridians rely on it. He landed himself in ethics crises twice as a Florida state senator — once securing $1 million for a friend's business, and again involving his brother-in-law's committee position.` },
];

export function loadCandidateData() {
  initCandidates(candidateData);
}
