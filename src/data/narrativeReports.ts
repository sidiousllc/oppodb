export interface NarrativeReport {
  name: string;
  slug: string;
  content: string;
}

export const narrativeReports: NarrativeReport[] = [
  // === 2025 NARRATIVE REPORTS ===
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

  // === TRUMP POLICY ISSUE REPORTS (from trumpresearchbook.com) ===
  { name: "Trump's Tax Giveaway to Corporations and the Wealthy", slug: "tax-giveaway", content: `Trump's Tax Cuts and Jobs Act (TCJA) was filled with corporate giveaways that crashed tax revenue while enriching shareholders and the wealthiest Americans. Corporate tax revenue fell 31% — almost twice official projections — while 91 corporations paid nothing in federal income taxes.

### Key Points:
- Corporate tax revenue fell to the nominal lowest level since 2002 after TCJA passage
- The TCJA was expected to add at least $1.9 trillion to the national debt over 10 years
- Corporations used the tax cuts to give more money to shareholders, not workers — bonuses touted after TCJA were one-time and insignificant compared to shareholder returns
- Business spending and corporate investment dropped to the lowest decline since 2009
- The estate tax exemption doubled, saving the largest 1,800 estates $4.4 million each
- The TCJA raised taxes on children of deceased service members and students receiving financial aid
- More than a million military members were forced to participate in Trump's payroll tax deferral, then pay it back
- Trump's 2017 tax cuts made the tax code no longer progressive at extreme income levels` },

  { name: "Trump's Record on Health Care", slug: "trump-health-care", content: `Donald Trump supported overturning the Affordable Care Act and its protections, consistently sought to undermine coverage for people with pre-existing conditions, failed to lower prescription drug prices, and threatened seniors with surprise medical billing through Medicare executive orders.

### Key Points:
- Trump said he was "seriously considering" terminating the ACA, which provides coverage to millions
- The Trump administration supported a lawsuit to invalidate all of the ACA — eventually rejected by the Supreme Court
- Trump attempted to eliminate pre-existing condition protections while claiming to protect them
- Despite campaign promises, drug prices continued to rise under Trump on aggregate and for thousands of drugs
- Trump rejected Democrats' proposals for prescription drug negotiations after months of talks
- Trump's Medicare Advantage executive order threatened to put seniors at risk of surprise medical bills
- 530,000 annual personal bankruptcies were tied to medical issues during Trump's term` },

  { name: "Trump's Immigration Record", slug: "trump-immigration", content: `Donald Trump espoused xenophobic rhetoric and advocated for racist immigration policies throughout his presidency and campaigns. He instituted discriminatory regulations, separated families at the border, and slashed refugee admissions while his own businesses relied on foreign workers.

### Key Points:
- Trump instituted discriminatory regulations amounting to a Muslim ban — only 10% of visa applicants from majority-Muslim countries were approved in the first two years
- Trump called immigrants "animals" and accused them of "poisoning the blood of our country"
- Trump lowered the refugee cap from 110,000 in 2016 to only 15,000 in 2021
- Trump ordered the border wall, shifting millions from the Pentagon — Mexico never paid despite promises
- Trump shut down the government for 35 days over border wall funding in 2019
- Trump's top immigration advisor Stephen Miller advocated for mass deportations and "the most spectacular migrant crackdown"
- Trump sought to end DACA, putting thousands of immigrants brought as children at risk of deportation
- Trump falsely claimed Haitian migrants were eating pets and likened immigrants to "deadly snakes"` },

  { name: "Trump's Record on Guns", slug: "trump-guns", content: `During Trump's first year in office, guns killed 39,773 Americans — the most since tracking began in 1979. There were nearly 1,027 mass shootings during his last two years. Despite promises after mass shootings, Trump abandoned background check reforms and made firearms more accessible.

### Key Points:
- Gun deaths hit a record 39,773 in Trump's first year — the highest since government tracking began in 1979
- Nearly 1,027 mass shootings occurred during Trump's last two years as president
- Trump promised "very strong" background checks after mass shootings, then abandoned the effort and threatened to veto expansion bills
- Trump signed a law making it easier for people with mental illnesses to purchase guns by repealing SSA reporting requirements
- Trump's DOJ narrowed the definition of "fugitive from justice," making it easier for fugitives to buy guns
- Trump went from supporting an assault weapons ban in 2000 to opposing it as president
- Trump suggested arming teachers — a proposal overwhelmingly opposed by educators
- Trump's campaign falsely claimed he purchased a gun; it would have been illegal due to his felony indictments` },

  { name: "Trump's Record on Defense and Foreign Policy", slug: "trump-defense", content: `Trump's approach to defense and foreign policy was marked by cozying up to authoritarian leaders, undermining alliances, abandoning Kurdish allies in Syria, and mishandling classified information.

### Key Points:
- Trump sided with Putin over U.S. intelligence agencies on Russian election interference at the Helsinki summit
- Trump abandoned Kurdish allies in Syria, drawing bipartisan condemnation
- Trump's trade wars with allies undermined NATO and strained traditional partnerships
- Trump saluted a North Korean general and praised Kim Jong Un as "very talented"
- Trump was impeached for pressuring Ukraine to investigate a political rival
- Trump took classified documents to Mar-a-Lago after leaving office
- Military leaders including his own Defense Secretary publicly criticized Trump's leadership` },

  { name: "Trump's Record on Education", slug: "trump-education", content: `Trump and his appointees sought to undermine public education, push school vouchers, and roll back civil rights protections for students. His Education Secretary Betsy DeVos was widely criticized as unqualified.

### Key Points:
- DeVos was confirmed only after VP Pence cast a historic tie-breaking vote — the first for a Cabinet nominee
- Trump proposed cutting the Education Department budget by billions each year
- DeVos rolled back Obama-era guidance on campus sexual assault protections
- Trump pushed school voucher programs that divert public school funding to private institutions
- The administration rolled back protections for transgender students
- DeVos invested in student loan companies while overseeing student lending policy
- Trump threatened to cut funding to schools that taught the 1619 Project` },

  { name: "Trump's Child Separation Policy", slug: "trump-child-separation", content: `The Trump administration's "zero tolerance" immigration policy led to the separation of thousands of children from their parents at the southern border, causing lasting trauma to families and drawing international condemnation.

### Key Points:
- At least 5,556 children were separated from their families under the zero tolerance policy
- Children as young as infants were taken from parents and held in detention facilities
- The administration had no system to reunite separated families — hundreds remained separated years later
- A DHS inspector general found the policy caused "inconsolable crying" and behavioral changes in children
- Federal judges ordered family reunification, but the administration missed multiple deadlines
- The American Academy of Pediatrics called the policy "government-sanctioned child abuse"
- Trump initially denied the separations were happening, then blamed Democrats` },

  { name: "Trump's Record on Infrastructure", slug: "trump-infrastructure", content: `Despite repeatedly promising "Infrastructure Week," Trump failed to pass any significant infrastructure legislation during his four years in office, leaving roads, bridges, and broadband improvements unfunded.

### Key Points:
- "Infrastructure Week" became a running joke as the administration repeatedly promised but never delivered legislation
- Trump proposed cutting infrastructure spending in multiple budget proposals
- The American Society of Civil Engineers gave U.S. infrastructure a C- grade during Trump's term
- Trump walked out of an infrastructure meeting with Democrats in 2019 over investigations
- Rural broadband remained largely unaddressed despite campaign promises
- Water infrastructure in cities like Flint, Michigan received inadequate federal attention
- The infrastructure bill was eventually passed under Biden with no Republican support from Trump allies` },

  { name: "Trump's Record on Disaster Relief", slug: "trump-disaster-relief", content: `Trump's disaster response record was marked by delayed aid, political retaliation against states, and the notorious paper towel toss in Puerto Rico. His administration was criticized for inequitable distribution of disaster funds.

### Key Points:
- Trump tossed paper towels to Puerto Rico hurricane survivors in a widely criticized photo op
- Nearly 3,000 people died in Puerto Rico from Hurricane Maria — Trump disputed the death toll
- Trump threatened to withhold California wildfire relief funds over forest management disagreements
- FEMA ran out of disaster funds during the 2017 hurricane season
- Trump diverted FEMA funds to immigration enforcement
- An HUD inspector general found $15 billion in disaster aid was delayed for Puerto Rico compared to other states
- Trump's comments about "nuking hurricanes" raised concerns about his understanding of natural disasters` },

  { name: "Trump's Record on Voting Rights", slug: "trump-voting-rights", content: `Trump repeatedly attacked voting rights, pushed false claims of widespread voter fraud, and supported measures that made it harder for Americans — particularly minorities — to vote.

### Key Points:
- Trump created a "voter fraud" commission that was disbanded after finding no evidence of widespread fraud
- Trump repeatedly claimed millions of illegal votes were cast in 2016 — claims debunked by every investigation
- The administration supported voter ID laws that disproportionately affect minority voters
- Trump opposed mail-in voting and attacked the Postal Service ahead of the 2020 election
- Trump pushed states to purge voter rolls, affecting hundreds of thousands of legitimate voters
- The DOJ under Trump dropped or weakened voting rights enforcement cases
- Trump's rhetoric about "rigged elections" laid the groundwork for January 6th` },

  { name: "Trump's Record on Wages and the Workplace", slug: "trump-wages-workplace", content: `Under Trump, workers faced stagnant wages, weakened protections, and attacks on collective bargaining rights while corporations received massive tax breaks.

### Key Points:
- Real wages for most workers remained flat despite corporate tax cuts worth trillions
- Trump's Labor Department rolled back overtime protections for millions of workers
- The administration weakened workplace safety enforcement at OSHA
- Trump opposed raising the federal minimum wage from $7.25/hour
- The NLRB under Trump issued rulings making it harder for workers to organize
- Trump's trade wars created uncertainty that suppressed wage growth in manufacturing
- The administration weakened equal pay protections for women` },

  { name: "Trump's Opioid Crisis Record", slug: "trump-opioids", content: `Despite declaring the opioid crisis a public health emergency, Trump's administration was consistently behind the curve in addressing an epidemic that killed tens of thousands of Americans annually.

### Key Points:
- Trump declared the opioid crisis a public health emergency but failed to request emergency funding
- Over 70,000 Americans died from drug overdoses in 2017 alone
- The "public health emergency" declaration expired and was renewed multiple times with limited action
- Trump's proposed budget cuts included reductions to agencies fighting the opioid crisis
- The administration's response was criticized as inadequate by public health experts
- Trump's nominee to lead the office of drug control policy withdrew after reports of industry ties
- Rural communities devastated by opioids received insufficient federal support` },

  { name: "Trump's Record on Medicare", slug: "trump-medicare", content: `Trump sought to undermine Medicare through privatization efforts, budget cuts, and executive orders that threatened to increase costs for seniors.

### Key Points:
- Trump's budgets repeatedly proposed cutting Medicare by hundreds of billions over 10 years
- His Medicare Advantage executive order could have subjected more seniors to surprise bills
- Trump backed away from drug pricing promises that would have saved Medicare billions
- The administration promoted Medicare Advantage plans that restricted provider networks
- Trump's tax cuts were projected to trigger automatic Medicare cuts through sequestration
- The administration weakened Medicare fraud enforcement
- Trump's trade wars raised costs for medical devices and prescription drugs` },

  { name: "Trump's Record on Social Security", slug: "trump-social-security", content: `Despite promises not to cut Social Security, Trump's policies threatened the program's solvency and benefits for millions of retirees and disabled Americans.

### Key Points:
- Trump's payroll tax deferral threatened Social Security's funding mechanism
- His budgets included proposals to cut Social Security disability benefits
- The Social Security Administration faced staffing cuts that increased wait times for benefits
- Trump's tax cuts reduced revenue that funds Social Security
- The administration supported raising the retirement age through various proposals
- Field offices were closed, making it harder for seniors to access services
- Trump's 2025 DOGE cuts further decimated SSA staffing and service capacity` },

  { name: "Trump Failed to Lower Prescription Drug Prices", slug: "trump-drug-prices", content: `Despite repeated campaign promises, Trump failed to lower prescription drug prices and backed away from his pledge to hold pharmaceutical companies accountable.

### Key Points:
- Trump repeatedly promised to lower drug prices during the 2016 campaign
- Drug prices continued to rise under Trump on aggregate and for thousands of specific drugs
- Trump rejected Democrats' proposals for Medicare drug price negotiation after months of talks
- The administration's own drug pricing proposals were repeatedly watered down under industry pressure
- Trump hosted a photo op with pharma CEOs who later raised prices
- The "Most Favored Nation" executive order on drug pricing was never implemented
- 530,000 annual personal bankruptcies were tied to medical costs` },

  // === TRUMP PERSONAL NARRATIVE REPORTS ===
  { name: "Donald Trump Is A Sexual Predator", slug: "trump-sexual-predator", content: `A federal jury found Donald Trump liable for sexually abusing E. Jean Carroll and ordered him to pay millions for defamation. As of May 2023, Trump has been accused of sexual assault, harassment, or predation by at least 26 individuals over decades.

### Key Points:
- A jury found Trump liable for sexually abusing E. Jean Carroll and awarded $5 million in damages
- A second jury awarded Carroll $83.3 million for Trump's repeated defamation
- In 2005, Trump bragged about sexually assaulting women on the Access Hollywood tape, saying he could get away with it because he was famous
- At least 26 individuals accused Trump of sexual assault, harassment, or predation over decades
- Multiple beauty pageant contestants alleged Trump walked into dressing rooms — including those with minors — while they were undressed
- Trump bragged about using beauty pageants to look at naked contestants
- Former campaign staffer Alva Johnson alleged Trump forcibly kissed her in 2016
- Ivana Trump maintained allegations that Trump violated her in 1989` },

  { name: "Trump Exhibits Authoritarian Tendencies", slug: "trump-authoritarian", content: `Donald Trump has consistently exhibited authoritarian tendencies — from threatening to be a dictator on day one, to installing loyalists, defying subpoenas, attacking the judiciary, and threatening political rivals with violence and prosecution.

### Key Points:
- Trump said he would be a dictator for his first day in office and said "a lot of people like" talk of dictatorship
- Trump threatened to use the presidency for retribution and mentioned serving more than two terms
- Trump posted a video mentioning "the creation of a unified Reich"
- He instructed aides to defy congressional subpoenas and stonewalled impeachment investigations
- He threatened to withhold federal money from states that opposed him
- He attacked judges who ruled against him and said judges he appointed would rule in his favor
- Trump fired FBI Director Comey over the Russia investigation
- Bill Barr said Trump regularly called for executing people
- He advocated police brutality, telling officers it was OK to be "rough" towards arrestees` },

  { name: "You Can't Trust Anything Donald Trump Says", slug: "trump-liar", content: `Donald Trump made 30,573 false or misleading claims during the four years of his presidency. His lies covered everything from the coronavirus to the economy, natural disasters, climate change, and his own accomplishments.

### Key Points:
- Trump made 30,573 false or misleading claims during his four-year presidency, with exponentially more each year
- PolitiFact named "coronavirus downplay and denial" as 2020's Lie of the Year
- The Washington Post tracked over 2,500 coronavirus-related false or misleading claims from Trump
- Trump falsely claimed coronavirus was "under control" and would "miraculously disappear" with warm weather
- Trump lied to promote hydroxychloroquine as treatment despite lack of evidence
- Trump's claim that Russian election interference was a "made-up story" won 2017 Lie of the Year
- His claim that the Ukraine whistleblower was wrong won 2019 Lie of the Year
- Trump lied about his ties to Project 2025 and about crowd sizes at events` },

  { name: "Donald Trump Is A Racist", slug: "trump-racist", content: `Donald Trump has a long history of racism, xenophobia, and discrimination. As a candidate and as president, he used racism and racial division as political tools — from the Central Park Five to the Birther movement to defending white supremacists in Charlottesville.

### Key Points:
- In 1975, Trump settled a DOJ case for racial discrimination in housing — then was accused again three years later
- Trump spearheaded a racist campaign against the Central Park Five
- Trump led the Birther movement questioning President Obama's citizenship
- White supremacists including David Duke endorsed Trump's 2016 campaign
- Trump appointed racists to positions of power in his administration
- Trump dismissed the role of white supremacists in Charlottesville, saying there were "very fine people on both sides"
- Trump used immigration policy to pursue racist ends — Muslim ban, border wall, family separations
- Trump promoted and enacted discriminatory and disenfranchising domestic policies` },

  { name: "Trump Damages the Foundations of American Democracy", slug: "trump-anti-democracy", content: `Donald Trump repeatedly undermined the foundations of American democracy by attacking democratic institutions, the free press, the rule of law, and the peaceful transfer of power.

### Key Points:
- Trump called the press "the enemy of the people" hundreds of times
- He encouraged violence against journalists at his rallies
- He pressured the DOJ to investigate political opponents
- He fired inspectors general who investigated his administration
- He pardoned political allies convicted of crimes related to his benefit
- He refused to commit to a peaceful transfer of power
- His actions culminated in the January 6th Capitol attack
- His own former officials — including his VP, AG, and Defense Secretary — warned he was dangerous to democracy` },

  { name: "Corrupt and Incompetent Administration", slug: "trump-corrupt-administration", content: `Trump's administration was plagued by an unprecedented level of corruption, ethical violations, and incompetence, with numerous officials forced to resign or face criminal charges.

### Key Points:
- More Trump administration officials faced criminal charges than any modern presidency
- Multiple Cabinet members resigned amid ethics scandals — including EPA's Pruitt, HHS's Price, and Interior's Zinke
- Trump hired unqualified loyalists over experienced professionals
- The revolving door of staff turnover exceeded any modern administration
- Trump officials violated the Hatch Act with impunity
- The administration ignored or weakened ethics rules
- Multiple officials used private email or messaging for official business while attacking Hillary Clinton for the same` },

  { name: "Trump's Business Profits While in Office", slug: "trump-business-profits", content: `Donald Trump continued to profit from his businesses while serving as president, raising unprecedented conflicts of interest and funneling taxpayer and campaign dollars to his own properties.

### Key Points:
- Trump refused to divest from his business empire or place assets in a blind trust
- Foreign governments spent millions at Trump properties to curry favor
- The Secret Service paid Trump's businesses hundreds of thousands for rooms and golf carts
- Trump promoted his properties from the White House and on official trips
- Campaign and party committees spent millions at Trump-owned venues
- T-Mobile executives stayed at Trump's DC hotel while their merger was pending government approval
- Trump's businesses received at least $8 million from foreign governments during his presidency` },

  { name: "Trump's Business Empire Fostered Foreign Corruption", slug: "trump-foreign-business", content: `Trump's global business empire created unprecedented opportunities for foreign influence and corruption, with entities around the world using Trump properties and business deals to gain access to the presidency.

### Key Points:
- Trump maintained business dealings in at least 20 countries while serving as president
- Trump Tower received investments from Russian oligarchs and money launderers
- Trump pursued a Moscow Tower deal deep into the 2016 campaign while denying business ties to Russia
- Saudi and other Middle Eastern interests spent lavishly at Trump properties
- Trump's business partners in multiple countries had ties to organized crime or authoritarian governments
- The emoluments lawsuits alleged Trump violated the Constitution by accepting foreign payments` },

  { name: "Trump, 'The Big Lie,' and January 6th", slug: "trump-big-lie-jan6", content: `Trump's false claims about the 2020 election — "The Big Lie" — directly led to the January 6th attack on the U.S. Capitol, the most serious assault on American democracy since the Civil War.

### Key Points:
- Trump made hundreds of false claims about the 2020 election being "stolen"
- He pressured state officials to "find" votes, including a recorded call to Georgia's Secretary of State
- He pressured the DOJ to declare the election corrupt
- He pressured VP Pence to reject electoral votes — which Pence refused to do
- On January 6th, Trump told supporters to "fight like hell" and march on the Capitol
- The attack resulted in 5 deaths, 140+ injured officers, and hundreds of arrests
- Trump was impeached for incitement of insurrection — the most bipartisan impeachment vote in history
- Trump was indicted on federal and state charges related to his efforts to overturn the election` },

  { name: "Trump's Nepotism", slug: "trump-nepotism", content: `Trump installed family members in key White House positions and used the presidency to benefit his family's business interests, creating unprecedented conflicts of interest.

### Key Points:
- Jared Kushner and Ivanka Trump were given senior White House roles despite lacking experience
- Kushner received a security clearance over the objections of intelligence officials
- Kushner's real estate business received $2 billion from Saudi Arabia's sovereign wealth fund after leaving office
- Ivanka Trump received Chinese trademarks while serving in the White House
- Donald Trump Jr. and Eric Trump continued running Trump businesses that profited from the presidency
- Trump family members participated in official government business while maintaining private interests
- Anti-nepotism laws were stretched to their limits to accommodate the appointments` },

  { name: "Trump Is an Embarrassing Buffoon", slug: "trump-embarrassing", content: `Donald Trump repeatedly embarrassed the United States on the world stage through ignorant statements, bizarre behavior, and a fundamental lack of dignity expected of the presidency.

### Key Points:
- Trump suggested injecting bleach to treat COVID-19
- He stared directly at a solar eclipse without protective eyewear
- He drew on a weather map with a Sharpie to falsely extend a hurricane's path to Alabama
- He saluted a North Korean general
- He pushed aside the Prime Minister of Montenegro at a NATO summit
- World leaders were caught on camera laughing at Trump
- He repeatedly misspelled words in official tweets, including "covfefe"
- He asked if Finland rakes its forests to prevent fires` },

  { name: "Abuse of the Pardon Power", slug: "trump-pardons", content: `Trump used the presidential pardon power to reward political allies, send signals to potential witnesses, and undermine the rule of law.

### Key Points:
- Trump pardoned political allies including Roger Stone, Paul Manafort, Michael Flynn, and Steve Bannon
- Multiple pardons appeared designed to reward loyalty or discourage cooperation with investigators
- Trump discussed pardons for January 6th participants before and after leaving office
- He pardoned Joe Arpaio, who was convicted of criminal contempt for racial profiling
- Trump used commutations to free allies sentenced for crimes related to his benefit
- Legal experts called Trump's use of pardons the most corrupt in modern presidential history
- The pattern of pardons signaled that loyalty to Trump was more important than the rule of law` },

  { name: "Trump's Mental and Physical Decline", slug: "trump-mental-decline", content: `Concerns about Trump's mental acuity and physical fitness grew throughout his presidency and continued into his 2024 campaign, with numerous public incidents raising questions about his cognitive state.

### Key Points:
- Trump repeatedly confused people, places, and events in public appearances
- He confused Nikki Haley with Nancy Pelosi multiple times
- He struggled with words, slurring speech in multiple addresses
- He claimed he passed a cognitive test that experts said was designed to detect severe impairment, not subtle decline
- His own officials privately questioned his mental fitness
- He repeatedly confused which office he was running for
- Mental health professionals signed open letters expressing concern about his fitness
- His handlers increasingly limited unscripted appearances` },

  { name: "Trump's Chinese Business Interests", slug: "trump-chinese-interests", content: `Donald Trump and his family maintained extensive personal and financial exposure to Chinese interests while conducting trade policy with China, creating significant conflicts of interest.

### Key Points:
- Ivanka Trump received Chinese trademarks while her father was negotiating trade deals with China
- Trump maintained a Chinese bank account that paid nearly $200,000 in taxes to China
- Trump praised Chinese President Xi Jinping dozens of times during his presidency
- The Trump Organization pursued projects in China
- Jared Kushner's family business sought Chinese investment for their 666 Fifth Avenue property
- Trump eased sanctions on Chinese telecom ZTE after China invested in a Trump-linked project
- Trump's trade war rhetoric contradicted his private business dealings with Chinese entities` },

  { name: "Trump Let Lobbyists Run the Government", slug: "trump-lobbyists-big-business", content: `Trump promised to "drain the swamp" but instead filled his administration with lobbyists, corporate executives, and donors who used their positions to benefit their former industries.

### Key Points:
- Trump appointed more lobbyists to Cabinet-level positions than any recent president
- His EPA administrator Scott Pruitt met frequently with industry lobbyists and rarely with environmental groups
- Trump weakened the Obama-era ethics pledge and granted numerous waivers
- Industry insiders were placed in charge of the agencies meant to regulate them
- Trump's transition team was stocked with corporate lobbyists
- His Cabinet was the wealthiest in modern history
- Multiple officials left government and immediately lobbied their former agencies` },

  { name: "Trump Is Too Lazy to Be an Effective President", slug: "trump-lazy", content: `Trump spent a disproportionate amount of his presidency on leisure activities, particularly golf, while neglecting the daily work of governance and skipping intelligence briefings.

### Key Points:
- Trump spent more than 300 days at golf clubs during his four-year presidency
- He frequently arrived late to meetings and left early
- He repeatedly skipped intelligence briefings, preferring to receive information orally in abbreviated form
- His "Executive Time" — largely spent watching TV — consumed much of his daily schedule
- He took significantly more vacation days than his predecessors
- White House aides described a president who was difficult to brief and had a short attention span
- Trump criticized Obama for golfing, then golfed far more frequently himself` },

  { name: "Trump's History of Anti-Semitism", slug: "trump-antisemitism", content: `Despite claiming to be a friend of Israel, Trump repeatedly engaged in anti-Semitic tropes and failed to consistently condemn anti-Semitism, emboldening extremists.

### Key Points:
- Trump told Jewish Americans that Israel was "your country" — a classic anti-Semitic dual loyalty trope
- He blamed Jewish Americans for not being "loyal" enough to him
- He said Jews who vote for Democrats are being "disloyal"
- Trump dined with Holocaust denier Nick Fuentes at Mar-a-Lago
- He shared anti-Semitic imagery during his 2016 campaign, including a Star of David over money
- The Pittsburgh synagogue massacre — the deadliest attack on Jews in American history — occurred during his presidency
- His "very fine people on both sides" comment equated neo-Nazis with counter-protesters` },

  { name: "The Trump-Epstein File", slug: "trump-epstein", content: `Donald Trump had a long and documented social relationship with convicted sex trafficker Jeffrey Epstein, raising serious questions about their association.

### Key Points:
- Trump and Epstein socialized together for years in New York and Palm Beach
- Trump said Epstein "likes beautiful women as much as I do, and many of them are on the younger side"
- Multiple witnesses placed Trump at Epstein-connected events
- Trump later claimed he "wasn't a fan" of Epstein and had banned him from Mar-a-Lago
- House Republicans blocked the immediate release of Epstein files
- Trump's Labor Secretary Alexander Acosta resigned after scrutiny of the plea deal he gave Epstein as a prosecutor
- Questions about the full extent of Trump's involvement remained unanswered` },

  { name: "Trump Tax Returns Revelations", slug: "trump-tax-returns", content: `After years of fighting to keep them secret, Trump's tax returns revealed he paid minimal federal income taxes while claiming enormous losses and deductions.

### Key Points:
- Trump paid just $750 in federal income taxes in both 2016 and 2017
- He paid no federal income taxes in 10 of the previous 15 years
- He claimed enormous business losses to offset income, including $47 million in losses from his casinos
- His tax returns revealed previously unknown foreign bank accounts
- He claimed dubious deductions, including $70,000 for hair styling
- The returns showed he was under audit by the IRS for a $72.9 million refund
- His actual wealth was likely far less than he publicly claimed` },

  { name: "Trump's Ongoing Legal Issues", slug: "trump-legal-issues", content: `Trump has faced an unprecedented number of legal issues — from civil fraud to criminal indictments — more than any former or sitting president in American history.

### Key Points:
- Trump was found liable for fraud in New York, ordered to pay $355 million plus interest
- He was indicted on 91 felony counts across four jurisdictions
- He was convicted of 34 felony counts in the Manhattan hush money trial
- He was indicted for attempting to overturn the 2020 election results
- He was indicted for mishandling classified documents at Mar-a-Lago
- He was indicted in Georgia for efforts to overturn the state's election results
- A jury found him liable for sexual abuse and defamation, ordering $88.3 million in damages
- His businesses were found guilty of tax fraud in a separate New York case` },

  { name: "Trump's Dangerous COVID-19 Record", slug: "trump-coronavirus", content: `Trump's response to the COVID-19 pandemic was marked by denial, misinformation, delayed action, and preferential treatment for allies — contributing to hundreds of thousands of preventable American deaths.

### Key Points:
- Trump was warned to prepare for a pandemic but failed to act early enough
- He repeatedly downplayed the virus, calling it a "hoax" and saying it would "miraculously" disappear
- He suggested injecting bleach and promoted unproven treatments like hydroxychloroquine
- He defunded and disbanded the pandemic preparedness office before COVID hit
- His administration's PPE and testing rollouts were chaotic and inadequate
- As the virus spread, Trump's allies received preferential access to testing and treatment
- Trump pushed to reopen the economy against the advice of health experts
- Kushner "bungled" the coronavirus response with an inexperienced team
- Over 1.2 million Americans died from COVID-19` },

  { name: "Trump's Record on Police Violence", slug: "trump-police-violence", content: `Trump encouraged police violence, attacked peaceful protesters, and undermined accountability for law enforcement misconduct — particularly against Black Americans.

### Key Points:
- Trump told police officers "don't be too nice" when making arrests
- He threatened to deploy the military against Black Lives Matter protesters
- He had peaceful protesters tear-gassed for a photo op at St. John's Church
- He called for protesters to be "dominated" and branded them "thugs"
- He reversed Obama-era consent decrees designed to reform police departments
- He praised police who used excessive force and threatened to defund cities that "defunded the police"
- His rhetoric was cited as encouraging police violence against minorities` },

  { name: "Trump's Rally Costs to Taxpayers", slug: "trump-rally-costs", content: `Trump's rallies and events cost taxpayers more than $1.8 million in public safety-related services, with many cities never being reimbursed.

### Key Points:
- Trump's rallies required extensive law enforcement and emergency services
- Multiple cities reported spending hundreds of thousands on security for Trump events
- Few cities were reimbursed for these costs despite requests
- The Secret Service spent millions protecting Trump at his own properties
- Trump used official events for campaign purposes, blurring the line between government and campaign spending` },

  { name: "Trump Is a Disaster for Senior Citizens", slug: "trump-seniors", content: `Trump's policies threatened the health care, financial security, and safety of America's seniors through cuts to Medicare, Social Security, and pandemic mismanagement that disproportionately affected older Americans.

### Key Points:
- COVID-19 disproportionately killed seniors while Trump downplayed the virus
- Trump's budgets proposed cutting Medicare by hundreds of billions
- His administration supported weakening pre-existing condition protections that seniors rely on
- Trump's payroll tax deferral threatened Social Security's funding
- His trade wars raised costs on prescription drugs and medical devices
- Trump backed away from drug pricing reforms that would have saved seniors billions
- Nursing homes were devastated by COVID while the administration failed to provide adequate PPE and testing` },

  { name: "Trump Mismanaged Paycheck Protection Loans", slug: "trump-ppp-mismanagement", content: `The Paycheck Protection Program under Trump was plagued by mismanagement, sending billions to large corporations instead of the small businesses it was designed to help.

### Key Points:
- Large corporations received PPP loans while small businesses were shut out
- Trump resisted oversight of how PPP funds were distributed
- The program ran out of money within days, leaving millions of small businesses empty-handed
- Companies that received loans still laid off workers
- Trump fired the inspector general assigned to oversee the program
- Fraud was rampant — with billions in loans going to fake or inflated businesses
- The program disproportionately failed minority-owned businesses` },

  { name: "Project 2025", slug: "project-2025", content: `Project 2025 is a comprehensive conservative blueprint to reshape the federal government in a second Trump term. Despite Trump's attempts to distance himself from it, multiple authors and contributors hold positions in his administration.

### Key Points:
- Project 2025 calls for mass firings of career civil servants and replacing them with political loyalists
- It proposes eliminating the Department of Education
- It advocates for dramatically restricting abortion access nationwide
- It calls for ending diversity, equity, and inclusion programs across the federal government
- It proposes rolling back environmental regulations and climate initiatives
- Multiple Project 2025 authors were appointed to Trump's 2025 administration
- Despite Trump claiming he had "nothing to do with" Project 2025, his administration has implemented many of its recommendations` },

  { name: "Promises Made, Promises Broken", slug: "broken-promises", content: `Trump made hundreds of promises during his campaigns that he failed to deliver on — from building a wall paid for by Mexico to replacing the ACA with "something beautiful" to bringing back manufacturing jobs.

### Key Points:
- Mexico never paid for the border wall — American taxpayers funded what was built
- Trump never released a health care plan to replace the ACA despite years of promises
- Manufacturing jobs continued to decline in key states despite promises of a renaissance
- The trade deficit with China increased during Trump's trade wars
- Trump promised to eliminate the national debt in eight years — it increased by nearly $8 trillion
- Infrastructure was never addressed despite repeated "Infrastructure Week" promises
- Trump promised to "drain the swamp" but hired more lobbyists and insiders than his predecessors` },
];

export function searchNarrativeReports(query: string): NarrativeReport[] {
  if (!query.trim()) return narrativeReports;
  const q = query.toLowerCase();
  return narrativeReports.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.content.toLowerCase().includes(q)
  );
}
