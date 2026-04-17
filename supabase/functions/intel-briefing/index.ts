import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    { name: "New Jersey Monitor", rssUrl: "https://newjerseymonitor.com/feed/", scope: "state" },
    { name: "Connecticut Mirror", rssUrl: "https://ctmirror.org/feed/", scope: "state" },
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/", scope: "state" },
    { name: "Indiana Capital Chronicle", rssUrl: "https://indianacapitalchronicle.com/feed/", scope: "state" },
    { name: "Maryland Matters", rssUrl: "https://www.marylandmatters.org/feed/", scope: "state" },
    { name: "Louisiana Illuminator", rssUrl: "https://lailluminator.com/feed/", scope: "state" },
    { name: "Alaska Beacon", rssUrl: "https://alaskabeacon.com/feed/", scope: "state" },
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/", scope: "state" },
    { name: "South Dakota Searchlight", rssUrl: "https://southdakotasearchlight.com/feed/", scope: "state" },
    { name: "Idaho Capital Sun", rssUrl: "https://idahocapitalsun.com/feed/", scope: "state" },
    { name: "Wyoming News Exchange", rssUrl: "https://wyomingnewsexchange.com/feed/", scope: "state" },
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/", scope: "state" },
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/", scope: "state" },
  ],
  local: [
    { name: "CityLab", rssUrl: "https://www.bloomberg.com/citylab/feed/", scope: "local" },
    { name: "Next City", rssUrl: "https://nextcity.org/feed", scope: "local" },
    { name: "Patch National", rssUrl: "https://patch.com/feeds/national", scope: "local" },
    { name: "Local Government Review", rssUrl: "https://icma.org/rss.xml", scope: "local" },
    { name: "Strong Towns", rssUrl: "https://www.strongtowns.org/journal?format=rss", scope: "local" },
    { name: "National League of Cities", rssUrl: "https://www.nlc.org/feed/", scope: "local" },
    { name: "US Conference of Mayors", rssUrl: "https://www.usmayors.org/feed/", scope: "local" },
    { name: "Smart Cities Dive", rssUrl: "https://www.smartcitiesdive.com/feeds/news/", scope: "local" },
    { name: "Governing Local", rssUrl: "https://www.governing.com/topic/politics/rss", scope: "local" },
    { name: "Shelterforce", rssUrl: "https://shelterforce.org/feed/", scope: "local" },
    { name: "Route Fifty Local", rssUrl: "https://www.route-fifty.com/management/rss/", scope: "local" },
    { name: "Community Builders", rssUrl: "https://www.tcbinc.org/feed/", scope: "local" },
    { name: "CityMetric", rssUrl: "https://www.citymetric.com/feed", scope: "local" },
    { name: "Local News Initiative", rssUrl: "https://localnewsinitiative.northwestern.edu/feed/", scope: "local" },
    { name: "NLIHC Housing", rssUrl: "https://nlihc.org/feed", scope: "local" },
    { name: "County News (NACo)", rssUrl: "https://www.naco.org/feed", scope: "local" },
    { name: "Education Dive", rssUrl: "https://www.educationdive.com/feeds/news/", scope: "local" },
    { name: "Smart Growth America", rssUrl: "https://smartgrowthamerica.org/feed/", scope: "local" },
    { name: "Transportation Riders United", rssUrl: "https://www.transitcenter.org/feed/", scope: "local" },
    { name: "Streetsblog USA", rssUrl: "https://usa.streetsblog.org/feed/", scope: "local" },
    { name: "PublicSource", rssUrl: "https://www.publicsource.org/feed/", scope: "local" },
    { name: "Documented", rssUrl: "https://documentedny.com/feed/", scope: "local" },
    { name: "City Bureau", rssUrl: "https://www.citybureau.org/feed", scope: "local" },
    { name: "The Oaklandside", rssUrl: "https://oaklandside.org/feed/", scope: "local" },
    { name: "Block Club Chicago", rssUrl: "https://blockclubchicago.org/feed/", scope: "local" },
    { name: "THE CITY NYC", rssUrl: "https://www.thecity.nyc/feed/", scope: "local" },
    // Additional local sources
    { name: "Gothamist", rssUrl: "https://gothamist.com/feed", scope: "local" },
    { name: "LAist", rssUrl: "https://laist.com/feed", scope: "local" },
    { name: "WNYC News", rssUrl: "https://www.wnyc.org/feeds/articles", scope: "local" },
    { name: "Berkeleyside", rssUrl: "https://www.berkeleyside.org/feed", scope: "local" },
    { name: "Billy Penn", rssUrl: "https://billypenn.com/feed/", scope: "local" },
    { name: "Denverite", rssUrl: "https://denverite.com/feed/", scope: "local" },
    { name: "VTDigger", rssUrl: "https://vtdigger.org/feed/", scope: "local" },
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "local" },
    { name: "Voice of San Diego", rssUrl: "https://voiceofsandiego.org/feed/", scope: "local" },
    { name: "Texas Observer", rssUrl: "https://www.texasobserver.org/feed/", scope: "local" },
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/", scope: "local" },
    { name: "NC Health News", rssUrl: "https://www.northcarolinahealthnews.org/feed/", scope: "local" },
    { name: "Detroit Free Press", rssUrl: "https://rssfeeds.freep.com/freep/home", scope: "local" },
    { name: "Honolulu Civil Beat", rssUrl: "https://www.civilbeat.org/feed/", scope: "local" },
  ],
};

async function parseRSS(url: string, sourceName: string, scope: string): Promise<Array<{
  title: string; summary: string; content: string; source_name: string;
  source_url: string; published_at: string; scope: string; category: string;
}>> {
  const items: Array<any> = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IntelBot/1.0)" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`RSS fetch failed for ${sourceName}: ${res.status}`);
      return [];
    }

    const xml = await res.text();

    // Detect category from content
    function detectCategory(title: string, desc: string): string {
      const text = (title + " " + desc).toLowerCase();
      if (text.match(/economy|gdp|inflation|market|trade|tariff|jobs|unemployment|recession|interest rate/)) return "economy";
      if (text.match(/election|ballot|vote|campaign|primary|caucus|gerrymandering|redistrict/)) return "elections";
      if (text.match(/court|judicial|scotus|legal|law|ruling|justice|indictment|lawsuit/)) return "legal";
      if (text.match(/military|defense|nato|pentagon|war|security|weapon|drone/)) return "defense";
      if (text.match(/health|covid|pandemic|hospital|medicare|medicaid|opioid|fentanyl/)) return "health";
      if (text.match(/climate|environment|energy|epa|emission|renewable|solar|wind|fossil/)) return "environment";
      if (text.match(/immigration|border|asylum|migrant|refugee|deportation|ice/)) return "immigration";
      if (text.match(/education|school|student|university|college|teacher|tuition/)) return "education";
      if (text.match(/housing|rent|mortgage|homelessness|eviction|affordable housing/)) return "housing";
      if (text.match(/crime|police|prison|gun|shooting|fbi|doj|carjack/)) return "public-safety";
      if (text.match(/tech|ai|artificial intelligence|cyber|data privacy|social media|tiktok/)) return "technology";
      if (text.match(/tax|budget|deficit|debt ceiling|appropriation|spending bill/)) return "fiscal";
      if (text.match(/labor|union|strike|minimum wage|worker|overtime/)) return "labor";
      if (text.match(/infrastructure|bridge|highway|broadband|rail|transit/)) return "infrastructure";
      if (text.match(/veteran|va |military family|service member/)) return "veterans";
      if (text.match(/abortion|reproductive|roe|dobbs|ivf|contraception/)) return "reproductive-rights";
      if (text.match(/social security|retirement|pension|401k/)) return "social-security";
      if (text.match(/agriculture|farm|crop|usda|rural/)) return "agriculture";
      return "general";
    }

    // Parse RSS items
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    let count = 0;
    while ((match = itemRegex.exec(xml)) !== null && count < 10) {
      const block = match[1];
      const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const descMatch = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const contentMatch = block.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
      const pubDateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const link = linkMatch ? linkMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : "";
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, "").trim() : desc;
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      let parsedDate: string;
      try {
        parsedDate = new Date(pubDate).toISOString();
      } catch {
        parsedDate = new Date().toISOString();
      }

      items.push({
        title,
        summary: desc.substring(0, 500),
        content: content.substring(0, 3000),
        source_name: sourceName,
        source_url: link,
        published_at: parsedDate,
        scope,
        category: detectCategory(title, desc),
      });
      count++;
    }

    // Also try Atom entries
    if (items.length === 0) {
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = entryRegex.exec(xml)) !== null && items.length < 10) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i);
        const summaryMatch = block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
        const updatedMatch = block.match(/<(?:updated|published)[^>]*>([\s\S]*?)<\/(?:updated|published)>/i);

        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        if (!title) continue;

        const link = linkMatch ? linkMatch[1].trim() : "";
        const desc = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        const pubDate = updatedMatch ? updatedMatch[1].trim() : new Date().toISOString();

        let parsedDate: string;
        try { parsedDate = new Date(pubDate).toISOString(); } catch { parsedDate = new Date().toISOString(); }

        items.push({
          title,
          summary: desc.substring(0, 500),
          content: desc.substring(0, 3000),
          source_name: sourceName,
          source_url: link,
          published_at: parsedDate,
          scope,
          category: detectCategory(title, desc),
        });
      }
    }
  } catch (e) {
    console.error(`Error parsing RSS for ${sourceName}:`, e);
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is authenticated
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const requestedScopes: string[] = body.scopes || ["national", "international", "state", "local"];

    console.log("Intel briefing sync starting for scopes:", requestedScopes);

    const allItems: any[] = [];

    // Fetch from all requested scopes in parallel (batch 10 at a time to avoid overwhelming)
    for (const scope of requestedScopes) {
      const sources = SOURCES[scope] || [];
      const batchSize = 10;
      for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(s => parseRSS(s.rssUrl, s.name, s.scope))
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value);
          }
        }
      }
    }

    console.log(`Fetched ${allItems.length} total items from ${requestedScopes.length} scopes`);

    if (allItems.length > 0) {
      // Delete items older than 48 hours
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await supabase.from("intel_briefings").delete().lt("published_at", cutoff);

      // Upsert new items (deduplicate by title + source)
      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < allItems.length; i += batchSize) {
        const batch = allItems.slice(i, i + batchSize);
        const { error } = await supabase.from("intel_briefings").upsert(
          batch.map((item) => ({
            title: item.title,
            summary: item.summary,
            content: item.content,
            source_name: item.source_name,
            source_url: item.source_url,
            published_at: item.published_at,
            scope: item.scope,
            category: item.category,
          })),
          { onConflict: "title,source_name", ignoreDuplicates: true }
        );
        if (error) {
          console.error("Upsert error:", error.message);
        } else {
          inserted += batch.length;
        }
      }
      console.log(`Inserted/updated ${inserted} briefings`);
    }

    return new Response(
      JSON.stringify({ success: true, count: allItems.length }),
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
