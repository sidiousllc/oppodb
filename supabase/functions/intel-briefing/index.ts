import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Source state overrides (for admin reassignment) ─────────────────────────────────
// Map of normalized rssUrl → assigned state abbreviation.
// If a URL is not in this map, the state is derived from SOURCES.local (read-only catalog).
// Entries are added by the "move_feed_state" action.
const LOCAL_SOURCE_OVERRIDES: Record<string, string> = {};

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function getSourceState(rssUrl: string): string | null {
  const key = normalizeUrl(rssUrl);
  if (LOCAL_SOURCE_OVERRIDES[key]) return LOCAL_SOURCE_OVERRIDES[key];
  const localSources = SOURCES.local as Array<{ name: string; rssUrl: string; scope: string; state?: string }>;
  const match = localSources.find((s) => normalizeUrl(s.rssUrl) === key);
  return match?.state ?? null;
}

function setSourceState(rssUrl: string, newState: string): void {
  LOCAL_SOURCE_OVERRIDES[normalizeUrl(rssUrl)] = newState.toUpperCase();
}

function getAvailableTargetStates(currentRssUrl: string, allLocalSources: Array<{ name: string; rssUrl: string; state?: string }>): Array<{ abbr: string; name: string }> {
  const currentKey = normalizeUrl(currentRssUrl);
  const currentState = getSourceState(currentRssUrl);
  const usedUrls = new Set<string>();
  // Collect URLs already assigned to each state (including overrides)
  for (const s of allLocalSources) {
    const key = normalizeUrl(s.rssUrl);
    const state = LOCAL_SOURCE_OVERRIDES[key] ?? s.state ?? null;
    if (state) usedUrls.add(`${normalizeUrl(s.rssUrl)}|${state}`);
  }
  // Also add the current feed's URL in its current state so we don't flag "self" as a conflict
  if (currentState) usedUrls.add(`${currentKey}|${currentState}`);

  return JURISDICTIONS
    .filter((abbr) => abbr !== currentState)
    .map((abbr) => ({ abbr, name: STATE_ABBR_TO_NAME[abbr] ?? abbr }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isConflict(rssUrl: string, targetState: string, allLocalSources: Array<{ name: string; rssUrl: string; state?: string }>): boolean {
  const key = normalizeUrl(rssUrl);
  const targetKey = targetState.toUpperCase();
  // Check if any OTHER source (not this one) has the same URL in the target state
  for (const s of allLocalSources) {
    const sKey = normalizeUrl(s.rssUrl);
    if (sKey === key) continue;
    const sState = LOCAL_SOURCE_OVERRIDES[sKey] ?? s.state ?? null;
    if (sKey === key && sState === targetKey) return true;
  }
  return false;
}

const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

const JURISDICTIONS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

// Intelligence sources organized by scope — 150+ feeds
const SOURCES: Record<string, Array<{ name: string; rssUrl: string; scope: string }>> = {
  international: [
    // Wire services & major outlets
    { name: "Reuters World", rssUrl: "https://feeds.reuters.com/Reuters/worldNews", scope: "international" },
    { name: "AP World News", rssUrl: "https://rsshub.app/apnews/topics/world-news", scope: "international" },
    { name: "BBC World", rssUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", scope: "international" },
    { name: "Al Jazeera", rssUrl: "https://www.aljazeera.com/xml/rss/all.xml", scope: "international" },
    { name: "The Guardian World", rssUrl: "https://www.theguardian.com/world/rss", scope: "international" },
    // Regional outlets
    { name: "Deutsche Welle", rssUrl: "https://rss.dw.com/rdf/rss-en-all", scope: "international" },
    { name: "France 24", rssUrl: "https://www.france24.com/en/rss", scope: "international" },
    { name: "Japan Times", rssUrl: "https://www.japantimes.co.jp/feed/", scope: "international" },
    { name: "South China Morning Post", rssUrl: "https://www.scmp.com/rss/91/feed", scope: "international" },
    { name: "Middle East Eye", rssUrl: "https://www.middleeasteye.net/rss", scope: "international" },
    { name: "The Diplomat", rssUrl: "https://thediplomat.com/feed/", scope: "international" },
    { name: "Global Post / The World", rssUrl: "https://theworld.org/rss.xml", scope: "international" },
    { name: "World Politics Review", rssUrl: "https://www.worldpoliticsreview.com/rss", scope: "international" },
    { name: "Nikkei Asia", rssUrl: "https://asia.nikkei.com/rss", scope: "international" },
    { name: "The Africa Report", rssUrl: "https://www.theafricareport.com/feed/", scope: "international" },
    { name: "Latin America Reports", rssUrl: "https://latinamericareports.com/feed/", scope: "international" },
    // Additional international
    { name: "The Economist", rssUrl: "https://www.economist.com/international/rss.xml", scope: "international" },
    { name: "Financial Times World", rssUrl: "https://www.ft.com/world?format=rss", scope: "international" },
    { name: "UN News", rssUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", scope: "international" },
    { name: "Euronews", rssUrl: "https://www.euronews.com/rss", scope: "international" },
    { name: "Times of India", rssUrl: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", scope: "international" },
    { name: "Kyiv Independent", rssUrl: "https://kyivindependent.com/feed/", scope: "international" },
    { name: "Moscow Times", rssUrl: "https://www.themoscowtimes.com/rss/news", scope: "international" },
    { name: "Haaretz", rssUrl: "https://www.haaretz.com/cmlink/1.628752", scope: "international" },
    { name: "GlobalVoices", rssUrl: "https://globalvoices.org/feed/", scope: "international" },
    { name: "IRIN News", rssUrl: "https://www.thenewhumanitarian.org/rss.xml", scope: "international" },
    // Additional international outlets
    { name: "NK News", rssUrl: "https://www.nknews.org/feed/", scope: "international" },
    { name: "Inkstick Media", rssUrl: "https://inkstickmedia.com/feed/", scope: "international" },
    { name: "The National Interest", rssUrl: "https://nationalinterest.org/feed", scope: "international" },
    { name: "Defense One", rssUrl: "https://www.defenseone.com/rss/all/", scope: "international" },
    { name: "The Cipher Brief", rssUrl: "https://www.thecipherbrief.com/feed", scope: "international" },
    { name: "Asia Times", rssUrl: "https://asiatimes.com/feed/", scope: "international" },
    { name: "Americas Quarterly", rssUrl: "https://www.americasquarterly.org/feed/", scope: "international" },
    { name: "Responsible Statecraft", rssUrl: "https://responsiblestatecraft.org/feed/", scope: "international" },
    // Think tanks - international
    { name: "Foreign Affairs", rssUrl: "https://www.foreignaffairs.com/rss.xml", scope: "international" },
    { name: "Carnegie Endowment", rssUrl: "https://carnegieendowment.org/rss/solr/?fa=articles", scope: "international" },
    { name: "Council on Foreign Relations", rssUrl: "https://www.cfr.org/rss/analysis-brief", scope: "international" },
    { name: "CSIS Analysis", rssUrl: "https://www.csis.org/analysis/feed", scope: "international" },
    { name: "Brookings Global", rssUrl: "https://www.brookings.edu/topic/global-economy/feed/", scope: "international" },
    { name: "Chatham House", rssUrl: "https://www.chathamhouse.org/rss", scope: "international" },
    { name: "Atlantic Council", rssUrl: "https://www.atlanticcouncil.org/feed/", scope: "international" },
    { name: "Wilson Center", rssUrl: "https://www.wilsoncenter.org/rss.xml", scope: "international" },
    { name: "RAND Corporation", rssUrl: "https://www.rand.org/pubs/feed.xml", scope: "international" },
    { name: "Stimson Center", rssUrl: "https://www.stimson.org/feed/", scope: "international" },
    { name: "International Crisis Group", rssUrl: "https://www.crisisgroup.org/feed", scope: "international" },
    { name: "Brookings Foreign Policy", rssUrl: "https://www.brookings.edu/topic/foreign-policy/feed/", scope: "international" },
    { name: "War on the Rocks", rssUrl: "https://warontherocks.com/feed/", scope: "international" },
    { name: "Just Security", rssUrl: "https://www.justsecurity.org/feed/", scope: "international" },
    { name: "German Marshall Fund", rssUrl: "https://www.gmfus.org/feed", scope: "international" },
    { name: "European Council on Foreign Relations", rssUrl: "https://ecfr.eu/feed/", scope: "international" },
    { name: "Belfer Center", rssUrl: "https://www.belfercenter.org/rss.xml", scope: "international" },
    // Additional wire & global outlets
    { name: "AFP English", rssUrl: "https://www.afp.com/en/news-hub/rss", scope: "international" },
    { name: "Xinhua", rssUrl: "https://www.xinhuanet.com/english/rss/worldrss.xml", scope: "international" },
    { name: "RT World", rssUrl: "https://www.rt.com/rss/news/", scope: "international" },
    { name: "TASS", rssUrl: "https://tass.com/rss/v2.xml", scope: "international" },
    { name: "ANSA English", rssUrl: "https://www.ansa.it/english/english_rss.xml", scope: "international" },
    { name: "EFE English", rssUrl: "https://www.efe.com/efe/english/rss/1", scope: "international" },
    { name: "The Times of Israel", rssUrl: "https://www.timesofisrael.com/feed/", scope: "international" },
    { name: "The Jerusalem Post", rssUrl: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx", scope: "international" },
    { name: "Arab News", rssUrl: "https://www.arabnews.com/rss.xml", scope: "international" },
    { name: "The Times (UK)", rssUrl: "https://www.thetimes.co.uk/rss", scope: "international" },
    { name: "El País English", rssUrl: "https://english.elpais.com/rss/news/elpais_news.xml", scope: "international" },
    { name: "Le Monde English", rssUrl: "https://www.lemonde.fr/en/rss/une.xml", scope: "international" },
    { name: "Spiegel International", rssUrl: "https://www.spiegel.de/international/index.rss", scope: "international" },
    { name: "Reuters Asia", rssUrl: "https://feeds.reuters.com/reuters/APTopNews", scope: "international" },
    { name: "ABC Australia", rssUrl: "https://www.abc.net.au/news/feed/45910/rss.xml", scope: "international" },
    { name: "Sydney Morning Herald World", rssUrl: "https://www.smh.com.au/rss/world.xml", scope: "international" },
    { name: "CBC World", rssUrl: "https://www.cbc.ca/cmlink/rss-world", scope: "international" },
    { name: "Reuters Latin America", rssUrl: "https://feeds.reuters.com/reuters/AmericasTopNews", scope: "international" },
    { name: "MercoPress", rssUrl: "https://en.mercopress.com/rss/", scope: "international" },
    { name: "Caracas Chronicles", rssUrl: "https://www.caracaschronicles.com/feed/", scope: "international" },
    { name: "Polygraph", rssUrl: "https://www.polygraph.info/api/zptqoeurpot", scope: "international" },
    { name: "OCCRP", rssUrl: "https://www.occrp.org/en/rss.xml", scope: "international" },
    { name: "Bellingcat", rssUrl: "https://www.bellingcat.com/feed/", scope: "international" },
    // Expansion: more international + regional + analysis
    { name: "The Guardian US", rssUrl: "https://www.theguardian.com/us-news/rss", scope: "international" },
    { name: "BBC Politics", rssUrl: "https://feeds.bbci.co.uk/news/politics/rss.xml", scope: "international" },
    { name: "Sky News World", rssUrl: "https://feeds.skynews.com/feeds/rss/world.xml", scope: "international" },
    { name: "Independent World", rssUrl: "https://www.independent.co.uk/news/world/rss", scope: "international" },
    { name: "Telegraph World", rssUrl: "https://www.telegraph.co.uk/world-news/rss.xml", scope: "international" },
    { name: "ABC News Australia", rssUrl: "https://www.abc.net.au/news/feed/2942460/rss.xml", scope: "international" },
    { name: "Straits Times World", rssUrl: "https://www.straitstimes.com/news/world/rss.xml", scope: "international" },
    { name: "Hindustan Times World", rssUrl: "https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml", scope: "international" },
    { name: "Korea Herald", rssUrl: "https://www.koreaherald.com/common/rss_xml.php?ct=102", scope: "international" },
    { name: "Taipei Times", rssUrl: "https://www.taipeitimes.com/xml/index.rss", scope: "international" },
    { name: "Bangkok Post World", rssUrl: "https://www.bangkokpost.com/rss/data/world.xml", scope: "international" },
    { name: "Buenos Aires Herald", rssUrl: "https://buenosairesherald.com/feed", scope: "international" },
    { name: "Rio Times", rssUrl: "https://riotimesonline.com/feed/", scope: "international" },
    { name: "MEMRI", rssUrl: "https://www.memri.org/rss.xml", scope: "international" },
    { name: "Foreign Policy", rssUrl: "https://foreignpolicy.com/feed/", scope: "international" },
    { name: "Modern Diplomacy", rssUrl: "https://moderndiplomacy.eu/feed/", scope: "international" },
    { name: "EUobserver", rssUrl: "https://euobserver.com/rss.xml", scope: "international" },
    { name: "Politico Europe", rssUrl: "https://www.politico.eu/feed/", scope: "international" },
    { name: "RFE/RL", rssUrl: "https://www.rferl.org/api/zrqiteuuipt", scope: "international" },
    { name: "VOA News", rssUrl: "https://www.voanews.com/api/zmgqoe$lqi", scope: "international" },
    { name: "Mongabay", rssUrl: "https://news.mongabay.com/feed/", scope: "international" },
    { name: "ISW Reports", rssUrl: "https://www.understandingwar.org/rss.xml", scope: "international" },
    { name: "Brookings India", rssUrl: "https://www.brookings.edu/topic/india/feed/", scope: "international" },
    { name: "MERICS (China)", rssUrl: "https://merics.org/en/rss.xml", scope: "international" },
    { name: "Lowy Interpreter", rssUrl: "https://www.lowyinstitute.org/the-interpreter/rss.xml", scope: "international" },
    // Expansion: more international wire / regional / think-tank sources
    { name: "Reuters Europe", rssUrl: "https://feeds.reuters.com/reuters/UKWorldNews", scope: "international" },
    { name: "Reuters Africa", rssUrl: "https://feeds.reuters.com/reuters/AFRICAWorldNews", scope: "international" },
    { name: "DW Africa", rssUrl: "https://rss.dw.com/rdf/rss-en-africa", scope: "international" },
    { name: "Mail & Guardian (SA)", rssUrl: "https://mg.co.za/feed/", scope: "international" },
    { name: "Daily Maverick (SA)", rssUrl: "https://www.dailymaverick.co.za/feed/", scope: "international" },
    { name: "Premium Times (Nigeria)", rssUrl: "https://www.premiumtimesng.com/feed", scope: "international" },
    { name: "The East African", rssUrl: "https://www.theeastafrican.co.ke/rss.xml", scope: "international" },
    { name: "Egypt Independent", rssUrl: "https://egyptindependent.com/feed/", scope: "international" },
    { name: "Daily Sabah", rssUrl: "https://www.dailysabah.com/rssFeed/2", scope: "international" },
    { name: "TRT World", rssUrl: "https://www.trtworld.com/feed/rss", scope: "international" },
    { name: "Hurriyet Daily News", rssUrl: "https://www.hurriyetdailynews.com/rss", scope: "international" },
    { name: "Tehran Times", rssUrl: "https://www.tehrantimes.com/rss", scope: "international" },
    { name: "L'Orient Today (Lebanon)", rssUrl: "https://today.lorientlejour.com/feed", scope: "international" },
    { name: "+972 Magazine", rssUrl: "https://www.972mag.com/feed/", scope: "international" },
    { name: "Eurasia Review", rssUrl: "https://www.eurasiareview.com/feed/", scope: "international" },
    { name: "OpenDemocracy", rssUrl: "https://www.opendemocracy.net/feed/", scope: "international" },
    { name: "EUobserver", rssUrl: "https://euobserver.com/rss.xml", scope: "international" },
    { name: "Balkan Insight", rssUrl: "https://balkaninsight.com/feed/", scope: "international" },
    { name: "Visegrad Insight", rssUrl: "https://visegradinsight.eu/feed/", scope: "international" },
    { name: "Notes from Poland", rssUrl: "https://notesfrompoland.com/feed/", scope: "international" },
    { name: "Meduza English", rssUrl: "https://meduza.io/rss/en/all", scope: "international" },
    { name: "The Insider (RU)", rssUrl: "https://theins.ru/en/feed", scope: "international" },
    { name: "Novaya Gazeta Europe", rssUrl: "https://novayagazeta.eu/feed", scope: "international" },
    { name: "Ukrainska Pravda EN", rssUrl: "https://www.pravda.com.ua/eng/rss/", scope: "international" },
    { name: "Korea Times", rssUrl: "https://www.koreatimes.co.kr/rss/nation.xml", scope: "international" },
    { name: "Mainichi (JP)", rssUrl: "https://mainichi.jp/rss/etc/mainichi-flash.rss", scope: "international" },
    { name: "Asahi Shimbun EN", rssUrl: "https://www.asahi.com/ajw/rss/", scope: "international" },
    { name: "Frontier Myanmar", rssUrl: "https://www.frontiermyanmar.net/en/feed/", scope: "international" },
    { name: "Rappler (PH)", rssUrl: "https://www.rappler.com/feed/", scope: "international" },
    { name: "The Wire (India)", rssUrl: "https://thewire.in/rss", scope: "international" },
    { name: "Scroll.in", rssUrl: "https://scroll.in/feeds/all.rss", scope: "international" },
    { name: "Dawn (Pakistan)", rssUrl: "https://www.dawn.com/feed", scope: "international" },
    { name: "The Print (India)", rssUrl: "https://theprint.in/feed/", scope: "international" },
    { name: "Globe and Mail (Canada)", rssUrl: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/", scope: "international" },
    { name: "National Post (Canada)", rssUrl: "https://nationalpost.com/feed/", scope: "international" },
    { name: "Folha de S.Paulo EN", rssUrl: "https://www1.folha.uol.com.br/internacional/en/rss091.xml", scope: "international" },
    { name: "BuzzFeed News World", rssUrl: "https://www.buzzfeednews.com/world.xml", scope: "international" },
    { name: "Coda Story", rssUrl: "https://www.codastory.com/feed/", scope: "international" },
    { name: "Rest of World", rssUrl: "https://restofworld.org/feed/latest/", scope: "international" },
    { name: "Devex", rssUrl: "https://www.devex.com/news.rss", scope: "international" },
    { name: "ICIJ", rssUrl: "https://www.icij.org/feed/", scope: "international" },
    { name: "ECFR Commentary", rssUrl: "https://ecfr.eu/category/commentary/feed/", scope: "international" },
    { name: "IISS Analysis", rssUrl: "https://www.iiss.org/blogs/feed", scope: "international" },
    { name: "RUSI Commentary", rssUrl: "https://rusi.org/explore-our-research/publications/rss.xml", scope: "international" },
    { name: "SIPRI", rssUrl: "https://www.sipri.org/rss.xml", scope: "international" },
    { name: "Carnegie Russia/Eurasia", rssUrl: "https://carnegieendowment.org/rss/programs/russia.xml", scope: "international" },
    { name: "Carnegie China", rssUrl: "https://carnegieendowment.org/rss/programs/china.xml", scope: "international" },
    { name: "Carnegie Middle East", rssUrl: "https://carnegieendowment.org/rss/programs/middleeast.xml", scope: "international" },
    { name: "Brookings Africa", rssUrl: "https://www.brookings.edu/topic/sub-saharan-africa/feed/", scope: "international" },
    { name: "Brookings Middle East", rssUrl: "https://www.brookings.edu/topic/middle-east-north-africa/feed/", scope: "international" },
    { name: "USIP Analysis", rssUrl: "https://www.usip.org/rss-feeds/all", scope: "international" },
    { name: "MEI Publications", rssUrl: "https://www.mei.edu/rss.xml", scope: "international" },
  ],
  national: [
    // Major political news
    { name: "Politico Playbook", rssUrl: "https://rss.politico.com/playbook.xml", scope: "national" },
    { name: "Politico Congress", rssUrl: "https://rss.politico.com/congress.xml", scope: "national" },
    { name: "The Hill", rssUrl: "https://thehill.com/feed/", scope: "national" },
    { name: "Roll Call", rssUrl: "https://www.rollcall.com/feed/", scope: "national" },
    { name: "Axios", rssUrl: "https://api.axios.com/feed/", scope: "national" },
    { name: "1440 Daily Digest", rssUrl: "https://www.join1440.com/rss", scope: "national" },
    { name: "Ground News", rssUrl: "https://ground.news/rss", scope: "national" },
    { name: "CQ Roll Call", rssUrl: "https://plus.cq.com/rss/news", scope: "national" },
    // Wire & broadcast
    { name: "AP News Politics", rssUrl: "https://rsshub.app/apnews/topics/politics", scope: "national" },
    { name: "Reuters US Politics", rssUrl: "https://feeds.reuters.com/Reuters/PoliticsNews", scope: "national" },
    { name: "NPR Politics", rssUrl: "https://feeds.npr.org/1014/rss.xml", scope: "national" },
    { name: "NBC News Politics", rssUrl: "https://feeds.nbcnews.com/nbcnews/public/politics", scope: "national" },
    { name: "CBS News Politics", rssUrl: "https://www.cbsnews.com/latest/rss/politics", scope: "national" },
    { name: "Washington Post Politics", rssUrl: "https://feeds.washingtonpost.com/rss/politics", scope: "national" },
    // Additional wire/broadcast
    { name: "CNN Politics", rssUrl: "https://rss.cnn.com/rss/cnn_allpolitics.rss", scope: "national" },
    { name: "ABC News Politics", rssUrl: "https://abcnews.go.com/abcnews/politicsheadlines", scope: "national" },
    { name: "USA Today Politics", rssUrl: "https://rssfeeds.usatoday.com/UsatodaycomWashington-TopStories", scope: "national" },
    { name: "PBS NewsHour", rssUrl: "https://www.pbs.org/newshour/feeds/rss/politics", scope: "national" },
    { name: "C-SPAN", rssUrl: "https://www.c-span.org/rss/", scope: "national" },
    // Newsletters & digests
    { name: "Punchbowl News", rssUrl: "https://punchbowl.news/feed/", scope: "national" },
    { name: "Semafor", rssUrl: "https://www.semafor.com/feed", scope: "national" },
    { name: "FiveThirtyEight", rssUrl: "https://fivethirtyeight.com/feed/", scope: "national" },
    { name: "RealClearPolitics", rssUrl: "https://www.realclearpolitics.com/index.xml", scope: "national" },
    { name: "The Dispatch", rssUrl: "https://thedispatch.com/feed/", scope: "national" },
    { name: "AllSides", rssUrl: "https://www.allsides.com/rss", scope: "national" },
    // Investigative & policy
    { name: "ProPublica", rssUrl: "https://www.propublica.org/feeds/propublica/main", scope: "national" },
    { name: "The Intercept", rssUrl: "https://theintercept.com/feed/?lang=en", scope: "national" },
    { name: "Vox Policy", rssUrl: "https://www.vox.com/rss/policy-and-politics/index.xml", scope: "national" },
    { name: "Slate Politics", rssUrl: "https://slate.com/feeds/politics.xml", scope: "national" },
    { name: "The Atlantic Politics", rssUrl: "https://www.theatlantic.com/feed/channel/politics/", scope: "national" },
    // Multi-partisan / right-leaning
    { name: "Daily Caller", rssUrl: "https://dailycaller.com/feed/", scope: "national" },
    { name: "Washington Examiner", rssUrl: "https://www.washingtonexaminer.com/feed", scope: "national" },
    { name: "National Review", rssUrl: "https://www.nationalreview.com/feed/", scope: "national" },
    { name: "Washington Free Beacon", rssUrl: "https://freebeacon.com/feed/", scope: "national" },
    { name: "The Federalist", rssUrl: "https://thefederalist.com/feed/", scope: "national" },
    { name: "Townhall", rssUrl: "https://townhall.com/rss/", scope: "national" },
    { name: "The Daily Wire", rssUrl: "https://www.dailywire.com/feeds/rss.xml", scope: "national" },
    { name: "Breitbart", rssUrl: "https://feeds.feedburner.com/breitbart", scope: "national" },
    { name: "RedState", rssUrl: "https://redstate.com/feed", scope: "national" },
    // Left-leaning
    { name: "The Nation", rssUrl: "https://www.thenation.com/feed/", scope: "national" },
    { name: "Mother Jones", rssUrl: "https://www.motherjones.com/feed/", scope: "national" },
    { name: "Talking Points Memo", rssUrl: "https://talkingpointsmemo.com/feed", scope: "national" },
    { name: "The New Republic", rssUrl: "https://newrepublic.com/feed", scope: "national" },
    { name: "The Daily Beast", rssUrl: "https://feeds.thedailybeast.com/rss/articles", scope: "national" },
    { name: "HuffPost Politics", rssUrl: "https://www.huffpost.com/section/politics/feed", scope: "national" },
    { name: "Salon", rssUrl: "https://www.salon.com/feed/", scope: "national" },
    { name: "Jacobin", rssUrl: "https://jacobin.com/feed/", scope: "national" },
    { name: "Democracy Now!", rssUrl: "https://www.democracynow.org/democracynow.rss", scope: "national" },
    // Think tanks - national
    { name: "Brookings US Policy", rssUrl: "https://www.brookings.edu/topic/us-politics-government/feed/", scope: "national" },
    { name: "Heritage Foundation", rssUrl: "https://www.heritage.org/rss/commentary", scope: "national" },
    { name: "Center for American Progress", rssUrl: "https://www.americanprogress.org/feed/", scope: "national" },
    { name: "AEI", rssUrl: "https://www.aei.org/feed/", scope: "national" },
    { name: "Cato Institute", rssUrl: "https://www.cato.org/rss/recent-opeds.xml", scope: "national" },
    { name: "Urban Institute", rssUrl: "https://www.urban.org/rss.xml", scope: "national" },
    { name: "Niskanen Center", rssUrl: "https://www.niskanencenter.org/feed/", scope: "national" },
    { name: "Third Way", rssUrl: "https://www.thirdway.org/feed", scope: "national" },
    { name: "R Street Institute", rssUrl: "https://www.rstreet.org/feed/", scope: "national" },
    { name: "Manhattan Institute", rssUrl: "https://www.manhattan-institute.org/feed", scope: "national" },
    { name: "Hoover Institution", rssUrl: "https://www.hoover.org/rss.xml", scope: "national" },
    { name: "Economic Policy Institute", rssUrl: "https://www.epi.org/feed/", scope: "national" },
    { name: "Center on Budget", rssUrl: "https://www.cbpp.org/rss/rss.xml", scope: "national" },
    { name: "Bipartisan Policy Center", rssUrl: "https://bipartisanpolicy.org/feed/", scope: "national" },
    { name: "Tax Foundation", rssUrl: "https://taxfoundation.org/feed/", scope: "national" },
    { name: "Committee for Responsible Federal Budget", rssUrl: "https://www.crfb.org/rss.xml", scope: "national" },
    { name: "American Action Forum", rssUrl: "https://www.americanactionforum.org/feed/", scope: "national" },
    { name: "New America", rssUrl: "https://www.newamerica.org/feed/", scope: "national" },
    // Legal
    { name: "SCOTUSblog", rssUrl: "https://www.scotusblog.com/feed/", scope: "national" },
    { name: "Lawfare", rssUrl: "https://www.lawfaremedia.org/feed", scope: "national" },
    { name: "Brennan Center", rssUrl: "https://www.brennancenter.org/rss", scope: "national" },
    { name: "Volokh Conspiracy", rssUrl: "https://reason.com/volokh/feed/", scope: "national" },
    // Economy & Business
    { name: "MarketWatch Economy", rssUrl: "https://feeds.marketwatch.com/marketwatch/economy", scope: "national" },
    { name: "CNBC Politics", rssUrl: "https://www.cnbc.com/id/10000113/device/rss/rss.html", scope: "national" },
    // Additional national sources
    { name: "Techdirt", rssUrl: "https://www.techdirt.com/feed/", scope: "national" },
    { name: "The Markup", rssUrl: "https://themarkup.org/feeds/rss.xml", scope: "national" },
    { name: "Defense News", rssUrl: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", scope: "national" },
    { name: "Military Times", rssUrl: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml", scope: "national" },
    { name: "E&E News", rssUrl: "https://www.eenews.net/feed/", scope: "national" },
    { name: "Utility Dive", rssUrl: "https://www.utilitydive.com/feeds/news/", scope: "national" },
    { name: "Transport Topics", rssUrl: "https://www.ttnews.com/rss.xml", scope: "national" },
    { name: "Modern Healthcare", rssUrl: "https://www.modernhealthcare.com/section/rss", scope: "national" },
    { name: "Responsible Statecraft", rssUrl: "https://responsiblestatecraft.org/feed/", scope: "national" },
    { name: "The Bulwark", rssUrl: "https://www.thebulwark.com/feed/", scope: "national" },
    { name: "The American Conservative", rssUrl: "https://www.theamericanconservative.com/feed/", scope: "national" },
    { name: "Washington Monthly", rssUrl: "https://washingtonmonthly.com/feed/", scope: "national" },
    { name: "National Journal", rssUrl: "https://www.nationaljournal.com/feed", scope: "national" },
    { name: "Government Executive", rssUrl: "https://www.govexec.com/rss/all/", scope: "national" },
    { name: "FedScoop", rssUrl: "https://fedscoop.com/feed/", scope: "national" },
    // Additional national outlets across the spectrum
    { name: "Wall Street Journal Politics", rssUrl: "https://feeds.a.dj.com/rss/RSSPolitics.xml", scope: "national" },
    { name: "New York Times Politics", rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", scope: "national" },
    { name: "New York Post", rssUrl: "https://nypost.com/feed/", scope: "national" },
    { name: "Washington Times", rssUrl: "https://www.washingtontimes.com/rss/headlines/news/politics/", scope: "national" },
    { name: "Just the News", rssUrl: "https://justthenews.com/feed", scope: "national" },
    { name: "The Epoch Times", rssUrl: "https://www.theepochtimes.com/c-us-politics/feed", scope: "national" },
    { name: "PJ Media", rssUrl: "https://pjmedia.com/feed", scope: "national" },
    { name: "The Blaze", rssUrl: "https://www.theblaze.com/feeds/feed.rss", scope: "national" },
    { name: "Human Events", rssUrl: "https://humanevents.com/feed/", scope: "national" },
    { name: "Western Journal", rssUrl: "https://www.westernjournal.com/feed/", scope: "national" },
    { name: "The Post Millennial", rssUrl: "https://thepostmillennial.com/feed", scope: "national" },
    { name: "Reason", rssUrl: "https://reason.com/feed/", scope: "national" },
    { name: "The Free Press", rssUrl: "https://www.thefp.com/feed", scope: "national" },
    { name: "Tangle", rssUrl: "https://www.readtangle.com/rss/", scope: "national" },
    { name: "Racket News", rssUrl: "https://www.racket.news/feed", scope: "national" },
    { name: "Public", rssUrl: "https://public.substack.com/feed", scope: "national" },
    { name: "The Ankler", rssUrl: "https://theankler.com/feed", scope: "national" },
    { name: "Time Politics", rssUrl: "https://time.com/feed/", scope: "national" },
    { name: "Newsweek Politics", rssUrl: "https://www.newsweek.com/rss", scope: "national" },
    { name: "Rolling Stone Politics", rssUrl: "https://www.rollingstone.com/politics/feed/", scope: "national" },
    { name: "Mediaite", rssUrl: "https://www.mediaite.com/feed/", scope: "national" },
    { name: "Bloomberg Politics", rssUrl: "https://feeds.bloomberg.com/politics/news.rss", scope: "national" },
    { name: "Fox News Politics", rssUrl: "https://moxie.foxnews.com/google-publisher/politics.xml", scope: "national" },
    { name: "Newsmax Politics", rssUrl: "https://www.newsmax.com/rss/Politics/1/", scope: "national" },
    { name: "OAN", rssUrl: "https://www.oann.com/category/politics/feed/", scope: "national" },
    { name: "MSNBC", rssUrl: "https://www.msnbc.com/feeds/latest", scope: "national" },
    { name: "Common Dreams", rssUrl: "https://www.commondreams.org/feeds/news.rss", scope: "national" },
    { name: "Truthout", rssUrl: "https://truthout.org/feed/?withoutcomments=1", scope: "national" },
    { name: "AlterNet", rssUrl: "https://www.alternet.org/feeds/feed.rss", scope: "national" },
    { name: "Claremont Review", rssUrl: "https://claremontreviewofbooks.com/feed/", scope: "national" },
    { name: "First Things", rssUrl: "https://www.firstthings.com/rss-feed", scope: "national" },
    { name: "Reuters Health", rssUrl: "https://feeds.reuters.com/reuters/healthNews", scope: "national" },
    { name: "STAT News", rssUrl: "https://www.statnews.com/feed/", scope: "national" },
    { name: "Inside Higher Ed", rssUrl: "https://www.insidehighered.com/rss.xml", scope: "national" },
    // Expansion: more national outlets, niche policy verticals
    { name: "Politico Magazine", rssUrl: "https://www.politico.com/rss/magazine.xml", scope: "national" },
    { name: "Politico White House", rssUrl: "https://rss.politico.com/whitehouse.xml", scope: "national" },
    { name: "Politico Health Care", rssUrl: "https://rss.politico.com/healthcare.xml", scope: "national" },
    { name: "Politico Defense", rssUrl: "https://rss.politico.com/defense.xml", scope: "national" },
    { name: "Politico Energy", rssUrl: "https://rss.politico.com/energy.xml", scope: "national" },
    { name: "Politico Tech", rssUrl: "https://rss.politico.com/morningtech.xml", scope: "national" },
    { name: "Politico Education", rssUrl: "https://rss.politico.com/morningeducation.xml", scope: "national" },
    { name: "Yahoo News Politics", rssUrl: "https://www.yahoo.com/news/rss/politics", scope: "national" },
    { name: "Forbes Politics", rssUrl: "https://www.forbes.com/policy/feed/", scope: "national" },
    { name: "The Conversation US Politics", rssUrl: "https://theconversation.com/us/politics/articles.atom", scope: "national" },
    { name: "Vox Identities", rssUrl: "https://www.vox.com/rss/identities/index.xml", scope: "national" },
    { name: "Mother Jones Politics", rssUrl: "https://www.motherjones.com/politics/feed/", scope: "national" },
    { name: "Heatmap News", rssUrl: "https://heatmap.news/feed", scope: "national" },
    { name: "Inside Defense", rssUrl: "https://insidedefense.com/rss.xml", scope: "national" },
    { name: "Breaking Defense", rssUrl: "https://breakingdefense.com/feed/", scope: "national" },
    { name: "DefenseScoop", rssUrl: "https://defensescoop.com/feed/", scope: "national" },
    { name: "Nextgov", rssUrl: "https://www.nextgov.com/rss/all/", scope: "national" },
    { name: "Federal News Network", rssUrl: "https://federalnewsnetwork.com/feed/", scope: "national" },
    { name: "Government Computer News", rssUrl: "https://gcn.com/rss-feeds/all.aspx", scope: "national" },
    { name: "MeriTalk", rssUrl: "https://www.meritalk.com/feed/", scope: "national" },
    { name: "Healthcare Dive", rssUrl: "https://www.healthcaredive.com/feeds/news/", scope: "national" },
    { name: "Fierce Healthcare", rssUrl: "https://www.fiercehealthcare.com/rss/xml", scope: "national" },
    { name: "BioPharma Dive", rssUrl: "https://www.biopharmadive.com/feeds/news/", scope: "national" },
    { name: "Endpoints News", rssUrl: "https://endpts.com/feed/", scope: "national" },
    { name: "Politicker", rssUrl: "https://politicker.com/feed/", scope: "national" },
    { name: "Mediaite Politics", rssUrl: "https://www.mediaite.com/category/politics/feed/", scope: "national" },
    { name: "RealClearPolicy", rssUrl: "https://www.realclearpolicy.com/index.xml", scope: "national" },
    { name: "RealClearDefense", rssUrl: "https://www.realcleardefense.com/index.xml", scope: "national" },
    { name: "RealClearEnergy", rssUrl: "https://www.realclearenergy.org/index.xml", scope: "national" },
    { name: "TheGrio", rssUrl: "https://thegrio.com/feed/", scope: "national" },
    { name: "Latino Rebels", rssUrl: "https://www.latinorebels.com/feed/", scope: "national" },
    { name: "Capital B", rssUrl: "https://capitalbnews.org/feed/", scope: "national" },
    { name: "Word In Black", rssUrl: "https://wordinblack.com/feed/", scope: "national" },
    { name: "Religion News Service", rssUrl: "https://religionnews.com/feed/", scope: "national" },
    { name: "Christianity Today Politics", rssUrl: "https://www.christianitytoday.com/ct/rss/articles.xml", scope: "national" },
    { name: "Sojourners", rssUrl: "https://sojo.net/news/feed", scope: "national" },
    { name: "Pacific Council", rssUrl: "https://www.pacificcouncil.org/feed", scope: "national" },
    { name: "RAND Blog", rssUrl: "https://www.rand.org/blog.feed.xml", scope: "national" },
    { name: "Council of Economic Advisers", rssUrl: "https://www.whitehouse.gov/cea/written-materials/feed/", scope: "national" },
    { name: "Tax Policy Center", rssUrl: "https://www.taxpolicycenter.org/rss.xml", scope: "national" },
    { name: "Mercatus Center", rssUrl: "https://www.mercatus.org/feed", scope: "national" },
    { name: "Independent Institute", rssUrl: "https://www.independent.org/feed/", scope: "national" },
    { name: "Roosevelt Institute", rssUrl: "https://rooseveltinstitute.org/feed/", scope: "national" },
    { name: "People's Policy Project", rssUrl: "https://www.peoplespolicyproject.org/feed/", scope: "national" },
    { name: "Center for Economic and Policy Research", rssUrl: "https://cepr.net/feed/", scope: "national" },
    // Expansion: more national political / policy / investigative sources
    { name: "Notus", rssUrl: "https://www.notus.org/feed", scope: "national" },
    { name: "Bolts Magazine", rssUrl: "https://boltsmag.org/feed/", scope: "national" },
    { name: "Democracy Docket", rssUrl: "https://www.democracydocket.com/feed/", scope: "national" },
    { name: "Election Law Blog", rssUrl: "https://electionlawblog.org/?feed=rss2", scope: "national" },
    { name: "Balls and Strikes", rssUrl: "https://ballsandstrikes.org/feed/", scope: "national" },
    { name: "The American Prospect", rssUrl: "https://prospect.org/api/rss/all.rss", scope: "national" },
    { name: "Washington Monthly", rssUrl: "https://washingtonmonthly.com/feed/", scope: "national" },
    { name: "American Conservative", rssUrl: "https://www.theamericanconservative.com/feed/", scope: "national" },
    { name: "Reason Magazine", rssUrl: "https://reason.com/feed/", scope: "national" },
    { name: "Compact Magazine", rssUrl: "https://www.compactmag.com/feed/", scope: "national" },
    { name: "Persuasion", rssUrl: "https://www.persuasion.community/feed", scope: "national" },
    { name: "The Free Press", rssUrl: "https://www.thefp.com/feed", scope: "national" },
    { name: "Tangle News", rssUrl: "https://www.readtangle.com/rss/", scope: "national" },
    { name: "Heatmap News", rssUrl: "https://heatmap.news/feed", scope: "national" },
    { name: "E&E News", rssUrl: "https://www.eenews.net/rss/", scope: "national" },
    { name: "Inside Higher Ed", rssUrl: "https://www.insidehighered.com/rss.xml", scope: "national" },
    { name: "Higher Ed Dive", rssUrl: "https://www.highereddive.com/feeds/news/", scope: "national" },
    { name: "Health Affairs", rssUrl: "https://www.healthaffairs.org/rss", scope: "national" },
    { name: "STAT News", rssUrl: "https://www.statnews.com/feed/", scope: "national" },
    { name: "Modern Healthcare", rssUrl: "https://www.modernhealthcare.com/rss-feeds", scope: "national" },
    { name: "Government Executive", rssUrl: "https://www.govexec.com/rss/all/", scope: "national" },
    { name: "Federal News Network", rssUrl: "https://federalnewsnetwork.com/feed/", scope: "national" },
    { name: "Nextgov", rssUrl: "https://www.nextgov.com/rss/all/", scope: "national" },
    { name: "Government Technology", rssUrl: "https://www.govtech.com/rss/news.xml", scope: "national" },
    { name: "MeriTalk", rssUrl: "https://www.meritalk.com/feed/", scope: "national" },
    { name: "Roll Call Heard on the Hill", rssUrl: "https://rollcall.com/feed/", scope: "national" },
    { name: "American Independent", rssUrl: "https://americanindependent.com/feed/", scope: "national" },
    { name: "Status Coup", rssUrl: "https://statuscoup.com/feed/", scope: "national" },
    { name: "Crooked Media", rssUrl: "https://crooked.com/feed/", scope: "national" },
    { name: "Real Clear Politics", rssUrl: "https://www.realclearpolitics.com/index.xml", scope: "national" },
    { name: "Sabato's Crystal Ball", rssUrl: "https://centerforpolitics.org/crystalball/feed/", scope: "national" },
    { name: "Cook Political Report", rssUrl: "https://www.cookpolitical.com/rss.xml", scope: "national" },
    { name: "Inside Elections", rssUrl: "https://insideelections.com/feed", scope: "national" },
    { name: "Decision Desk HQ", rssUrl: "https://decisiondeskhq.com/feed/", scope: "national" },
    { name: "Split Ticket", rssUrl: "https://split-ticket.org/feed/", scope: "national" },
    { name: "The Downballot", rssUrl: "https://www.thedownballot.com/feed", scope: "national" },
    { name: "Daily Kos Elections", rssUrl: "https://www.dailykos.com/blogs/elections.rss", scope: "national" },
    { name: "Politico Magazine", rssUrl: "https://www.politico.com/rss/politicopicks.xml", scope: "national" },
    { name: "Politico White House", rssUrl: "https://rss.politico.com/whitehouse.xml", scope: "national" },
    { name: "Politico Defense", rssUrl: "https://rss.politico.com/defense.xml", scope: "national" },
    { name: "Politico Health", rssUrl: "https://rss.politico.com/healthcare.xml", scope: "national" },
    { name: "Politico Energy", rssUrl: "https://rss.politico.com/energy.xml", scope: "national" },
    { name: "Politico Tech", rssUrl: "https://rss.politico.com/morningtech.xml", scope: "national" },
    { name: "Politico Education", rssUrl: "https://rss.politico.com/education.xml", scope: "national" },
    { name: "ProPublica Investigations", rssUrl: "https://www.propublica.org/feeds/propublica/main", scope: "national" },
    { name: "Center for Public Integrity", rssUrl: "https://publicintegrity.org/feed/", scope: "national" },
    { name: "Reveal (CIR)", rssUrl: "https://revealnews.org/feed/", scope: "national" },
    { name: "ICIJ US Stories", rssUrl: "https://www.icij.org/investigations/feed/", scope: "national" },
    { name: "OpenSecrets News", rssUrl: "https://www.opensecrets.org/news/feed/", scope: "national" },
    { name: "MapLight News", rssUrl: "https://maplight.org/feed/", scope: "national" },
    { name: "Issue One", rssUrl: "https://issueone.org/feed/", scope: "national" },
    { name: "Documented", rssUrl: "https://documented.net/feed", scope: "national" },
    { name: "Citizens for Responsibility (CREW)", rssUrl: "https://www.citizensforethics.org/feed/", scope: "national" },
    { name: "Government Accountability Project", rssUrl: "https://whistleblower.org/feed/", scope: "national" },
    { name: "Freedom of the Press Foundation", rssUrl: "https://freedom.press/news/feed/", scope: "national" },
    { name: "Knight First Amendment Institute", rssUrl: "https://knightcolumbia.org/feed", scope: "national" },
    { name: "FIRE (Free Speech)", rssUrl: "https://www.thefire.org/news.xml", scope: "national" },
    { name: "Tech Policy Press", rssUrl: "https://techpolicy.press/feed/", scope: "national" },
    { name: "Protocol / Source", rssUrl: "https://www.protocol.com/feeds/feed.rss", scope: "national" },
    { name: "404 Media", rssUrl: "https://www.404media.co/rss/", scope: "national" },
    { name: "The Markup", rssUrl: "https://themarkup.org/feeds/rss.xml", scope: "national" },
    { name: "Wired Politics", rssUrl: "https://www.wired.com/feed/category/politics/latest/rss", scope: "national" },
    { name: "Wired Security", rssUrl: "https://www.wired.com/feed/category/security/latest/rss", scope: "national" },
    { name: "Lawfare Daily", rssUrl: "https://www.lawfaremedia.org/rss.xml", scope: "national" },
    { name: "SCOTUSblog", rssUrl: "https://www.scotusblog.com/feed/", scope: "national" },
    { name: "Above the Law", rssUrl: "https://abovethelaw.com/feed/", scope: "national" },
    { name: "Law360 (free)", rssUrl: "https://www.law360.com/rss", scope: "national" },
    { name: "Reuters Legal", rssUrl: "https://www.reuters.com/legal/feed/", scope: "national" },
    { name: "Bloomberg Politics", rssUrl: "https://feeds.bloomberg.com/politics/news.rss", scope: "national" },
    { name: "Bloomberg Government", rssUrl: "https://about.bgov.com/feed/", scope: "national" },
    { name: "Forbes Politics", rssUrl: "https://www.forbes.com/policy/feed/", scope: "national" },
    { name: "Newsweek Politics", rssUrl: "https://www.newsweek.com/rss", scope: "national" },
    { name: "Time Politics", rssUrl: "https://feeds.feedburner.com/time/politics", scope: "national" },
    { name: "Vox", rssUrl: "https://www.vox.com/rss/index.xml", scope: "national" },
    { name: "Ezra Klein Show", rssUrl: "https://feeds.simplecast.com/82FI35Px", scope: "national" },
    { name: "The Bulwark", rssUrl: "https://www.thebulwark.com/feed", scope: "national" },
    { name: "Ground Truths", rssUrl: "https://erictopol.substack.com/feed", scope: "national" },
    { name: "Public Notice (Aaron Rupar)", rssUrl: "https://www.publicnotice.co/feed", scope: "national" },
    { name: "Popular Information", rssUrl: "https://popular.info/feed", scope: "national" },
    { name: "Heated", rssUrl: "https://heated.world/feed", scope: "national" },
    { name: "The Status Kuo", rssUrl: "https://statuskuo.substack.com/feed", scope: "national" },
    { name: "Letters from an American", rssUrl: "https://heathercoxrichardson.substack.com/feed", scope: "national" },
    { name: "Robert Reich", rssUrl: "https://robertreich.substack.com/feed", scope: "national" },
    { name: "The Contrarian", rssUrl: "https://contrarian.substack.com/feed", scope: "national" },
    { name: "Nieman Lab", rssUrl: "https://www.niemanlab.org/feed/", scope: "national" },
    { name: "CJR (Columbia Journalism Review)", rssUrl: "https://www.cjr.org/feed", scope: "national" },
    { name: "Press Watch (Dan Froomkin)", rssUrl: "https://presswatchers.org/feed/", scope: "national" },
    { name: "Polygraph (US Politics)", rssUrl: "https://www.polygraph.info/api/zptqoeurpot", scope: "national" },
    { name: "AllSides Headline Roundups", rssUrl: "https://www.allsides.com/rss/news", scope: "national" },
  ],
  state: [
    // National outlets with state focus
    { name: "Stateline (Pew)", rssUrl: "https://stateline.org/feed/", scope: "state" },
    { name: "Route Fifty", rssUrl: "https://www.route-fifty.com/rss/all/", scope: "state" },
    { name: "Governing", rssUrl: "https://www.governing.com/rss", scope: "state" },
    { name: "State Legislatures Magazine", rssUrl: "https://www.ncsl.org/rss", scope: "state" },
    { name: "Ballotpedia News", rssUrl: "https://news.ballotpedia.org/feed/", scope: "state" },
    { name: "States Newsroom", rssUrl: "https://statesnewsroom.com/feed/", scope: "state" },
    { name: "NCSL Blog", rssUrl: "https://www.ncsl.org/blog/feed", scope: "state" },
    { name: "NGA Newsroom", rssUrl: "https://www.nga.org/news/feed/", scope: "state" },
    { name: "StateScoop", rssUrl: "https://statescoop.com/feed/", scope: "state" },
    { name: "CSG Knowledge Center", rssUrl: "https://web.csg.org/feed/", scope: "state" },
    // Issue-specific state coverage
    { name: "Kaiser Health News", rssUrl: "https://kffhealthnews.org/feed/", scope: "state" },
    { name: "The 19th", rssUrl: "https://19thnews.org/feed/", scope: "state" },
    { name: "Education Week", rssUrl: "https://www.edweek.org/feed", scope: "state" },
    { name: "Chalkbeat", rssUrl: "https://www.chalkbeat.org/feed/", scope: "state" },
    { name: "Tax Foundation", rssUrl: "https://taxfoundation.org/feed/", scope: "state" },
    { name: "Grist", rssUrl: "https://grist.org/feed/", scope: "state" },
    { name: "Inside Climate News", rssUrl: "https://insideclimatenews.org/feed/", scope: "state" },
    { name: "Pew Research State", rssUrl: "https://www.pewresearch.org/topic/politics-policy/political-issues/state-policy/feed/", scope: "state" },
    { name: "Hechinger Report", rssUrl: "https://hechingerreport.org/feed/", scope: "state" },
    { name: "POLITICO State", rssUrl: "https://rss.politico.com/states.xml", scope: "state" },
    // Criminal justice & social policy
    { name: "The Marshall Project", rssUrl: "https://www.themarshallproject.org/rss/index.rss", scope: "state" },
    { name: "The Appeal", rssUrl: "https://theappeal.org/feed/", scope: "state" },
    { name: "Reason Foundation", rssUrl: "https://reason.org/feed/", scope: "state" },
    // Election-specific
    { name: "Cook Political Report", rssUrl: "https://www.cookpolitical.com/feed", scope: "state" },
    { name: "Sabato Crystal Ball", rssUrl: "https://centerforpolitics.org/crystalball/feed/", scope: "state" },
    { name: "Inside Elections", rssUrl: "https://insideelections.com/feed", scope: "state" },
    { name: "Decision Desk HQ", rssUrl: "https://decisiondeskhq.com/feed/", scope: "state" },
    // State-specific networks (expanded)
    { name: "CalMatters", rssUrl: "https://calmatters.org/feed/", scope: "state" },
    { name: "Texas Tribune", rssUrl: "https://www.texastribune.org/feeds/latest/", scope: "state" },
    { name: "The Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed", scope: "state" },
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/feed", scope: "state" },
    { name: "Wisconsin Watch", rssUrl: "https://wisconsinwatch.org/feed/", scope: "state" },
    { name: "Pennsylvania Capital-Star", rssUrl: "https://www.penncapital-star.com/feed/", scope: "state" },
    { name: "NC Policy Watch", rssUrl: "https://ncpolicywatch.com/feed/", scope: "state" },
    { name: "Georgia Recorder", rssUrl: "https://georgiarecorder.com/feed/", scope: "state" },
    { name: "Arizona Mirror", rssUrl: "https://azmirror.com/feed/", scope: "state" },
    { name: "Florida Phoenix", rssUrl: "https://floridaphoenix.com/feed/", scope: "state" },
    { name: "Minnesota Reformer", rssUrl: "https://minnesotareformer.com/feed/", scope: "state" },
    { name: "Ohio Capital Journal", rssUrl: "https://ohiocapitaljournal.com/feed/", scope: "state" },
    { name: "Virginia Mercury", rssUrl: "https://virginiamercury.com/feed/", scope: "state" },
    { name: "New Hampshire Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/", scope: "state" },
    { name: "Iowa Capital Dispatch", rssUrl: "https://iowacapitaldispatch.com/feed/", scope: "state" },
    { name: "Colorado Sun", rssUrl: "https://coloradosun.com/feed/", scope: "state" },
    { name: "Oregon Capital Chronicle", rssUrl: "https://oregoncapitalchronicle.com/feed/", scope: "state" },
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/", scope: "state" },
    { name: "Missouri Independent", rssUrl: "https://missouriindependent.com/feed/", scope: "state" },
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/", scope: "state" },
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/", scope: "state" },
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/", scope: "state" },
    // Additional state outlets
    { name: "Michigan Advance", rssUrl: "https://michiganadvance.com/feed/", scope: "state" },
    { name: "Nevada Current", rssUrl: "https://nevadacurrent.com/feed/", scope: "state" },
    { name: "North Carolina Newsline", rssUrl: "https://ncnewsline.com/feed/", scope: "state" },
    { name: "West Virginia Watch", rssUrl: "https://westvirginiawatch.com/feed/", scope: "state" },
    { name: "Tennessee Lookout", rssUrl: "https://tennesseelookout.com/feed/", scope: "state" },
    { name: "South Carolina Daily Gazette", rssUrl: "https://scdailygazette.com/feed/", scope: "state" },
    { name: "Alabama Reflector", rssUrl: "https://alabamareflector.com/feed/", scope: "state" },
    { name: "Mississippi Free Press", rssUrl: "https://www.mississippifreepress.org/feed/", scope: "state" },
    { name: "Oklahoma Voice", rssUrl: "https://oklahomavoice.com/feed/", scope: "state" },
    { name: "Spotlight PA", rssUrl: "https://www.spotlightpa.org/feeds/all.rss", scope: "state" },
    { name: "Bolts Magazine", rssUrl: "https://boltsmag.org/feed/", scope: "state" },
    { name: "Energy News Network", rssUrl: "https://energynews.us/feed/", scope: "state" },
    { name: "Pluribus News", rssUrl: "https://pluribusnews.com/feed/", scope: "state" },
    // Expansion: more state newsrooms and capitol coverage
    { name: "Maryland Matters", rssUrl: "https://marylandmatters.org/feed/", scope: "state" },
    { name: "New Jersey Monitor", rssUrl: "https://newjerseymonitor.com/feed/", scope: "state" },
    { name: "Delaware News Journal Politics", rssUrl: "https://rssfeeds.delawareonline.com/delawareonline/news", scope: "state" },
    { name: "Washington State Standard", rssUrl: "https://washingtonstatestandard.com/feed/", scope: "state" },
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/", scope: "state" },
    { name: "Hawaii Star-Advertiser Politics", rssUrl: "https://www.staradvertiser.com/category/breaking-news/feed/", scope: "state" },
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/", scope: "state" },
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/", scope: "state" },
    { name: "Indiana Capital Chronicle", rssUrl: "https://indianacapitalchronicle.com/feed/", scope: "state" },
    { name: "Daily Yonder (Rural)", rssUrl: "https://dailyyonder.com/feed/", scope: "state" },
    { name: "AZCentral Politics", rssUrl: "https://rssfeeds.azcentral.com/phoenix/politics", scope: "state" },
    { name: "Tampa Bay Times Florida Politics", rssUrl: "https://www.tampabay.com/feed/", scope: "state" },
    { name: "Florida Politics", rssUrl: "https://floridapolitics.com/feed/", scope: "state" },
    { name: "Texas Standard", rssUrl: "https://www.texasstandard.org/feed/", scope: "state" },
    { name: "WisPolitics", rssUrl: "https://www.wispolitics.com/feed", scope: "state" },
    { name: "MinnPost State", rssUrl: "https://www.minnpost.com/category/state-government/feed/", scope: "state" },
    { name: "City & State NY", rssUrl: "https://www.cityandstateny.com/feed", scope: "state" },
    { name: "Capitol Weekly (CA)", rssUrl: "https://capitolweekly.net/feed/", scope: "state" },
    { name: "Arkansas Advocate", rssUrl: "https://arkansasadvocate.com/feed/", scope: "state" },
    { name: "Utah News Dispatch", rssUrl: "https://utahnewsdispatch.com/feed/", scope: "state" },
    { name: "North Dakota Monitor", rssUrl: "https://northdakotamonitor.com/feed/", scope: "state" },
    { name: "Cardinal & Pine (NC)", rssUrl: "https://cardinalpine.com/feed/", scope: "state" },
    { name: "Dogwood (VA)", rssUrl: "https://dogwoodva.com/feed/", scope: "state" },
    { name: "Up North News (WI)", rssUrl: "https://upnorthnewswi.com/feed/", scope: "state" },
    { name: "The Keystone (PA)", rssUrl: "https://keystonenewsroom.com/feed/", scope: "state" },
    { name: "Courier Newsroom", rssUrl: "https://couriernewsroom.com/feed/", scope: "state" },
    { name: "Chalkbeat State Editions", rssUrl: "https://www.chalkbeat.org/arc/outboundfeeds/rss/category/state/", scope: "state" },
    // Expansion: more state-level capitol & policy newsrooms
    { name: "California Globe", rssUrl: "https://californiaglobe.com/feed/", scope: "state" },
    { name: "Texas Observer", rssUrl: "https://www.texasobserver.org/feed/", scope: "state" },
    { name: "Texas Monthly Politics", rssUrl: "https://www.texasmonthly.com/category/news-politics/feed/", scope: "state" },
    { name: "Florida Bulldog", rssUrl: "https://www.floridabulldog.org/feed/", scope: "state" },
    { name: "Florida Politics", rssUrl: "https://floridapolitics.com/feed/", scope: "state" },
    { name: "Florida Trident", rssUrl: "https://www.floridatrident.org/feed/", scope: "state" },
    { name: "Georgia Public Broadcasting", rssUrl: "https://www.gpb.org/news/feed", scope: "state" },
    { name: "AJC Politics", rssUrl: "https://www.ajc.com/arc/outboundfeeds/rss/category/politics/", scope: "state" },
    { name: "Tennessee Lookout", rssUrl: "https://tennesseelookout.com/feed/", scope: "state" },
    { name: "WPLN Nashville Politics", rssUrl: "https://wpln.org/feed/", scope: "state" },
    { name: "MLK50 (TN)", rssUrl: "https://mlk50.com/feed/", scope: "state" },
    { name: "Alabama Reflector", rssUrl: "https://alabamareflector.com/feed/", scope: "state" },
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/", scope: "state" },
    { name: "Arkansas Advocate", rssUrl: "https://arkansasadvocate.com/feed/", scope: "state" },
    { name: "South Carolina Daily Gazette", rssUrl: "https://scdailygazette.com/feed/", scope: "state" },
    { name: "Carolina Public Press", rssUrl: "https://carolinapublicpress.org/feed/", scope: "state" },
    { name: "EdNC (NC)", rssUrl: "https://www.ednc.org/feed/", scope: "state" },
    { name: "WHRO Politics (VA)", rssUrl: "https://www.whro.org/feed.rss", scope: "state" },
    { name: "VPM News (VA)", rssUrl: "https://www.vpm.org/news.rss", scope: "state" },
    { name: "Maryland Reporter", rssUrl: "https://marylandreporter.com/feed/", scope: "state" },
    { name: "DCist", rssUrl: "https://dcist.com/feed/", scope: "state" },
    { name: "Spotlight PA", rssUrl: "https://www.spotlightpa.org/feeds/news/", scope: "state" },
    { name: "PennLive Politics", rssUrl: "https://www.pennlive.com/arcio/rss/category/news/politics/", scope: "state" },
    { name: "City & State NY", rssUrl: "https://www.cityandstateny.com/feed/", scope: "state" },
    { name: "NY Focus", rssUrl: "https://nysfocus.com/feed", scope: "state" },
    { name: "Empire Report NY", rssUrl: "https://empirereportnewyork.com/feed/", scope: "state" },
    { name: "Gothamist Politics", rssUrl: "https://gothamist.com/feeds/tag/politics", scope: "state" },
    { name: "Insider NJ", rssUrl: "https://www.insidernj.com/feed/", scope: "state" },
    { name: "Mass Live Politics", rssUrl: "https://www.masslive.com/arcio/rss/category/news/politics/", scope: "state" },
    { name: "CommonWealth Beacon (MA)", rssUrl: "https://commonwealthbeacon.org/feed/", scope: "state" },
    { name: "Boston Globe Politics", rssUrl: "https://www.bostonglobe.com/rss/bdc/news/politics", scope: "state" },
    { name: "Maine Beacon", rssUrl: "https://mainebeacon.com/feed/", scope: "state" },
    { name: "VTDigger", rssUrl: "https://vtdigger.org/feed/", scope: "state" },
    { name: "Seven Days VT", rssUrl: "https://www.sevendaysvt.com/vermont/Rss.xml?section=2114676", scope: "state" },
    { name: "InDepthNH", rssUrl: "https://indepthnh.org/feed/", scope: "state" },
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/", scope: "state" },
    { name: "uPolitics CT (CT Mirror)", rssUrl: "https://ctmirror.org/category/politics/feed/", scope: "state" },
    { name: "Indianapolis Star Politics", rssUrl: "https://rssfeeds.indystar.com/indystar/news/politics", scope: "state" },
    { name: "Cleveland.com Politics", rssUrl: "https://www.cleveland.com/arc/outboundfeeds/rss/category/news/politics/", scope: "state" },
    { name: "MLive Politics", rssUrl: "https://www.mlive.com/arc/outboundfeeds/rss/category/news/politics/", scope: "state" },
    { name: "Crain's Detroit", rssUrl: "https://www.crainsdetroit.com/rss.xml", scope: "state" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://madison.com/news/local/govt-and-politics/?_type=rss", scope: "state" },
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "state" },
    { name: "Iowa Starting Line", rssUrl: "https://iowastartingline.com/feed/", scope: "state" },
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/", scope: "state" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://rssfeeds.jsonline.com/milwaukee/politics", scope: "state" },
    { name: "Daily Yonder (Rural)", rssUrl: "https://dailyyonder.com/feed/", scope: "state" },
    { name: "High Country News", rssUrl: "https://www.hcn.org/rss", scope: "state" },
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/", scope: "state" },
    { name: "AZ Central Politics", rssUrl: "https://rssfeeds.azcentral.com/phoenix/politics", scope: "state" },
    { name: "Las Vegas Review-Journal Politics", rssUrl: "https://www.reviewjournal.com/feed/", scope: "state" },
    { name: "Idaho Statesman Politics", rssUrl: "https://www.idahostatesman.com/news/politics-government/?widgetName=rssfeed&widgetContentId=4&getXmlFeed=true", scope: "state" },
    { name: "Salt Lake Tribune Politics", rssUrl: "https://www.sltrib.com/feeds/index.rss?path=/news/politics/", scope: "state" },
    { name: "Denver Post Politics", rssUrl: "https://www.denverpost.com/category/news/politics/feed/", scope: "state" },
    { name: "OPB Oregon", rssUrl: "https://www.opb.org/feed/news/rss/", scope: "state" },
    { name: "Crosscut (Cascade PBS)", rssUrl: "https://crosscut.com/feeds/rss.xml", scope: "state" },
    { name: "Seattle Times Politics", rssUrl: "https://www.seattletimes.com/seattle-news/politics/feed/", scope: "state" },
    { name: "Anchorage Daily News Politics", rssUrl: "https://www.adn.com/arc/outboundfeeds/rss/category/politics/", scope: "state" },
    { name: "Honolulu Civil Beat", rssUrl: "https://www.civilbeat.org/feed/", scope: "state" },
  ],
  local: [
    // ─── National / cross-cutting local-government coverage (no state) ───
    { name: "CityLab", rssUrl: "https://www.bloomberg.com/citylab/feed/", scope: "local" },
    { name: "Next City", rssUrl: "https://nextcity.org/feed", scope: "local" },
    { name: "Patch National", rssUrl: "https://patch.com/feeds/national", scope: "local" },
    { name: "Strong Towns", rssUrl: "https://www.strongtowns.org/journal?format=rss", scope: "local" },
    { name: "Smart Cities Dive", rssUrl: "https://www.smartcitiesdive.com/feeds/news/", scope: "local" },
    { name: "Governing Local", rssUrl: "https://www.governing.com/topic/politics/rss", scope: "local" },
    { name: "Route Fifty Local", rssUrl: "https://www.route-fifty.com/management/rss/", scope: "local" },
    { name: "Streetsblog USA", rssUrl: "https://usa.streetsblog.org/feed/", scope: "local" },
    { name: "County News (NACo)", rssUrl: "https://www.naco.org/feed", scope: "local" },
    { name: "National League of Cities", rssUrl: "https://www.nlc.org/feed/", scope: "local" },
    { name: "US Conference of Mayors", rssUrl: "https://www.usmayors.org/feed/", scope: "local" },
    { name: "Axios Local Hubs", rssUrl: "https://www.axios.com/local/feed", scope: "local" },

    // ─── Alabama (AL) ───
    { name: "AL.com Politics", rssUrl: "https://www.al.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "AL" },
    { name: "Alabama Reflector", rssUrl: "https://alabamareflector.com/feed/", scope: "local", state: "AL" },
    { name: "Birmingham Watch", rssUrl: "https://birminghamwatch.org/feed/", scope: "local", state: "AL" },
    { name: "Alabama Daily News", rssUrl: "https://www.aldailynews.com/feed/", scope: "local", state: "AL" },

    // ─── Alaska (AK) ───
    { name: "Alaska Beacon", rssUrl: "https://alaskabeacon.com/feed/", scope: "local", state: "AK" },
    { name: "Anchorage Daily News", rssUrl: "https://www.adn.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "AK" },
    { name: "Alaska Public Media", rssUrl: "https://alaskapublic.org/feed/", scope: "local", state: "AK" },

    // ─── Arizona (AZ) ───
    { name: "Arizona Mirror", rssUrl: "https://azmirror.com/feed/", scope: "local", state: "AZ" },
    { name: "AZ Central Politics", rssUrl: "https://rssfeeds.azcentral.com/phoenix/politics", scope: "local", state: "AZ" },
    { name: "Phoenix New Times", rssUrl: "https://www.phoenixnewtimes.com/feed", scope: "local", state: "AZ" },
    { name: "Tucson Sentinel", rssUrl: "https://www.tucsonsentinel.com/site/feed.xml", scope: "local", state: "AZ" },

    // ─── Arkansas (AR) ───
    { name: "Arkansas Advocate", rssUrl: "https://arkansasadvocate.com/feed/", scope: "local", state: "AR" },
    { name: "Arkansas Times", rssUrl: "https://arktimes.com/feed", scope: "local", state: "AR" },
    { name: "Arkansas Democrat-Gazette", rssUrl: "https://www.arkansasonline.com/rss/headlines/news/", scope: "local", state: "AR" },

    // ─── California (CA) ───
    { name: "CalMatters", rssUrl: "https://calmatters.org/feed/", scope: "local", state: "CA" },
    { name: "LAist", rssUrl: "https://laist.com/feed", scope: "local", state: "CA" },
    { name: "KQED News", rssUrl: "https://www.kqed.org/news/feed", scope: "local", state: "CA" },
    { name: "Mission Local (SF)", rssUrl: "https://missionlocal.org/feed/", scope: "local", state: "CA" },
    { name: "Voice of San Diego", rssUrl: "https://voiceofsandiego.org/feed/", scope: "local", state: "CA" },
    { name: "The Oaklandside", rssUrl: "https://oaklandside.org/feed/", scope: "local", state: "CA" },
    { name: "Berkeleyside", rssUrl: "https://www.berkeleyside.org/feed", scope: "local", state: "CA" },

    // ─── Colorado (CO) ───
    { name: "Colorado Sun", rssUrl: "https://coloradosun.com/feed/", scope: "local", state: "CO" },
    { name: "Colorado Newsline", rssUrl: "https://coloradonewsline.com/feed/", scope: "local", state: "CO" },
    { name: "Denverite", rssUrl: "https://denverite.com/feed/", scope: "local", state: "CO" },
    { name: "Denver Post Politics", rssUrl: "https://www.denverpost.com/politics/feed/", scope: "local", state: "CO" },

    // ─── Connecticut (CT) ───
    { name: "CT Mirror", rssUrl: "https://ctmirror.org/feed/", scope: "local", state: "CT" },
    { name: "CT Insider Politics", rssUrl: "https://www.ctinsider.com/news/politics/feed/", scope: "local", state: "CT" },
    { name: "Hartford Courant Politics", rssUrl: "https://www.courant.com/politics/feed/", scope: "local", state: "CT" },

    // ─── Delaware (DE) ───
    { name: "Delaware Public Media", rssUrl: "https://www.delawarepublic.org/feed", scope: "local", state: "DE" },
    { name: "Delaware Online Politics", rssUrl: "https://rssfeeds.delawareonline.com/delawareonline/politics", scope: "local", state: "DE" },
    { name: "Spotlight Delaware", rssUrl: "https://spotlightdelaware.org/feed/", scope: "local", state: "DE" },

    // ─── Florida (FL) ───
    { name: "Florida Phoenix", rssUrl: "https://floridaphoenix.com/feed/", scope: "local", state: "FL" },
    { name: "Tampa Bay Times Politics", rssUrl: "https://www.tampabay.com/arc/outboundfeeds/rss/category/news/florida-politics/", scope: "local", state: "FL" },
    { name: "Miami Herald Politics", rssUrl: "https://www.miamiherald.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "FL" },
    { name: "Orlando Sentinel Politics", rssUrl: "https://www.orlandosentinel.com/news/politics/feed/", scope: "local", state: "FL" },
    { name: "WLRN Miami", rssUrl: "https://www.wlrn.org/feed", scope: "local", state: "FL" },

    // ─── Georgia (GA) ───
    { name: "Georgia Recorder", rssUrl: "https://georgiarecorder.com/feed/", scope: "local", state: "GA" },
    { name: "Atlanta Civic Circle", rssUrl: "https://atlantaciviccircle.org/feed/", scope: "local", state: "GA" },
    { name: "Atlanta Journal-Constitution Politics", rssUrl: "https://www.ajc.com/news/state-regional-govt-politics/feed/", scope: "local", state: "GA" },
    { name: "Capital B Atlanta", rssUrl: "https://atlanta.capitalbnews.org/feed/", scope: "local", state: "GA" },
    { name: "Saporta Report (ATL)", rssUrl: "https://saportareport.com/feed/", scope: "local", state: "GA" },

    // ─── Hawaii (HI) ───
    { name: "Honolulu Civil Beat", rssUrl: "https://www.civilbeat.org/feed/", scope: "local", state: "HI" },
    { name: "Honolulu Star-Advertiser", rssUrl: "https://www.staradvertiser.com/feed/", scope: "local", state: "HI" },
    { name: "Hawaii Public Radio", rssUrl: "https://www.hawaiipublicradio.org/feed", scope: "local", state: "HI" },

    // ─── Idaho (ID) ───
    { name: "Idaho Capital Sun", rssUrl: "https://idahocapitalsun.com/feed/", scope: "local", state: "ID" },
    { name: "Idaho Statesman Politics", rssUrl: "https://www.idahostatesman.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "ID" },
    { name: "Boise State Public Radio", rssUrl: "https://www.boisestatepublicradio.org/feed", scope: "local", state: "ID" },

    // ─── Illinois (IL) ───
    { name: "Block Club Chicago", rssUrl: "https://blockclubchicago.org/feed/", scope: "local", state: "IL" },
    { name: "WBEZ Chicago", rssUrl: "https://www.wbez.org/feed/", scope: "local", state: "IL" },
    { name: "Crain's Chicago Business", rssUrl: "https://www.chicagobusiness.com/rss.xml", scope: "local", state: "IL" },
    { name: "Capitol News Illinois", rssUrl: "https://capitolnewsillinois.com/feed", scope: "local", state: "IL" },
    { name: "Cicero Independiente", rssUrl: "https://www.ciceroindependiente.com/feed", scope: "local", state: "IL" },

    // ─── Indiana (IN) ───
    { name: "Indiana Capital Chronicle", rssUrl: "https://indianacapitalchronicle.com/feed/", scope: "local", state: "IN" },
    { name: "Indianapolis Recorder", rssUrl: "https://www.indianapolisrecorder.com/feed/", scope: "local", state: "IN" },
    { name: "IndyStar Politics", rssUrl: "https://rssfeeds.indystar.com/indianapolis/politics", scope: "local", state: "IN" },

    // ─── Iowa (IA) ───
    { name: "Iowa Capital Dispatch", rssUrl: "https://iowacapitaldispatch.com/feed/", scope: "local", state: "IA" },
    { name: "Des Moines Register Politics", rssUrl: "https://rssfeeds.desmoinesregister.com/desmoines/politics", scope: "local", state: "IA" },
    { name: "Iowa Public Radio", rssUrl: "https://www.iowapublicradio.org/feed", scope: "local", state: "IA" },

    // ─── Kansas (KS) ───
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/", scope: "local", state: "KS" },
    { name: "Kansas City Star Politics", rssUrl: "https://www.kansascity.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "KS" },
    { name: "KCUR (Kansas City)", rssUrl: "https://www.kcur.org/feed", scope: "local", state: "KS" },

    // ─── Kentucky (KY) ───
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/", scope: "local", state: "KY" },
    { name: "Louisville Public Media (WFPL)", rssUrl: "https://wfpl.org/feed/", scope: "local", state: "KY" },
    { name: "Lexington Herald-Leader Politics", rssUrl: "https://www.kentucky.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "KY" },

    // ─── Louisiana (LA) ───
    { name: "Louisiana Illuminator", rssUrl: "https://lailluminator.com/feed/", scope: "local", state: "LA" },
    { name: "WWNO (New Orleans NPR)", rssUrl: "https://www.wwno.org/feed", scope: "local", state: "LA" },
    { name: "The Advocate (LA) Politics", rssUrl: "https://www.theadvocate.com/search/?f=rss&t=article&c=news/politics&l=50&s=start_time&sd=desc", scope: "local", state: "LA" },

    // ─── Maine (ME) ───
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/", scope: "local", state: "ME" },
    { name: "Bangor Daily News Politics", rssUrl: "https://www.bangordailynews.com/politics/feed/", scope: "local", state: "ME" },
    { name: "Maine Public", rssUrl: "https://www.mainepublic.org/feed", scope: "local", state: "ME" },

    // ─── Maryland (MD) ───
    { name: "Maryland Matters", rssUrl: "https://marylandmatters.org/feed/", scope: "local", state: "MD" },
    { name: "Baltimore Banner", rssUrl: "https://www.thebaltimorebanner.com/arc/outboundfeeds/rss/", scope: "local", state: "MD" },
    { name: "Baltimore Brew", rssUrl: "https://baltimorebrew.com/feed/", scope: "local", state: "MD" },
    { name: "Baltimore Sun Politics", rssUrl: "https://www.baltimoresun.com/politics/feed/", scope: "local", state: "MD" },

    // ─── Massachusetts (MA) ───
    { name: "WBUR (Boston)", rssUrl: "https://www.wbur.org/feed", scope: "local", state: "MA" },
    { name: "CommonWealth Beacon (MA)", rssUrl: "https://commonwealthbeacon.org/feed/", scope: "local", state: "MA" },
    { name: "Boston Globe Politics", rssUrl: "https://www.bostonglobe.com/rss/news/politics", scope: "local", state: "MA" },
    { name: "MassLive Politics", rssUrl: "https://www.masslive.com/politics/feed/", scope: "local", state: "MA" },

    // ─── Michigan (MI) ───
    { name: "Michigan Advance", rssUrl: "https://michiganadvance.com/feed/", scope: "local", state: "MI" },
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/rss.xml", scope: "local", state: "MI" },
    { name: "Detroit Free Press", rssUrl: "https://rssfeeds.freep.com/freep/home", scope: "local", state: "MI" },
    { name: "Michigan Radio (NPR)", rssUrl: "https://www.michiganradio.org/feed", scope: "local", state: "MI" },

    // ─── Minnesota (MN) ───
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "local", state: "MN" },
    { name: "MPR News", rssUrl: "https://www.mprnews.org/feed", scope: "local", state: "MN" },
    { name: "Minnesota Reformer", rssUrl: "https://minnesotareformer.com/feed/", scope: "local", state: "MN" },
    { name: "Star Tribune Politics", rssUrl: "https://www.startribune.com/politics/index.rss2", scope: "local", state: "MN" },

    // ─── Mississippi (MS) ───
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/", scope: "local", state: "MS" },
    { name: "Mississippi Free Press", rssUrl: "https://www.mississippifreepress.org/feed/", scope: "local", state: "MS" },
    { name: "Clarion Ledger Politics", rssUrl: "https://rssfeeds.clarionledger.com/clarionledger/news/politics", scope: "local", state: "MS" },

    // ─── Missouri (MO) ───
    { name: "Missouri Independent", rssUrl: "https://missouriindependent.com/feed/", scope: "local", state: "MO" },
    { name: "St. Louis Public Radio", rssUrl: "https://news.stlpublicradio.org/feed", scope: "local", state: "MO" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://www.stltoday.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "MO" },

    // ─── Montana (MT) ───
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/", scope: "local", state: "MT" },
    { name: "Daily Montanan", rssUrl: "https://dailymontanan.com/feed/", scope: "local", state: "MT" },
    { name: "Montana Public Radio", rssUrl: "https://www.mtpr.org/feed", scope: "local", state: "MT" },

    // ─── Nebraska (NE) ───
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/", scope: "local", state: "NE" },
    { name: "Omaha World-Herald Politics", rssUrl: "https://omaha.com/search/?f=rss&t=article&c=news/state-and-regional/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "NE" },
    { name: "Nebraska Public Media", rssUrl: "https://nebraskapublicmedia.org/feed", scope: "local", state: "NE" },

    // ─── Nevada (NV) ───
    { name: "Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed", scope: "local", state: "NV" },
    { name: "Nevada Current", rssUrl: "https://nevadacurrent.com/feed/", scope: "local", state: "NV" },
    { name: "Las Vegas Review-Journal Politics", rssUrl: "https://www.reviewjournal.com/feed/?post_type=post&category_name=politics-and-government", scope: "local", state: "NV" },
    { name: "Reno Gazette Journal", rssUrl: "https://rssfeeds.rgj.com/RGJ/News", scope: "local", state: "NV" },

    // ─── New Hampshire (NH) ───
    { name: "NH Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/", scope: "local", state: "NH" },
    { name: "NH Public Radio", rssUrl: "https://www.nhpr.org/feed", scope: "local", state: "NH" },
    { name: "Concord Monitor", rssUrl: "https://www.concordmonitor.com/section/rss?profile=1004", scope: "local", state: "NH" },

    // ─── New Jersey (NJ) ───
    { name: "New Jersey Monitor", rssUrl: "https://newjerseymonitor.com/feed/", scope: "local", state: "NJ" },
    { name: "NJ Spotlight News", rssUrl: "https://www.njspotlightnews.org/feed/", scope: "local", state: "NJ" },
    { name: "NJ.com Politics", rssUrl: "https://www.nj.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "NJ" },

    // ─── New Mexico (NM) ───
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/", scope: "local", state: "NM" },
    { name: "Santa Fe New Mexican", rssUrl: "https://www.santafenewmexican.com/search/?f=rss&t=article&c=news/local_news&l=50&s=start_time&sd=desc", scope: "local", state: "NM" },
    { name: "Albuquerque Journal", rssUrl: "https://www.abqjournal.com/feed", scope: "local", state: "NM" },

    // ─── New York (NY) ───
    { name: "THE CITY NYC", rssUrl: "https://www.thecity.nyc/feed/", scope: "local", state: "NY" },
    { name: "Gothamist", rssUrl: "https://gothamist.com/feed", scope: "local", state: "NY" },
    { name: "City & State NY", rssUrl: "https://www.cityandstateny.com/arc/outboundfeeds/rss/", scope: "local", state: "NY" },
    { name: "New York Focus", rssUrl: "https://nysfocus.com/feed", scope: "local", state: "NY" },
    { name: "Spectrum News NY1", rssUrl: "https://www.ny1.com/nyc/all-boroughs/news.rss", scope: "local", state: "NY" },
    // North Carolina
    { name: "News & Observer", rssUrl: "https://www.newsobserver.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true", scope: "local", state: "NC" },
    { name: "NC Newsline", rssUrl: "https://ncnewsline.com/feed/", scope: "local", state: "NC" },
    { name: "Charlotte Observer", rssUrl: "https://www.charlotteobserver.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true", scope: "local", state: "NC" },
    { name: "WUNC", rssUrl: "https://www.wunc.org/feed", scope: "local", state: "NC" },
  ],
};

// ─── Get available target states for a given feed URL ────────────────────────
    // Returns all states except the feed's current state, with conflict flags.
    if (body.action === "get_available_target_states") {
      const rssUrl: string = typeof body.rssUrl === "string" ? body.rssUrl.trim() : "";
      if (!rssUrl) {
        return new Response(JSON.stringify({ error: "rssUrl is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const allLocalSources = (SOURCES.local || []) as Array<{ name: string; rssUrl: string; state?: string }>;
      const currentState = getSourceState(rssUrl);
      const available = JURISDICTIONS
        .filter((abbr) => abbr !== currentState)
        .map((abbr) => {
          const conflict = isConflict(rssUrl, abbr, allLocalSources);
          return {
            abbr,
            name: STATE_ABBR_TO_NAME[abbr] ?? abbr,
            disabled: conflict,
            reason: conflict ? `Another feed with URL ${rssUrl} is already assigned to ${abbr}` : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return new Response(
        JSON.stringify({ rssUrl, currentState, available }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── Move a feed to a different state ────────────────────────────────────────
    // Reassigns a feed's rssUrl to a new state if no conflict exists in the target.
    if (body.action === "move_feed_state") {
      const rssUrl: string = typeof body.rssUrl === "string" ? body.rssUrl.trim() : "";
      const newState: string = typeof body.newState === "string" ? body.newState.trim().toUpperCase() : "";
      if (!rssUrl || !newState) {
        return new Response(JSON.stringify({ error: "rssUrl and newState are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!JURISDICTIONS.includes(newState)) {
        return new Response(JSON.stringify({ error: `Invalid state: ${newState}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const allLocalSources = (SOURCES.local || []) as Array<{ name: string; rssUrl: string; state?: string }>;
      if (isConflict(rssUrl, newState, allLocalSources)) {
        return new Response(
          JSON.stringify({
            error: "Conflict: another feed with the same URL is already assigned to the target state",
            rssUrl,
            targetState: newState,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const previousState = getSourceState(rssUrl);
      setSourceState(rssUrl, newState);
      return new Response(
        JSON.stringify({
          success: true,
          rssUrl,
          previousState,
          newState,
          message: `Feed moved from ${previousState ?? "unassigned"} to ${newState}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Top-up: for each low-coverage state, probe vetted reserve feeds and return
    // Build candidate list: reserve feeds not already configured (per state OR globally in any other scope/state)
      const candidates: Array<{ state: string; name: string; rssUrl: string }> = [];
      const dedupSeenInRun = new Set<string>(); // prevents the same URL being proposed for multiple states this run
      const duplicatesSkipped: Array<{ state: string; name: string; rssUrl: string; reason: string }> = [];
      for (const st of targetStates) {
        const reserve = LOCAL_RESERVE[st] ?? [];
        const haveSet = configuredByState.get(st) ?? new Set<string>();
        for (const c of reserve) {
          const norm = normalizeUrl(c.rssUrl);
          if (haveSet.has(norm)) {
            duplicatesSkipped.push({ state: st, name: c.name, rssUrl: c.rssUrl, reason: "already_configured_for_state" });
            continue;
          }
          if (globallyConfiguredUrls.has(norm)) {
            duplicatesSkipped.push({ state: st, name: c.name, rssUrl: c.rssUrl, reason: "already_configured_for_other_scope_or_state" });
            continue;
          }
          if (dedupSeenInRun.has(norm)) {
            duplicatesSkipped.push({ state: st, name: c.name, rssUrl: c.rssUrl, reason: "duplicate_within_reserve_pool" });
            continue;
          }
          dedupSeenInRun.add(norm);
          candidates.push({ state: st, ...c });
        }
      }

      // Probe in batches
      const probed: Array<{
        state: string; name: string; rssUrl: string;
        ok: boolean; status: number; ms: number; items: number; error: string | null;
      }> = [];
      const BATCH = 10;
      for (let i = 0; i < candidates.length; i += BATCH) {
        const slice = candidates.slice(i, i + BATCH);
        const out = await Promise.all(slice.map(async (c) => {
          const r = await probe(c);
          return { state: c.state, name: c.name, rssUrl: c.rssUrl, ...r };
        }));
        probed.push(...out);
      }

      // Group healthy results by state, capped
      const additions: Record<string, Array<{ name: string; rssUrl: string; items: number; status: number; ms: number }>> = {};
      const skipped: Record<string, Array<{ name: string; rssUrl: string; error: string | null; status: number }>> = {};
      const summaryByState: Array<{
        state: string; previousConfigured: number; healthyAdded: number; newTotal: number; meetsThreshold: boolean;
      }> = [];

      for (const st of targetStates) {
        const okOnes = probed.filter((p) => p.state === st && p.ok).slice(0, perStateCap);
        const failed = probed.filter((p) => p.state === st && !p.ok);
        if (okOnes.length > 0) {
          additions[st] = okOnes.map((p) => ({
            name: p.name, rssUrl: p.rssUrl, items: p.items, status: p.status, ms: p.ms,
          }));
        }
        if (failed.length > 0) {
          skipped[st] = failed.map((p) => ({
            name: p.name, rssUrl: p.rssUrl, error: p.error, status: p.status,
          }));
        }
        const previous = configuredByState.get(st)?.size ?? 0;
        const newTotal = previous + okOnes.length;
        summaryByState.push({
          state: st,
          previousConfigured: previous,
          healthyAdded: okOnes.length,
          newTotal,
          meetsThreshold: newTotal >= minPerState,
        });
      }

      const totalAdded = Object.values(additions).reduce((sum, arr) => sum + arr.length, 0);
      const statesImproved = summaryByState.filter((s) => s.healthyAdded > 0).length;
      const statesNowMeeting = summaryByState.filter((s) => s.meetsThreshold).length;
      const statesStillBelow = summaryByState.filter((s) => !s.meetsThreshold).length;

      return new Response(
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          minPerState,
          perStateCap,
          targetStates,
          summary: {
            statesEvaluated: targetStates.length,
            statesImproved,
            statesNowMeeting,
            statesStillBelow,
            candidatesProbed: probed.length,
            totalHealthyAdded: totalAdded,
            duplicatesSkipped: duplicatesSkipped.length,
          },
          perState: summaryByState,
          additions,
          skipped,
          duplicates: duplicatesSkipped,
          note: "Healthy candidates were probed live from a vetted reserve pool. Reserve URLs already configured for any state/scope are skipped (see `duplicates`). To persist additions, add the entries under additions to SOURCES.local in supabase/functions/intel-briefing/index.ts.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Accept either `scopes` (array) or `scope` (single string) from callers.
    let requestedScopes: string[];
    if (Array.isArray(body.scopes) && body.scopes.length > 0) {
      requestedScopes = body.scopes;
    } else if (typeof body.scope === "string" && body.scope.trim()) {
      requestedScopes = [body.scope.trim()];
    } else {
      requestedScopes = ["national", "international", "state", "local"];
    }
    const requestedState: string | null = typeof body.state === "string" && body.state.trim()
      ? body.state.trim().toUpperCase()
      : null;
    // If a state is provided without explicit scopes, narrow to local only to avoid
    // fetching every national/international feed when the caller only wants one state.
    if (requestedState && !Array.isArray(body.scopes) && typeof body.scope !== "string") {
      requestedScopes = ["local"];
    }

    console.log("Intel briefing sync starting for scopes:", requestedScopes, requestedState ? `(state=${requestedState})` : "");

    const allItems: any[] = [];
    const sourcesByScope: Record<string, number> = {};
    const stateTaggedSources = new Set<string>();

    // Fetch from all requested scopes in parallel (batch 10 at a time to avoid overwhelming)
    for (const scope of requestedScopes) {
      let sources = SOURCES[scope] || [];
      // When a specific state is requested for local scope, only fetch sources tagged for it
      if (scope === "local" && requestedState) {
        sources = sources.filter((s) => {
          const st = (s as { state?: string }).state;
          return st && st.toUpperCase() === requestedState;
        });
      }
      sourcesByScope[scope] = sources.length;
      if (scope === "local") {
        for (const s of sources) {
          const st = (s as { state?: string }).state;
          if (st) stateTaggedSources.add(`${st}|${s.name}`);
        }
      }
      const batchSize = 10;
      for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(s => parseRSS(s.rssUrl, s.name, s.scope, (s as { state?: string }).state))
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value);
          }
        }
      }
    }

    console.log(`Fetched ${allItems.length} total items from ${requestedScopes.length} scopes`);

    let inserted = 0;
    let insertedLocal = 0;
    let dedupedCount = 0;

    let skippedDbDuplicate = 0;
    if (allItems.length > 0) {
      // Normalize a URL for comparison (strip query params + trailing slash + lowercase host).
      const normalizeUrl = (raw: string): string => {
        if (!raw) return "";
        try {
          const u = new URL(raw);
          return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/$/, "").toLowerCase()}`;
        } catch {
          return raw.trim().toLowerCase();
        }
      };
      const normalizeTitle = (t: string) => (t || "").trim().toLowerCase().replace(/\s+/g, " ");
      const normalizeName = (n: string) => (n || "").trim().toLowerCase();
      const normalizeRegion = (r: string | null | undefined) => (r || "").trim().toUpperCase();

      // In-memory dedup within this batch:
      //   - same normalized RSS URL within a region (state) → one only
      //   - same outlet name + normalized title within a region → one only
      const seenUrl = new Set<string>();
      const seenNameTitle = new Set<string>();
      const deduped = allItems.filter((it) => {
        const region = normalizeRegion(it.region);
        const urlKey = `${normalizeUrl(it.source_url)}|${region}`;
        const nameTitleKey = `${normalizeName(it.source_name)}|${normalizeTitle(it.title)}|${region}`;
        if (urlKey && seenUrl.has(urlKey)) return false;
        if (seenNameTitle.has(nameTitleKey)) return false;
        if (urlKey) seenUrl.add(urlKey);
        seenNameTitle.add(nameTitleKey);
        return true;
      });
      dedupedCount = deduped.length;

      // Pre-check the DB for existing (source_url, region) and (source_name, title, region)
      // matches so we never reinsert the same article a second time.
      // Group lookups by region to keep queries small.
      const byRegion = new Map<string, typeof deduped>();
      for (const it of deduped) {
        const region = normalizeRegion(it.region);
        if (!byRegion.has(region)) byRegion.set(region, []);
        byRegion.get(region)!.push(it);
      }

      const existingUrlSet = new Set<string>();      // normalized url|region
      const existingNameTitleSet = new Set<string>(); // name|title|region

      for (const [region, items] of byRegion.entries()) {
        const urls = Array.from(new Set(items.map((i) => i.source_url).filter(Boolean)));
        const names = Array.from(new Set(items.map((i) => i.source_name).filter(Boolean)));

        if (urls.length > 0) {
          // Chunk in 200s to stay under URL-length limits
          for (let i = 0; i < urls.length; i += 200) {
            const slice = urls.slice(i, i + 200);
            const { data: existing } = await supabase
              .from("intel_briefings")
              .select("source_url")
              .eq("region", region)
              .in("source_url", slice);
            for (const r of existing || []) {
              existingUrlSet.add(`${normalizeUrl(r.source_url)}|${region}`);
            }
          }
        }

        if (names.length > 0) {
          for (let i = 0; i < names.length; i += 100) {
            const slice = names.slice(i, i + 100);
            const { data: existing } = await supabase
              .from("intel_briefings")
              .select("source_name,title")
              .eq("region", region)
              .in("source_name", slice);
            for (const r of existing || []) {
              existingNameTitleSet.add(
                `${normalizeName(r.source_name)}|${normalizeTitle(r.title)}|${region}`,
              );
            }
          }
        }
      }

      const filtered = deduped.filter((it) => {
        const region = normalizeRegion(it.region);
        const urlKey = `${normalizeUrl(it.source_url)}|${region}`;
        const nameTitleKey = `${normalizeName(it.source_name)}|${normalizeTitle(it.title)}|${region}`;
        if (urlKey && existingUrlSet.has(urlKey)) {
          skippedDbDuplicate += 1;
          return false;
        }
        if (existingNameTitleSet.has(nameTitleKey)) {
          skippedDbDuplicate += 1;
          return false;
        }
        return true;
      });

      console.log(
        `Dedup: ${allItems.length} fetched → ${dedupedCount} unique in-batch → ${filtered.length} new (skipped ${skippedDbDuplicate} already in DB)`,
      );

      const batchSize = 50;
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        const { data, error } = await supabase.from("intel_briefings").upsert(
          batch.map((item) => ({
            title: item.title,
            summary: item.summary,
            content: item.content,
            source_name: item.source_name,
            source_url: item.source_url,
            published_at: item.published_at,
            scope: item.scope,
            category: item.category,
            region: item.region ?? "",
          })),
          { onConflict: "title,source_name,region,published_at", ignoreDuplicates: true }
        ).select("id,scope");
        if (error) {
          console.error("Upsert error:", error.message);
        } else if (data) {
          inserted += data.length;
          insertedLocal += data.filter((r: any) => r.scope === "local").length;
        }
      }
      console.log(`Inserted ${inserted} new briefings (${insertedLocal} local)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: allItems.length,
        fetched: allItems.length,
        deduped: dedupedCount,
        skipped_db_duplicate: skippedDbDuplicate,
        inserted,
        inserted_local: insertedLocal,
        sources_by_scope: sourcesByScope,
        state_tagged_sources: stateTaggedSources.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("intel-briefing error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
