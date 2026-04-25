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
    { name: "Seven Days VT", rssUrl: "https://www.sevendaysvt.com/RSS/", scope: "state" },
    { name: "InDepthNH", rssUrl: "https://indepthnh.org/feed/", scope: "state" },
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/", scope: "state" },
    { name: "uPolitics CT (CT Mirror)", rssUrl: "https://ctmirror.org/category/politics/feed/", scope: "state" },
    { name: "Indianapolis Star Politics", rssUrl: "https://rssfeeds.indystar.com/indystar/news/politics", scope: "state" },
    { name: "Cleveland.com Politics", rssUrl: "https://www.cleveland.com/arc/outboundfeeds/rss/category/news/politics/", scope: "state" },
    { name: "MLive Politics", rssUrl: "https://www.mlive.com/arc/outboundfeeds/rss/category/news/politics/", scope: "state" },
    { name: "Crain's Detroit", rssUrl: "https://www.crainsdetroit.com/rss.xml", scope: "state" },
    { name: "Wisconsin State Journal Politics", rssUrl: "https://madison.com/news/local/govt-and-politics/?_type=rss", scope: "state" },
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "state" },
    { name: "Iowa Starting Line", rssUrl: "https://iowastartingline.com/feed/", scope: "state" },
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/", scope: "state" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://www.stltoday.com/news/local/govt-and-politics/?_type=rss", scope: "state" },
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
    { name: "Idaho Statesman Politics", rssUrl: "https://www.idahostatesman.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15750881&getXmlFeed=true", scope: "local", state: "ID" },
    { name: "Boise State Public Radio", rssUrl: "https://www.boisestatepublicradio.org/feed", scope: "local", state: "ID" },

    // ─── Illinois (IL) ───
    { name: "Block Club Chicago", rssUrl: "https://blockclubchicago.org/feed/", scope: "local", state: "IL" },
    { name: "WBEZ Chicago", rssUrl: "https://www.wbez.org/feed", scope: "local", state: "IL" },
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
    { name: "Kansas City Star Politics", rssUrl: "https://www.kansascity.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15750881&getXmlFeed=true", scope: "local", state: "KS" },
    { name: "KCUR (Kansas City)", rssUrl: "https://www.kcur.org/feed", scope: "local", state: "KS" },

    // ─── Kentucky (KY) ───
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/", scope: "local", state: "KY" },
    { name: "Louisville Public Media", rssUrl: "https://www.lpm.org/feed", scope: "local", state: "KY" },
    { name: "Lexington Herald-Leader Politics", rssUrl: "https://www.kentucky.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15750881&getXmlFeed=true", scope: "local", state: "KY" },

    // ─── Louisiana (LA) ───
    { name: "Louisiana Illuminator", rssUrl: "https://lailluminator.com/feed/", scope: "local", state: "LA" },
    { name: "The Lens NOLA", rssUrl: "https://thelensnola.org/feed/", scope: "local", state: "LA" },
    { name: "Verite News (NOLA)", rssUrl: "https://veritenews.org/feed/", scope: "local", state: "LA" },
    { name: "Nola.com Politics", rssUrl: "https://www.nola.com/search/?f=rss&t=article&c=news/politics&l=50&s=start_time&sd=desc", scope: "local", state: "LA" },

    // ─── Maine (ME) ───
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/", scope: "local", state: "ME" },
    { name: "Portland Press Herald", rssUrl: "https://www.pressherald.com/feed/", scope: "local", state: "ME" },
    { name: "Maine Public", rssUrl: "https://www.mainepublic.org/feed", scope: "local", state: "ME" },

    // ─── Maryland (MD) ───
    { name: "Maryland Matters", rssUrl: "https://marylandmatters.org/feed/", scope: "local", state: "MD" },
    { name: "Baltimore Banner", rssUrl: "https://www.thebaltimorebanner.com/arc/outboundfeeds/rss/", scope: "local", state: "MD" },
    { name: "Baltimore Brew", rssUrl: "https://baltimorebrew.com/feed/", scope: "local", state: "MD" },
    { name: "Baltimore Sun Politics", rssUrl: "https://www.baltimoresun.com/politics/feed/", scope: "local", state: "MD" },

    // ─── Massachusetts (MA) ───
    { name: "CommonWealth Beacon (MA)", rssUrl: "https://commonwealthbeacon.org/feed/", scope: "local", state: "MA" },
    { name: "WBUR Boston", rssUrl: "https://www.wbur.org/feed", scope: "local", state: "MA" },
    { name: "Boston Globe Politics", rssUrl: "https://www.bostonglobe.com/rss/bdc_news_politics", scope: "local", state: "MA" },
    { name: "Boston Herald Politics", rssUrl: "https://www.bostonherald.com/news/politics/feed/", scope: "local", state: "MA" },

    // ─── Michigan (MI) ───
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/rss.xml", scope: "local", state: "MI" },
    { name: "Michigan Advance", rssUrl: "https://michiganadvance.com/feed/", scope: "local", state: "MI" },
    { name: "Detroit Free Press", rssUrl: "https://rssfeeds.freep.com/freep/home", scope: "local", state: "MI" },
    { name: "Outlier Media (Detroit)", rssUrl: "https://outliermedia.org/feed/", scope: "local", state: "MI" },

    // ─── Minnesota (MN) ───
    { name: "Minnesota Reformer", rssUrl: "https://minnesotareformer.com/feed/", scope: "local", state: "MN" },
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "local", state: "MN" },
    { name: "Sahan Journal (MN)", rssUrl: "https://sahanjournal.com/feed/", scope: "local", state: "MN" },
    { name: "MPR News", rssUrl: "https://www.mprnews.org/feed", scope: "local", state: "MN" },

    // ─── Mississippi (MS) ───
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/", scope: "local", state: "MS" },
    { name: "Mississippi Free Press", rssUrl: "https://www.mississippifreepress.org/feed/", scope: "local", state: "MS" },
    { name: "Clarion-Ledger Politics", rssUrl: "https://rssfeeds.clarionledger.com/mississippi/politics", scope: "local", state: "MS" },

    // ─── Missouri (MO) ───
    { name: "Missouri Independent", rssUrl: "https://missouriindependent.com/feed/", scope: "local", state: "MO" },
    { name: "St. Louis Public Radio", rssUrl: "https://news.stlpublicradio.org/feed", scope: "local", state: "MO" },
    { name: "The Beacon (KC)", rssUrl: "https://thebeacon.media/feed/", scope: "local", state: "MO" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://www.stltoday.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "MO" },

    // ─── Montana (MT) ───
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/", scope: "local", state: "MT" },
    { name: "Daily Montanan", rssUrl: "https://dailymontanan.com/feed/", scope: "local", state: "MT" },
    { name: "Montana Public Radio", rssUrl: "https://www.mtpr.org/feed", scope: "local", state: "MT" },

    // ─── Nebraska (NE) ───
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/", scope: "local", state: "NE" },
    { name: "Omaha World-Herald Politics", rssUrl: "https://omaha.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "NE" },
    { name: "Nebraska Public Media", rssUrl: "https://nebraskapublicmedia.org/feed", scope: "local", state: "NE" },

    // ─── Nevada (NV) ───
    { name: "Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed", scope: "local", state: "NV" },
    { name: "Nevada Current", rssUrl: "https://nevadacurrent.com/feed/", scope: "local", state: "NV" },
    { name: "Las Vegas Sun Politics", rssUrl: "https://lasvegassun.com/feeds/headlines/news/politics/", scope: "local", state: "NV" },
    { name: "Reno Gazette Journal", rssUrl: "https://rssfeeds.rgj.com/RGJ/News", scope: "local", state: "NV" },

    // ─── New Hampshire (NH) ───
    { name: "NH Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/", scope: "local", state: "NH" },
    { name: "NH Public Radio", rssUrl: "https://www.nhpr.org/feed", scope: "local", state: "NH" },
    { name: "Concord Monitor", rssUrl: "https://www.concordmonitor.com/section/rss?profile=1004", scope: "local", state: "NH" },

    // ─── New Jersey (NJ) ───
    { name: "NJ Monitor", rssUrl: "https://newjerseymonitor.com/feed/", scope: "local", state: "NJ" },
    { name: "NJ Spotlight News", rssUrl: "https://www.njspotlightnews.org/feed/", scope: "local", state: "NJ" },
    { name: "NJ.com Politics", rssUrl: "https://www.nj.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "NJ" },

    // ─── New Mexico (NM) ───
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/", scope: "local", state: "NM" },
    { name: "Santa Fe New Mexican", rssUrl: "https://www.santafenewmexican.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "NM" },
    { name: "Albuquerque Journal", rssUrl: "https://www.abqjournal.com/feed", scope: "local", state: "NM" },

    // ─── New York (NY) ───
    { name: "THE CITY NYC", rssUrl: "https://www.thecity.nyc/feed/", scope: "local", state: "NY" },
    { name: "Gothamist", rssUrl: "https://gothamist.com/feed", scope: "local", state: "NY" },
    { name: "WNYC News", rssUrl: "https://www.wnyc.org/feeds/articles", scope: "local", state: "NY" },
    { name: "City & State NY", rssUrl: "https://www.cityandstateny.com/arc/outboundfeeds/rss/", scope: "local", state: "NY" },
    { name: "Crain's New York", rssUrl: "https://www.crainsnewyork.com/rss.xml", scope: "local", state: "NY" },
    { name: "New York Focus", rssUrl: "https://nysfocus.com/feed", scope: "local", state: "NY" },

    // ─── North Carolina (NC) ───
    { name: "NC Newsline", rssUrl: "https://ncnewsline.com/feed/", scope: "local", state: "NC" },
    { name: "WRAL Politics", rssUrl: "https://www.wral.com/news/political/?format=rss", scope: "local", state: "NC" },
    { name: "Charlotte Ledger", rssUrl: "https://charlotteledger.substack.com/feed", scope: "local", state: "NC" },
    { name: "NC Health News", rssUrl: "https://www.northcarolinahealthnews.org/feed/", scope: "local", state: "NC" },

    // ─── North Dakota (ND) ───
    { name: "North Dakota Monitor", rssUrl: "https://northdakotamonitor.com/feed/", scope: "local", state: "ND" },
    { name: "Bismarck Tribune", rssUrl: "https://bismarcktribune.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "ND" },
    { name: "Forum of Fargo-Moorhead", rssUrl: "https://www.inforum.com/feed", scope: "local", state: "ND" },

    // ─── Ohio (OH) ───
    { name: "Ohio Capital Journal", rssUrl: "https://ohiocapitaljournal.com/feed/", scope: "local", state: "OH" },
    { name: "Signal Cleveland", rssUrl: "https://signalcleveland.org/feed/", scope: "local", state: "OH" },
    { name: "Signal Akron", rssUrl: "https://signalakron.org/feed/", scope: "local", state: "OH" },
    { name: "Cleveland.com Politics", rssUrl: "https://www.cleveland.com/politics/atom.xml", scope: "local", state: "OH" },
    { name: "Cincinnati Enquirer Politics", rssUrl: "https://rssfeeds.cincinnati.com/cincinnati/politics", scope: "local", state: "OH" },

    // ─── Oklahoma (OK) ───
    { name: "Oklahoma Voice", rssUrl: "https://oklahomavoice.com/feed/", scope: "local", state: "OK" },
    { name: "The Frontier (OK)", rssUrl: "https://www.readfrontier.org/feed/", scope: "local", state: "OK" },
    { name: "Oklahoma Watch", rssUrl: "https://oklahomawatch.org/feed/", scope: "local", state: "OK" },

    // ─── Oregon (OR) ───
    { name: "Oregon Capital Chronicle", rssUrl: "https://oregoncapitalchronicle.com/feed/", scope: "local", state: "OR" },
    { name: "Portland Mercury", rssUrl: "https://www.portlandmercury.com/Rss.xml", scope: "local", state: "OR" },
    { name: "Willamette Week", rssUrl: "https://www.wweek.com/feed/", scope: "local", state: "OR" },
    { name: "OPB News", rssUrl: "https://www.opb.org/news/feed/", scope: "local", state: "OR" },

    // ─── Pennsylvania (PA) ───
    { name: "Pennsylvania Capital-Star", rssUrl: "https://penncapital-star.com/feed/", scope: "local", state: "PA" },
    { name: "Spotlight PA", rssUrl: "https://www.spotlightpa.org/feed.xml", scope: "local", state: "PA" },
    { name: "Billy Penn", rssUrl: "https://billypenn.com/feed/", scope: "local", state: "PA" },
    { name: "WHYY (Philly)", rssUrl: "https://whyy.org/feed/", scope: "local", state: "PA" },
    { name: "PublicSource", rssUrl: "https://www.publicsource.org/feed/", scope: "local", state: "PA" },
    { name: "Pittsburgh Post-Gazette", rssUrl: "https://www.post-gazette.com/feed/feeds_local.xml", scope: "local", state: "PA" },

    // ─── Rhode Island (RI) ───
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/", scope: "local", state: "RI" },
    { name: "Providence Journal Politics", rssUrl: "https://rssfeeds.providencejournal.com/providence/politics", scope: "local", state: "RI" },
    { name: "Boston Globe RI", rssUrl: "https://www.bostonglobe.com/rss/bdc_news_rhode_island", scope: "local", state: "RI" },

    // ─── South Carolina (SC) ───
    { name: "SC Daily Gazette", rssUrl: "https://scdailygazette.com/feed/", scope: "local", state: "SC" },
    { name: "Post and Courier", rssUrl: "https://www.postandcourier.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "SC" },
    { name: "The State (SC) Politics", rssUrl: "https://www.thestate.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15750881&getXmlFeed=true", scope: "local", state: "SC" },

    // ─── South Dakota (SD) ───
    { name: "South Dakota Searchlight", rssUrl: "https://southdakotasearchlight.com/feed/", scope: "local", state: "SD" },
    { name: "Argus Leader Politics", rssUrl: "https://rssfeeds.argusleader.com/argusleader/politics", scope: "local", state: "SD" },
    { name: "Rapid City Journal", rssUrl: "https://rapidcityjournal.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "SD" },

    // ─── Tennessee (TN) ───
    { name: "Tennessee Lookout", rssUrl: "https://tennesseelookout.com/feed/", scope: "local", state: "TN" },
    { name: "Memphis Flyer", rssUrl: "https://www.memphisflyer.com/atom/news.xml", scope: "local", state: "TN" },
    { name: "Nashville Banner", rssUrl: "https://nashvillebanner.com/feed/", scope: "local", state: "TN" },
    { name: "MLK50", rssUrl: "https://mlk50.com/feed/", scope: "local", state: "TN" },

    // ─── Texas (TX) ───
    { name: "Texas Tribune", rssUrl: "https://www.texastribune.org/feeds/", scope: "local", state: "TX" },
    { name: "Texas Observer", rssUrl: "https://www.texasobserver.org/feed/", scope: "local", state: "TX" },
    { name: "Houston Landing", rssUrl: "https://houstonlanding.org/feed/", scope: "local", state: "TX" },
    { name: "Dallas Morning News Politics", rssUrl: "https://www.dallasnews.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "TX" },
    { name: "Austin American-Statesman Politics", rssUrl: "https://rssfeeds.statesman.com/statesman/politics", scope: "local", state: "TX" },

    // ─── Utah (UT) ───
    { name: "Utah News Dispatch", rssUrl: "https://utahnewsdispatch.com/feed/", scope: "local", state: "UT" },
    { name: "Salt Lake Tribune Politics", rssUrl: "https://www.sltrib.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "UT" },
    { name: "KUER News (Utah)", rssUrl: "https://www.kuer.org/feed", scope: "local", state: "UT" },

    // ─── Vermont (VT) ───
    { name: "VTDigger", rssUrl: "https://vtdigger.org/feed/", scope: "local", state: "VT" },
    { name: "Seven Days (VT)", rssUrl: "https://www.sevendaysvt.com/vermont/Rss.xml?section=2114676", scope: "local", state: "VT" },
    { name: "Vermont Public", rssUrl: "https://www.vermontpublic.org/feed", scope: "local", state: "VT" },

    // ─── Virginia (VA) ───
    { name: "Virginia Mercury", rssUrl: "https://virginiamercury.com/feed/", scope: "local", state: "VA" },
    { name: "Cardinal News (VA)", rssUrl: "https://cardinalnews.org/feed/", scope: "local", state: "VA" },
    { name: "Virginia Public Media", rssUrl: "https://vpm.org/feed", scope: "local", state: "VA" },
    { name: "Richmond Times-Dispatch Politics", rssUrl: "https://richmond.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "VA" },

    // ─── Washington (WA) ───
    { name: "Washington State Standard", rssUrl: "https://washingtonstatestandard.com/feed/", scope: "local", state: "WA" },
    { name: "Seattle Times Politics", rssUrl: "https://www.seattletimes.com/seattle-news/politics/feed/", scope: "local", state: "WA" },
    { name: "PubliCola (Seattle)", rssUrl: "https://publicola.com/feed/", scope: "local", state: "WA" },
    { name: "Crosscut", rssUrl: "https://crosscut.com/feed", scope: "local", state: "WA" },
    { name: "InvestigateWest", rssUrl: "https://www.invw.org/feed/", scope: "local", state: "WA" },

    // ─── West Virginia (WV) ───
    { name: "West Virginia Watch", rssUrl: "https://westvirginiawatch.com/feed/", scope: "local", state: "WV" },
    { name: "Mountain State Spotlight (WV)", rssUrl: "https://mountainstatespotlight.org/feed/", scope: "local", state: "WV" },
    { name: "Charleston Gazette-Mail", rssUrl: "https://www.wvgazettemail.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WV" },

    // ─── Wisconsin (WI) ───
    { name: "Wisconsin Examiner", rssUrl: "https://wisconsinexaminer.com/feed/", scope: "local", state: "WI" },
    { name: "Wisconsin Watch", rssUrl: "https://wisconsinwatch.org/feed/", scope: "local", state: "WI" },
    { name: "Milwaukee Journal Sentinel Politics", rssUrl: "https://rssfeeds.jsonline.com/milwaukee/politics", scope: "local", state: "WI" },
    { name: "Urban Milwaukee", rssUrl: "https://urbanmilwaukee.com/feed/", scope: "local", state: "WI" },

    // ─── Wyoming (WY) ───
    { name: "WyoFile", rssUrl: "https://wyofile.com/feed/", scope: "local", state: "WY" },
    { name: "Cowboy State Daily", rssUrl: "https://cowboystatedaily.com/feed/", scope: "local", state: "WY" },
    { name: "Casper Star-Tribune", rssUrl: "https://trib.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WY" },

    // ─── District of Columbia (DC) ───
    { name: "DCist", rssUrl: "https://dcist.com/feed", scope: "local", state: "DC" },
    { name: "WAMU (DC)", rssUrl: "https://wamu.org/feed/", scope: "local", state: "DC" },
    { name: "Washington City Paper", rssUrl: "https://washingtoncitypaper.com/feed/", scope: "local", state: "DC" },

    // ─── Expansion pack: additional in-state outlets for all 50 states + DC ───
    // Alabama
    { name: "WBHM (Birmingham NPR)", rssUrl: "https://wbhm.org/feed/", scope: "local", state: "AL" },
    { name: "WHNT News 19 (Huntsville)", rssUrl: "https://whnt.com/feed/", scope: "local", state: "AL" },
    { name: "Montgomery Advertiser", rssUrl: "https://rssfeeds.montgomeryadvertiser.com/montgomery/news", scope: "local", state: "AL" },
    // Alaska
    { name: "KTOO (Juneau)", rssUrl: "https://www.ktoo.org/feed/", scope: "local", state: "AK" },
    { name: "KTUU / Alaska's News Source", rssUrl: "https://www.alaskasnewssource.com/arc/outboundfeeds/rss/", scope: "local", state: "AK" },
    { name: "Fairbanks Daily News-Miner", rssUrl: "https://www.newsminer.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", scope: "local", state: "AK" },
    // Arizona
    { name: "KJZZ (Phoenix NPR)", rssUrl: "https://kjzz.org/rss.xml", scope: "local", state: "AZ" },
    { name: "Arizona Capitol Times", rssUrl: "https://azcapitoltimes.com/feed/", scope: "local", state: "AZ" },
    { name: "AZPM News (Tucson)", rssUrl: "https://news.azpm.org/rss.xml", scope: "local", state: "AZ" },
    // Arkansas
    { name: "Talk Business & Politics (AR)", rssUrl: "https://talkbusiness.net/feed/", scope: "local", state: "AR" },
    { name: "KUAR (Little Rock NPR)", rssUrl: "https://www.ualrpublicradio.org/feed", scope: "local", state: "AR" },
    { name: "Arkansas Business", rssUrl: "https://www.arkansasbusiness.com/feed/", scope: "local", state: "AR" },
    // California
    { name: "Sacramento Bee Politics", rssUrl: "https://www.sacbee.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "CA" },
    { name: "LA Times California Politics", rssUrl: "https://www.latimes.com/california/rss2.0.xml", scope: "local", state: "CA" },
    { name: "SF Chronicle Politics", rssUrl: "https://www.sfchronicle.com/politics/feed/Politics-562.php", scope: "local", state: "CA" },
    { name: "San Diego Union-Tribune Politics", rssUrl: "https://www.sandiegouniontribune.com/news/politics/feed/", scope: "local", state: "CA" },
    { name: "Capitol Weekly (CA)", rssUrl: "https://capitolweekly.net/feed/", scope: "local", state: "CA" },
    // Colorado
    { name: "CPR News (Colorado)", rssUrl: "https://www.cpr.org/feed/", scope: "local", state: "CO" },
    { name: "Colorado Politics", rssUrl: "https://www.coloradopolitics.com/feed/", scope: "local", state: "CO" },
    { name: "Westword (Denver)", rssUrl: "https://www.westword.com/feed", scope: "local", state: "CO" },
    // Connecticut
    { name: "WSHU (Connecticut Public)", rssUrl: "https://www.wshu.org/feed", scope: "local", state: "CT" },
    { name: "New Haven Independent", rssUrl: "https://www.newhavenindependent.org/index.php/feed/", scope: "local", state: "CT" },
    { name: "CT Examiner", rssUrl: "https://ctexaminer.com/feed/", scope: "local", state: "CT" },
    // Delaware
    { name: "Delaware Business Times", rssUrl: "https://delawarebusinesstimes.com/feed/", scope: "local", state: "DE" },
    { name: "Bay to Bay News (DE)", rssUrl: "https://baytobaynews.com/rss/", scope: "local", state: "DE" },
    // Florida
    { name: "Florida Politics", rssUrl: "https://floridapolitics.com/feed/", scope: "local", state: "FL" },
    { name: "Sun Sentinel Politics (FL)", rssUrl: "https://www.sun-sentinel.com/news/politics/feed/", scope: "local", state: "FL" },
    { name: "WUSF Public Media (Tampa)", rssUrl: "https://wusfnews.wusf.usf.edu/feed", scope: "local", state: "FL" },
    { name: "Florida Today", rssUrl: "https://rssfeeds.floridatoday.com/florida-today/news", scope: "local", state: "FL" },
    // Georgia
    { name: "GPB News (Georgia)", rssUrl: "https://www.gpb.org/feeds/news.rss", scope: "local", state: "GA" },
    { name: "Macon Telegraph Politics", rssUrl: "https://www.macon.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "GA" },
    { name: "WABE (Atlanta NPR)", rssUrl: "https://www.wabe.org/feed/", scope: "local", state: "GA" },
    // Hawaii
    { name: "Hawaii News Now", rssUrl: "https://www.hawaiinewsnow.com/arc/outboundfeeds/rss/", scope: "local", state: "HI" },
    { name: "Maui News", rssUrl: "https://www.mauinews.com/feed/", scope: "local", state: "HI" },
    // Idaho
    { name: "Idaho Statesman Politics", rssUrl: "https://www.idahostatesman.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "ID" },
    { name: "Boise State Public Radio", rssUrl: "https://www.boisestatepublicradio.org/feed", scope: "local", state: "ID" },
    { name: "Idaho Press", rssUrl: "https://www.idahopress.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", scope: "local", state: "ID" },
    // Illinois
    { name: "WBEZ Chicago", rssUrl: "https://www.wbez.org/feed/", scope: "local", state: "IL" },
    { name: "Chicago Sun-Times Politics", rssUrl: "https://chicago.suntimes.com/rss/politics", scope: "local", state: "IL" },
    { name: "Capitol News Illinois", rssUrl: "https://www.capitolnewsillinois.com/feed/", scope: "local", state: "IL" },
    { name: "Crain's Chicago Business", rssUrl: "https://www.chicagobusiness.com/rss-feeds", scope: "local", state: "IL" },
    // Indiana
    { name: "WFYI (Indianapolis)", rssUrl: "https://www.wfyi.org/feed", scope: "local", state: "IN" },
    { name: "Indiana Capital Chronicle", rssUrl: "https://indianacapitalchronicle.com/feed/", scope: "local", state: "IN" },
    { name: "IndyStar Politics", rssUrl: "https://rssfeeds.indystar.com/indianapolis/politics", scope: "local", state: "IN" },
    // Iowa
    { name: "Iowa Capital Dispatch", rssUrl: "https://iowacapitaldispatch.com/feed/", scope: "local", state: "IA" },
    { name: "Des Moines Register Politics", rssUrl: "https://rssfeeds.desmoinesregister.com/desmoines/politics", scope: "local", state: "IA" },
    { name: "Iowa Public Radio", rssUrl: "https://www.iowapublicradio.org/feed", scope: "local", state: "IA" },
    // Kansas
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/", scope: "local", state: "KS" },
    { name: "Kansas City Star Politics", rssUrl: "https://www.kansascity.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "KS" },
    { name: "KCUR (Kansas City NPR)", rssUrl: "https://www.kcur.org/feed", scope: "local", state: "KS" },
    // Kentucky
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/", scope: "local", state: "KY" },
    { name: "Louisville Public Media (WFPL)", rssUrl: "https://wfpl.org/feed/", scope: "local", state: "KY" },
    { name: "Lexington Herald-Leader Politics", rssUrl: "https://www.kentucky.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "KY" },
    // Louisiana
    { name: "Louisiana Illuminator", rssUrl: "https://lailluminator.com/feed/", scope: "local", state: "LA" },
    { name: "WWNO (New Orleans NPR)", rssUrl: "https://www.wwno.org/feed", scope: "local", state: "LA" },
    { name: "The Advocate (LA) Politics", rssUrl: "https://www.theadvocate.com/search/?f=rss&t=article&c=news/politics&l=50&s=start_time&sd=desc", scope: "local", state: "LA" },
    // Maine
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/", scope: "local", state: "ME" },
    { name: "Bangor Daily News Politics", rssUrl: "https://www.bangordailynews.com/politics/feed/", scope: "local", state: "ME" },
    { name: "Maine Public", rssUrl: "https://www.mainepublic.org/feed", scope: "local", state: "ME" },
    // Maryland
    { name: "Maryland Matters", rssUrl: "https://www.marylandmatters.org/feed/", scope: "local", state: "MD" },
    { name: "Baltimore Banner", rssUrl: "https://www.thebaltimorebanner.com/arc/outboundfeeds/rss/", scope: "local", state: "MD" },
    { name: "WYPR (Baltimore NPR)", rssUrl: "https://www.wypr.org/feed", scope: "local", state: "MD" },
    // Massachusetts
    { name: "WBUR (Boston)", rssUrl: "https://www.wbur.org/feed", scope: "local", state: "MA" },
    { name: "Commonwealth Beacon", rssUrl: "https://commonwealthbeacon.org/feed/", scope: "local", state: "MA" },
    { name: "Boston Globe Politics", rssUrl: "https://www.bostonglobe.com/rss/news/politics", scope: "local", state: "MA" },
    { name: "MassLive Politics", rssUrl: "https://www.masslive.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "MA" },
    // Michigan
    { name: "Michigan Advance", rssUrl: "https://michiganadvance.com/feed/", scope: "local", state: "MI" },
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/rss.xml", scope: "local", state: "MI" },
    { name: "Detroit Free Press Politics", rssUrl: "https://rssfeeds.freep.com/freep/politics", scope: "local", state: "MI" },
    { name: "Michigan Radio (NPR)", rssUrl: "https://www.michiganradio.org/feed", scope: "local", state: "MI" },
    // Minnesota
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/", scope: "local", state: "MN" },
    { name: "MPR News", rssUrl: "https://www.mprnews.org/feed", scope: "local", state: "MN" },
    { name: "Minnesota Reformer", rssUrl: "https://minnesotareformer.com/feed/", scope: "local", state: "MN" },
    { name: "Star Tribune Politics", rssUrl: "https://www.startribune.com/politics/index.rss2", scope: "local", state: "MN" },
    // Mississippi
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/", scope: "local", state: "MS" },
    { name: "Mississippi Free Press", rssUrl: "https://www.mississippifreepress.org/feed/", scope: "local", state: "MS" },
    { name: "Clarion Ledger Politics", rssUrl: "https://rssfeeds.clarionledger.com/clarionledger/news/politics", scope: "local", state: "MS" },
    // Missouri
    { name: "Missouri Independent", rssUrl: "https://missouriindependent.com/feed/", scope: "local", state: "MO" },
    { name: "St. Louis Public Radio", rssUrl: "https://news.stlpublicradio.org/feed", scope: "local", state: "MO" },
    { name: "St. Louis Post-Dispatch Politics", rssUrl: "https://www.stltoday.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "MO" },
    // Montana
    { name: "Daily Montanan", rssUrl: "https://dailymontanan.com/feed/", scope: "local", state: "MT" },
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/", scope: "local", state: "MT" },
    { name: "Montana Public Radio", rssUrl: "https://www.mtpr.org/feed", scope: "local", state: "MT" },
    // Nebraska
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/", scope: "local", state: "NE" },
    { name: "Omaha World-Herald Politics", rssUrl: "https://omaha.com/search/?f=rss&t=article&c=news/state-and-regional/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "NE" },
    { name: "Flatwater Free Press", rssUrl: "https://flatwaterfreepress.org/feed/", scope: "local", state: "NE" },
    // Nevada
    { name: "Nevada Current", rssUrl: "https://nevadacurrent.com/feed/", scope: "local", state: "NV" },
    { name: "The Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed", scope: "local", state: "NV" },
    { name: "Las Vegas Review-Journal Politics", rssUrl: "https://www.reviewjournal.com/feed/?post_type=post&category_name=politics-and-government", scope: "local", state: "NV" },
    // New Hampshire
    { name: "New Hampshire Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/", scope: "local", state: "NH" },
    { name: "NHPR", rssUrl: "https://www.nhpr.org/feed", scope: "local", state: "NH" },
    { name: "NH Journal", rssUrl: "https://nhjournal.com/feed/", scope: "local", state: "NH" },
    // New Jersey
    { name: "New Jersey Monitor", rssUrl: "https://newjerseymonitor.com/feed/", scope: "local", state: "NJ" },
    { name: "NJ Spotlight News", rssUrl: "https://www.njspotlightnews.org/feed/", scope: "local", state: "NJ" },
    { name: "WNYC (NJ/NY)", rssUrl: "https://www.wnyc.org/feed", scope: "local", state: "NJ" },
    { name: "NJ.com Politics", rssUrl: "https://www.nj.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "NJ" },
    // New Mexico
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/", scope: "local", state: "NM" },
    { name: "Santa Fe New Mexican Politics", rssUrl: "https://www.santafenewmexican.com/search/?f=rss&t=article&c=news/local_news&l=50&s=start_time&sd=desc", scope: "local", state: "NM" },
    { name: "KUNM (NM Public Radio)", rssUrl: "https://www.kunm.org/feed", scope: "local", state: "NM" },
    // New York
    { name: "City & State New York", rssUrl: "https://www.cityandstateny.com/arc/outboundfeeds/rss/", scope: "local", state: "NY" },
    { name: "Spectrum News NY1", rssUrl: "https://www.ny1.com/nyc/all-boroughs/news.rss", scope: "local", state: "NY" },
    { name: "The City (NYC)", rssUrl: "https://www.thecity.nyc/rss/", scope: "local", state: "NY" },
    { name: "Times Union Politics (Albany)", rssUrl: "https://www.timesunion.com/news/politics/feed/", scope: "local", state: "NY" },
    { name: "Buffalo News Politics", rssUrl: "https://buffalonews.com/search/?f=rss&t=article&c=news/local/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "NY" },
    // North Carolina
    { name: "NC Newsline", rssUrl: "https://ncnewsline.com/feed/", scope: "local", state: "NC" },
    { name: "WUNC (NC Public Radio)", rssUrl: "https://www.wunc.org/feed", scope: "local", state: "NC" },
    { name: "Raleigh News & Observer Politics", rssUrl: "https://www.newsobserver.com/news/politics-government/?widgetName=rssfeed&widgetContentId=15709873&getXmlFeed=true", scope: "local", state: "NC" },
    { name: "Carolina Public Press", rssUrl: "https://carolinapublicpress.org/feed/", scope: "local", state: "NC" },
    // North Dakota
    { name: "North Dakota Monitor", rssUrl: "https://northdakotamonitor.com/feed/", scope: "local", state: "ND" },
    { name: "Bismarck Tribune", rssUrl: "https://bismarcktribune.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc", scope: "local", state: "ND" },
    { name: "Prairie Public (ND)", rssUrl: "https://news.prairiepublic.org/feed", scope: "local", state: "ND" },
    // Ohio
    { name: "Ohio Capital Journal", rssUrl: "https://ohiocapitaljournal.com/feed/", scope: "local", state: "OH" },
    { name: "Cleveland.com Politics", rssUrl: "https://www.cleveland.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "OH" },
    { name: "WCPO (Cincinnati)", rssUrl: "https://www.wcpo.com/news.rss", scope: "local", state: "OH" },
    { name: "WOSU (Columbus NPR)", rssUrl: "https://news.wosu.org/feed", scope: "local", state: "OH" },
    // Oklahoma
    { name: "Oklahoma Voice", rssUrl: "https://oklahomavoice.com/feed/", scope: "local", state: "OK" },
    { name: "The Oklahoman Politics", rssUrl: "https://rssfeeds.oklahoman.com/oklahoma/news/politics", scope: "local", state: "OK" },
    { name: "Oklahoma Watch", rssUrl: "https://oklahomawatch.org/feed/", scope: "local", state: "OK" },
    // Oregon
    { name: "Oregon Capital Chronicle", rssUrl: "https://oregoncapitalchronicle.com/feed/", scope: "local", state: "OR" },
    { name: "OPB News", rssUrl: "https://www.opb.org/news/feed/", scope: "local", state: "OR" },
    { name: "Willamette Week", rssUrl: "https://www.wweek.com/feed/", scope: "local", state: "OR" },
    { name: "The Oregonian Politics", rssUrl: "https://www.oregonlive.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "OR" },
    // Pennsylvania
    { name: "Pennsylvania Capital-Star", rssUrl: "https://penncapital-star.com/feed/", scope: "local", state: "PA" },
    { name: "Spotlight PA", rssUrl: "https://www.spotlightpa.org/feed.rss", scope: "local", state: "PA" },
    { name: "WHYY (Philadelphia)", rssUrl: "https://whyy.org/feed/", scope: "local", state: "PA" },
    { name: "Philadelphia Inquirer Politics", rssUrl: "https://www.inquirer.com/arc/outboundfeeds/rss/category/politics/", scope: "local", state: "PA" },
    { name: "Pittsburgh Post-Gazette Politics", rssUrl: "https://www.post-gazette.com/rss/feed/news/politics-state", scope: "local", state: "PA" },
    // Rhode Island
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/", scope: "local", state: "RI" },
    { name: "Providence Journal Politics", rssUrl: "https://rssfeeds.providencejournal.com/providencejournal/news/politics", scope: "local", state: "RI" },
    { name: "The Public's Radio (RI)", rssUrl: "https://thepublicsradio.org/feed", scope: "local", state: "RI" },
    // South Carolina
    { name: "SC Daily Gazette", rssUrl: "https://scdailygazette.com/feed/", scope: "local", state: "SC" },
    { name: "Post and Courier Politics", rssUrl: "https://www.postandcourier.com/search/?f=rss&t=article&c=politics&l=50&s=start_time&sd=desc", scope: "local", state: "SC" },
    { name: "South Carolina Public Radio", rssUrl: "https://www.southcarolinapublicradio.org/feed", scope: "local", state: "SC" },
    // South Dakota
    { name: "South Dakota Searchlight", rssUrl: "https://southdakotasearchlight.com/feed/", scope: "local", state: "SD" },
    { name: "SDPB News", rssUrl: "https://www.sdpb.org/feed", scope: "local", state: "SD" },
    { name: "Argus Leader Politics", rssUrl: "https://rssfeeds.argusleader.com/argusleader/news/politics", scope: "local", state: "SD" },
    // Tennessee
    { name: "Tennessee Lookout", rssUrl: "https://tennesseelookout.com/feed/", scope: "local", state: "TN" },
    { name: "WPLN (Nashville NPR)", rssUrl: "https://wpln.org/feed/", scope: "local", state: "TN" },
    { name: "The Tennessean Politics", rssUrl: "https://rssfeeds.tennessean.com/tennessean/news/politics", scope: "local", state: "TN" },
    { name: "Chattanooga Times Free Press", rssUrl: "https://www.timesfreepress.com/rss/headlines/local/", scope: "local", state: "TN" },
    // Texas
    { name: "Texas Tribune", rssUrl: "https://www.texastribune.org/feeds/news/", scope: "local", state: "TX" },
    { name: "Houston Chronicle Politics", rssUrl: "https://www.houstonchronicle.com/politics/feed/Politics-562.php", scope: "local", state: "TX" },
    { name: "Dallas Morning News Politics", rssUrl: "https://www.dallasnews.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "TX" },
    { name: "Austin American-Statesman Politics", rssUrl: "https://rssfeeds.statesman.com/statesman/news/politics", scope: "local", state: "TX" },
    { name: "KUT (Austin NPR)", rssUrl: "https://www.kut.org/feed", scope: "local", state: "TX" },
    { name: "San Antonio Express-News Politics", rssUrl: "https://www.expressnews.com/news/politics/feed/", scope: "local", state: "TX" },
    // Utah
    { name: "Utah News Dispatch", rssUrl: "https://utahnewsdispatch.com/feed/", scope: "local", state: "UT" },
    { name: "Salt Lake Tribune Politics", rssUrl: "https://www.sltrib.com/arc/outboundfeeds/rss/category/news/politics/", scope: "local", state: "UT" },
    { name: "KUER (Utah NPR)", rssUrl: "https://www.kuer.org/feed", scope: "local", state: "UT" },
    // Vermont
    { name: "VTDigger", rssUrl: "https://vtdigger.org/feed/", scope: "local", state: "VT" },
    { name: "Vermont Public", rssUrl: "https://www.vermontpublic.org/feed", scope: "local", state: "VT" },
    { name: "Seven Days (VT)", rssUrl: "https://www.sevendaysvt.com/vermont/Rss.xml?section=2197411", scope: "local", state: "VT" },
    // Virginia
    { name: "Virginia Mercury", rssUrl: "https://www.virginiamercury.com/feed/", scope: "local", state: "VA" },
    { name: "VPM News", rssUrl: "https://www.vpm.org/feed", scope: "local", state: "VA" },
    { name: "Richmond Times-Dispatch Politics", rssUrl: "https://richmond.com/search/?f=rss&t=article&c=news/state-and-regional/govt-and-politics&l=50&s=start_time&sd=desc", scope: "local", state: "VA" },
    { name: "Cardinal News (VA)", rssUrl: "https://cardinalnews.org/feed/", scope: "local", state: "VA" },
    // Washington
    { name: "Washington State Standard", rssUrl: "https://washingtonstatestandard.com/feed/", scope: "local", state: "WA" },
    { name: "KUOW (Seattle NPR)", rssUrl: "https://www.kuow.org/feed", scope: "local", state: "WA" },
    { name: "Crosscut", rssUrl: "https://crosscut.com/rss.xml", scope: "local", state: "WA" },
    { name: "Seattle Times Politics", rssUrl: "https://www.seattletimes.com/seattle-news/politics/feed/", scope: "local", state: "WA" },
    // West Virginia
    { name: "West Virginia Watch", rssUrl: "https://westvirginiawatch.com/feed/", scope: "local", state: "WV" },
    { name: "Mountain State Spotlight", rssUrl: "https://mountainstatespotlight.org/feed/", scope: "local", state: "WV" },
    { name: "WV Public Broadcasting", rssUrl: "https://wvpublic.org/feed/", scope: "local", state: "WV" },
    // Wisconsin
    { name: "Wisconsin Examiner", rssUrl: "https://wisconsinexaminer.com/feed/", scope: "local", state: "WI" },
    { name: "Wisconsin Watch", rssUrl: "https://wisconsinwatch.org/feed/", scope: "local", state: "WI" },
    { name: "Milwaukee Journal Sentinel Politics", rssUrl: "https://rssfeeds.jsonline.com/milwaukee/politics", scope: "local", state: "WI" },
    { name: "WPR (Wisconsin Public Radio)", rssUrl: "https://www.wpr.org/feed", scope: "local", state: "WI" },
    // Wyoming
    { name: "WyoFile", rssUrl: "https://wyofile.com/feed/", scope: "local", state: "WY" },
    { name: "Wyoming Public Media", rssUrl: "https://www.wyomingpublicmedia.org/feed", scope: "local", state: "WY" },
    { name: "Wyoming Tribune Eagle", rssUrl: "https://www.wyomingnews.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WY" },
    { name: "Sheridan Press", rssUrl: "https://www.thesheridanpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WY" },
    { name: "Jackson Hole News & Guide", rssUrl: "https://www.jhnewsandguide.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WY" },
    { name: "Gillette News Record", rssUrl: "https://www.gillettenewsrecord.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "WY" },
    // District of Columbia
    { name: "Washington Informer", rssUrl: "https://www.washingtoninformer.com/feed/", scope: "local", state: "DC" },
    { name: "Greater Greater Washington", rssUrl: "https://ggwash.org/atom.xml", scope: "local", state: "DC" },
    { name: "The DC Line", rssUrl: "https://thedcline.org/feed/", scope: "local", state: "DC" },
    { name: "DCist", rssUrl: "https://dcist.com/feed/", scope: "local", state: "DC" },
    { name: "Washington City Paper", rssUrl: "https://washingtoncitypaper.com/feed/", scope: "local", state: "DC" },
    { name: "Street Sense Media", rssUrl: "https://www.streetsensemedia.org/feed/", scope: "local", state: "DC" },
    // Delaware (additional)
    { name: "Coastal Point (DE)", rssUrl: "https://www.coastalpoint.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc", scope: "local", state: "DE" },
    { name: "Cape Gazette (DE)", rssUrl: "https://www.capegazette.com/rss.xml", scope: "local", state: "DE" },
    { name: "Town Square Delaware", rssUrl: "https://townsquaredelaware.com/feed/", scope: "local", state: "DE" },
    // Hawaii (additional)
    { name: "Big Island Now", rssUrl: "https://bigislandnow.com/feed/", scope: "local", state: "HI" },
    { name: "Maui Now", rssUrl: "https://mauinow.com/feed/", scope: "local", state: "HI" },
    { name: "Kauai Now", rssUrl: "https://kauainow.com/feed/", scope: "local", state: "HI" },
    { name: "Garden Island (Kauai)", rssUrl: "https://www.thegardenisland.com/feed/", scope: "local", state: "HI" },
    { name: "West Hawaii Today", rssUrl: "https://www.westhawaiitoday.com/feed/", scope: "local", state: "HI" },
  ],
};

async function parseRSS(url: string, sourceName: string, scope: string, state?: string): Promise<Array<{
  title: string; summary: string; content: string; source_name: string;
  source_url: string; published_at: string; scope: string; category: string; region: string | null;
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
    const PER_FEED_CAP = 50; // was 10 — now pulls full feed depth
    while ((match = itemRegex.exec(xml)) !== null && count < PER_FEED_CAP) {
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
        const d = new Date(pubDate);
        // Reject NaN and clamp future dates (RSS feeds frequently lie) to "now"
        if (isNaN(d.getTime())) parsedDate = new Date().toISOString();
        else if (d.getTime() > Date.now() + 60 * 60 * 1000) parsedDate = new Date().toISOString();
        else parsedDate = d.toISOString();
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
        region: state ?? null,
      });
      count++;
    }

    // Also try Atom entries
    if (items.length === 0) {
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = entryRegex.exec(xml)) !== null && items.length < 50) {
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
        try {
          const d = new Date(pubDate);
          if (isNaN(d.getTime())) parsedDate = new Date().toISOString();
          else if (d.getTime() > Date.now() + 60 * 60 * 1000) parsedDate = new Date().toISOString();
          else parsedDate = d.toISOString();
        } catch { parsedDate = new Date().toISOString(); }

        items.push({
          title,
          summary: desc.substring(0, 500),
          content: desc.substring(0, 3000),
          source_name: sourceName,
          source_url: link,
          published_at: parsedDate,
          scope,
          category: detectCategory(title, desc),
          region: state ?? null,
        });
      }
    }
  } catch (e) {
    console.error(`Error parsing RSS for ${sourceName}:`, e);
  }
  return items;
}

// Vetted reserve pool of additional local RSS feeds, keyed by state abbreviation.
// Used by the "top_up_local_sources" action to propose new feeds for low-coverage states.
// Each candidate is probed live before being returned, so dead feeds are filtered out automatically.
const LOCAL_RESERVE: Record<string, Array<{ name: string; rssUrl: string }>> = {
  AL: [
    { name: "AL.com", rssUrl: "https://www.al.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Alabama Reflector", rssUrl: "https://alabamareflector.com/feed/" },
    { name: "Alabama Political Reporter", rssUrl: "https://www.alreporter.com/feed/" },
    { name: "Birmingham Watch", rssUrl: "https://birminghamwatch.org/feed/" },
  ],
  AK: [
    { name: "Anchorage Daily News", rssUrl: "https://www.adn.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Alaska Public Media", rssUrl: "https://alaskapublic.org/feed/" },
    { name: "Alaska Beacon", rssUrl: "https://alaskabeacon.com/feed/" },
  ],
  AZ: [
    { name: "Arizona Republic", rssUrl: "https://www.azcentral.com/arc/outboundfeeds/rss/category/news/?outputType=xml" },
    { name: "Tucson Sentinel", rssUrl: "https://www.tucsonsentinel.com/rss/news.xml" },
    { name: "AZ Mirror", rssUrl: "https://azmirror.com/feed/" },
    { name: "Arizona Daily Star", rssUrl: "https://tucson.com/search/?f=rss&t=article&c=news&l=25&s=start_time&sd=desc" },
  ],
  AR: [
    { name: "Arkansas Times", rssUrl: "https://arktimes.com/feed" },
    { name: "Arkansas Advocate", rssUrl: "https://arkansasadvocate.com/feed/" },
    { name: "Talk Business & Politics", rssUrl: "https://talkbusiness.net/feed/" },
  ],
  CA: [
    { name: "LA Times — California", rssUrl: "https://www.latimes.com/california/rss2.0.xml" },
    { name: "SF Chronicle", rssUrl: "https://www.sfchronicle.com/rss/feed/Bay-Area-News-3.php" },
    { name: "CalMatters", rssUrl: "https://calmatters.org/feed/" },
    { name: "Voice of San Diego", rssUrl: "https://voiceofsandiego.org/feed/" },
    { name: "Berkeleyside", rssUrl: "https://www.berkeleyside.org/feed" },
  ],
  CO: [
    { name: "Denver Post", rssUrl: "https://www.denverpost.com/feed/" },
    { name: "Colorado Sun", rssUrl: "https://coloradosun.com/feed/" },
    { name: "Colorado Newsline", rssUrl: "https://coloradonewsline.com/feed/" },
    { name: "Westword", rssUrl: "https://www.westword.com/api/v1/feed/news.rss" },
  ],
  CT: [
    { name: "CT Mirror", rssUrl: "https://ctmirror.org/feed/" },
    { name: "Hartford Courant", rssUrl: "https://www.courant.com/feed/" },
    { name: "CT Insider", rssUrl: "https://www.ctinsider.com/rss/feed/News-13351.php" },
  ],
  DE: [
    { name: "Delaware Online", rssUrl: "https://www.delawareonline.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Delaware Public Media", rssUrl: "https://www.delawarepublic.org/feed/" },
    { name: "Spotlight Delaware", rssUrl: "https://spotlightdelaware.org/feed/" },
  ],
  FL: [
    { name: "Miami Herald", rssUrl: "https://www.miamiherald.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
    { name: "Tampa Bay Times", rssUrl: "https://www.tampabay.com/feed/" },
    { name: "Florida Phoenix", rssUrl: "https://floridaphoenix.com/feed/" },
    { name: "Orlando Sentinel", rssUrl: "https://www.orlandosentinel.com/feed/" },
    { name: "WLRN Miami", rssUrl: "https://www.wlrn.org/news.rss" },
  ],
  GA: [
    { name: "Atlanta Journal-Constitution", rssUrl: "https://www.ajc.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Georgia Recorder", rssUrl: "https://georgiarecorder.com/feed/" },
    { name: "GPB News", rssUrl: "https://www.gpb.org/news.xml" },
    { name: "Atlanta Civic Circle", rssUrl: "https://atlantaciviccircle.org/feed/" },
  ],
  HI: [
    { name: "Honolulu Civil Beat", rssUrl: "https://www.civilbeat.org/feed/" },
    { name: "Hawaii News Now", rssUrl: "https://www.hawaiinewsnow.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Star-Advertiser", rssUrl: "https://www.staradvertiser.com/feed/" },
  ],
  ID: [
    { name: "Idaho Statesman", rssUrl: "https://www.idahostatesman.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
    { name: "Idaho Capital Sun", rssUrl: "https://idahocapitalsun.com/feed/" },
    { name: "Boise Dev", rssUrl: "https://boisedev.com/feed/" },
  ],
  IL: [
    { name: "Chicago Sun-Times", rssUrl: "https://chicago.suntimes.com/rss" },
    { name: "Block Club Chicago", rssUrl: "https://blockclubchicago.org/feed/" },
    { name: "Capitol News Illinois", rssUrl: "https://capitolnewsillinois.com/feed" },
    { name: "Illinois Answers Project", rssUrl: "https://illinoisanswers.org/feed/" },
  ],
  IN: [
    { name: "IndyStar", rssUrl: "https://www.indystar.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Indiana Capital Chronicle", rssUrl: "https://indianacapitalchronicle.com/feed/" },
    { name: "Mirror Indy", rssUrl: "https://mirrorindy.org/feed/" },
  ],
  IA: [
    { name: "Des Moines Register", rssUrl: "https://www.desmoinesregister.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Iowa Capital Dispatch", rssUrl: "https://iowacapitaldispatch.com/feed/" },
    { name: "Iowa Public Radio", rssUrl: "https://www.iowapublicradio.org/news.rss" },
  ],
  KS: [
    { name: "Kansas Reflector", rssUrl: "https://kansasreflector.com/feed/" },
    { name: "Kansas City Star", rssUrl: "https://www.kansascity.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
    { name: "KCUR", rssUrl: "https://www.kcur.org/news.rss" },
  ],
  KY: [
    { name: "Louisville Courier-Journal", rssUrl: "https://www.courier-journal.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Kentucky Lantern", rssUrl: "https://kentuckylantern.com/feed/" },
    { name: "WFPL Louisville", rssUrl: "https://wfpl.org/feed/" },
  ],
  LA: [
    { name: "NOLA.com", rssUrl: "https://www.nola.com/search/?f=rss&t=article&c=news&l=25&s=start_time&sd=desc" },
    { name: "Louisiana Illuminator", rssUrl: "https://lailluminator.com/feed/" },
    { name: "The Advocate", rssUrl: "https://www.theadvocate.com/search/?f=rss&t=article&c=news&l=25&s=start_time&sd=desc" },
  ],
  ME: [
    { name: "Portland Press Herald", rssUrl: "https://www.pressherald.com/feed/" },
    { name: "Bangor Daily News", rssUrl: "https://www.bangordailynews.com/feed/" },
    { name: "Maine Morning Star", rssUrl: "https://mainemorningstar.com/feed/" },
  ],
  MD: [
    { name: "Baltimore Banner", rssUrl: "https://www.thebaltimorebanner.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Baltimore Sun", rssUrl: "https://www.baltimoresun.com/feed/" },
    { name: "Maryland Matters", rssUrl: "https://marylandmatters.org/feed/" },
  ],
  MA: [
    { name: "Boston Globe", rssUrl: "https://www.bostonglobe.com/rss/bdc/news" },
    { name: "WBUR", rssUrl: "https://www.wbur.org/feed" },
    { name: "CommonWealth Beacon", rssUrl: "https://commonwealthbeacon.org/feed/" },
    { name: "Boston.com", rssUrl: "https://www.boston.com/tag/local-news/feed/" },
  ],
  MI: [
    { name: "Detroit Free Press", rssUrl: "https://www.freep.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Bridge Michigan", rssUrl: "https://www.bridgemi.com/rss.xml" },
    { name: "Michigan Advance", rssUrl: "https://michiganadvance.com/feed/" },
    { name: "MLive", rssUrl: "https://www.mlive.com/arc/outboundfeeds/rss/?outputType=xml" },
  ],
  MN: [
    { name: "Star Tribune", rssUrl: "https://www.startribune.com/rss/?ns=/news" },
    { name: "MinnPost", rssUrl: "https://www.minnpost.com/feed/" },
    { name: "Sahan Journal", rssUrl: "https://sahanjournal.com/feed/" },
    { name: "MPR News", rssUrl: "https://www.mprnews.org/feed" },
  ],
  MS: [
    { name: "Mississippi Today", rssUrl: "https://mississippitoday.org/feed/" },
    { name: "Clarion Ledger", rssUrl: "https://www.clarionledger.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Magnolia Tribune", rssUrl: "https://magnoliatribune.com/feed/" },
  ],
  MO: [
    { name: "Missouri Independent", rssUrl: "https://missouriindependent.com/feed/" },
    { name: "St. Louis Public Radio", rssUrl: "https://news.stlpublicradio.org/feed" },
    { name: "Missourian", rssUrl: "https://www.columbiamissourian.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
  ],
  MT: [
    { name: "Montana Free Press", rssUrl: "https://montanafreepress.org/feed/" },
    { name: "Daily Montanan", rssUrl: "https://dailymontanan.com/feed/" },
    { name: "Billings Gazette", rssUrl: "https://billingsgazette.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
  ],
  NE: [
    { name: "Nebraska Examiner", rssUrl: "https://nebraskaexaminer.com/feed/" },
    { name: "Omaha World-Herald", rssUrl: "https://omaha.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
    { name: "Flatwater Free Press", rssUrl: "https://flatwaterfreepress.org/feed/" },
  ],
  NV: [
    { name: "Nevada Independent", rssUrl: "https://thenevadaindependent.com/feed" },
    { name: "Las Vegas Sun", rssUrl: "https://lasvegassun.com/feeds/headlines/news/" },
    { name: "Nevada Current", rssUrl: "https://nevadacurrent.com/feed/" },
  ],
  NH: [
    { name: "NH Bulletin", rssUrl: "https://newhampshirebulletin.com/feed/" },
    { name: "Concord Monitor", rssUrl: "https://www.concordmonitor.com/feed/RSS" },
    { name: "NHPR", rssUrl: "https://www.nhpr.org/feed" },
  ],
  NJ: [
    { name: "NJ Monitor", rssUrl: "https://newjerseymonitor.com/feed/" },
    { name: "NJ Spotlight News", rssUrl: "https://www.njspotlightnews.org/feed/" },
    { name: "NJ.com", rssUrl: "https://www.nj.com/arc/outboundfeeds/rss/?outputType=xml" },
  ],
  NM: [
    { name: "Source NM", rssUrl: "https://sourcenm.com/feed/" },
    { name: "Santa Fe New Mexican", rssUrl: "https://www.santafenewmexican.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
    { name: "Albuquerque Journal", rssUrl: "https://www.abqjournal.com/feed" },
  ],
  NY: [
    { name: "THE CITY NYC", rssUrl: "https://www.thecity.nyc/rss/" },
    { name: "Gothamist", rssUrl: "https://gothamist.com/feed" },
    { name: "City & State NY", rssUrl: "https://www.cityandstateny.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "New York Focus", rssUrl: "https://nysfocus.com/feed" },
    { name: "Spectrum News NY1", rssUrl: "https://www.ny1.com/nyc/all-boroughs/news.rss" },
  ],
  NC: [
    { name: "News & Observer", rssUrl: "https://www.newsobserver.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
    { name: "NC Newsline", rssUrl: "https://ncnewsline.com/feed/" },
    { name: "Charlotte Observer", rssUrl: "https://www.charlotteobserver.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
    { name: "WUNC", rssUrl: "https://www.wunc.org/feed" },
  ],
  ND: [
    { name: "North Dakota Monitor", rssUrl: "https://northdakotamonitor.com/feed/" },
    { name: "Bismarck Tribune", rssUrl: "https://bismarcktribune.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
    { name: "Forum of Fargo", rssUrl: "https://www.inforum.com/index.rss" },
  ],
  OH: [
    { name: "Cleveland.com", rssUrl: "https://www.cleveland.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Ohio Capital Journal", rssUrl: "https://ohiocapitaljournal.com/feed/" },
    { name: "Cincinnati Enquirer", rssUrl: "https://www.cincinnati.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Signal Cleveland", rssUrl: "https://signalcleveland.org/feed/" },
  ],
  OK: [
    { name: "Oklahoma Voice", rssUrl: "https://oklahomavoice.com/feed/" },
    { name: "The Oklahoman", rssUrl: "https://www.oklahoman.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Tulsa World", rssUrl: "https://tulsaworld.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
  ],
  OR: [
    { name: "Oregon Capital Chronicle", rssUrl: "https://oregoncapitalchronicle.com/feed/" },
    { name: "OPB", rssUrl: "https://www.opb.org/feed/" },
    { name: "Willamette Week", rssUrl: "https://www.wweek.com/feed/" },
    { name: "Portland Mercury", rssUrl: "https://www.portlandmercury.com/Rss.xml" },
  ],
  PA: [
    { name: "Philadelphia Inquirer", rssUrl: "https://www.inquirer.com/arc/outboundfeeds/rss/category/news/?outputType=xml" },
    { name: "PA Capital-Star", rssUrl: "https://penncapital-star.com/feed/" },
    { name: "Spotlight PA", rssUrl: "https://www.spotlightpa.org/feeds/articles.xml" },
    { name: "PublicSource", rssUrl: "https://www.publicsource.org/feed/" },
  ],
  RI: [
    { name: "Rhode Island Current", rssUrl: "https://rhodeislandcurrent.com/feed/" },
    { name: "Providence Journal", rssUrl: "https://www.providencejournal.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Boston Globe — RI", rssUrl: "https://www.bostonglobe.com/rss/bdc/rhode-island" },
  ],
  SC: [
    { name: "SC Daily Gazette", rssUrl: "https://scdailygazette.com/feed/" },
    { name: "Post and Courier", rssUrl: "https://www.postandcourier.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
    { name: "The State (SC)", rssUrl: "https://www.thestate.com/news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true" },
  ],
  SD: [
    { name: "SD Searchlight", rssUrl: "https://southdakotasearchlight.com/feed/" },
    { name: "Argus Leader", rssUrl: "https://www.argusleader.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "SDPB", rssUrl: "https://www.sdpb.org/feed/" },
  ],
  TN: [
    { name: "Tennessee Lookout", rssUrl: "https://tennesseelookout.com/feed/" },
    { name: "Tennessean", rssUrl: "https://www.tennessean.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "MLK50", rssUrl: "https://mlk50.com/feed/" },
    { name: "Daily Memphian", rssUrl: "https://dailymemphian.com/feed" },
  ],
  TX: [
    { name: "Texas Tribune", rssUrl: "https://www.texastribune.org/feeds/" },
    { name: "Houston Chronicle", rssUrl: "https://www.houstonchronicle.com/rss/feed/Houston-Chronicle-Local-News-3.php" },
    { name: "Dallas Morning News", rssUrl: "https://www.dallasnews.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Austin American-Statesman", rssUrl: "https://www.statesman.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "San Antonio Report", rssUrl: "https://sanantonioreport.org/feed/" },
  ],
  UT: [
    { name: "Utah News Dispatch", rssUrl: "https://utahnewsdispatch.com/feed/" },
    { name: "Salt Lake Tribune", rssUrl: "https://www.sltrib.com/feed/" },
    { name: "KUER", rssUrl: "https://www.kuer.org/feed" },
  ],
  VT: [
    { name: "VTDigger", rssUrl: "https://vtdigger.org/feed/" },
    { name: "Seven Days", rssUrl: "https://www.sevendaysvt.com/RSSFeeds.xml" },
    { name: "Vermont Public", rssUrl: "https://www.vermontpublic.org/feed" },
  ],
  VA: [
    { name: "Virginia Mercury", rssUrl: "https://virginiamercury.com/feed/" },
    { name: "Richmond Times-Dispatch", rssUrl: "https://richmond.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
    { name: "Cardinal News", rssUrl: "https://cardinalnews.org/feed/" },
    { name: "VPM", rssUrl: "https://www.vpm.org/feed/" },
  ],
  WA: [
    { name: "Seattle Times", rssUrl: "https://www.seattletimes.com/feed/" },
    { name: "Washington State Standard", rssUrl: "https://washingtonstatestandard.com/feed/" },
    { name: "Crosscut", rssUrl: "https://crosscut.com/feeds/all.rss" },
    { name: "South Seattle Emerald", rssUrl: "https://southseattleemerald.com/feed" },
  ],
  WV: [
    { name: "Mountain State Spotlight", rssUrl: "https://mountainstatespotlight.org/feed/" },
    { name: "West Virginia Watch", rssUrl: "https://westvirginiawatch.com/feed/" },
    { name: "WV Public Broadcasting", rssUrl: "https://wvpublic.org/feed/" },
  ],
  WI: [
    { name: "Milwaukee Journal Sentinel", rssUrl: "https://www.jsonline.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "Wisconsin Watch", rssUrl: "https://wisconsinwatch.org/feed/" },
    { name: "Wisconsin Examiner", rssUrl: "https://wisconsinexaminer.com/feed/" },
    { name: "Urban Milwaukee", rssUrl: "https://urbanmilwaukee.com/feed/" },
  ],
  WY: [
    { name: "WyoFile", rssUrl: "https://wyofile.com/feed/" },
    { name: "Cowboy State Daily", rssUrl: "https://cowboystatedaily.com/feed/" },
    { name: "Casper Star-Tribune", rssUrl: "https://trib.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
  ],
  DC: [
    { name: "DCist", rssUrl: "https://dcist.com/feed/" },
    { name: "Washington City Paper", rssUrl: "https://washingtoncitypaper.com/feed/" },
    { name: "DC News Now", rssUrl: "https://www.dcnewsnow.com/feed/" },
    { name: "The 51st", rssUrl: "https://the51st.beehiiv.com/feed" },
  ],
};

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

    // Lightweight read-only action: return the configured sources for a state across all scopes.
    // Each entry includes its scope so the admin UI can filter by scope (local / state / national / international).
    if (body.action === "list_local_sources") {
      const stateFilter: string | null = typeof body.state === "string" && body.state.trim()
        ? body.state.trim().toUpperCase()
        : null;
      type SourceEntry = { name: string; rssUrl: string; scope: string; state?: string };
      const allScoped: SourceEntry[] = [];
      for (const [scopeKey, list] of Object.entries(SOURCES)) {
        for (const s of (list as SourceEntry[])) {
          allScoped.push({ ...s, scope: s.scope || scopeKey });
        }
      }
      const filtered = stateFilter
        ? allScoped.filter((s) => (s.state || "").toUpperCase() === stateFilter)
        : (SOURCES.local as SourceEntry[]);
      return new Response(
        JSON.stringify({
          state: stateFilter,
          count: filtered.length,
          sources: filtered.map((s) => ({
            name: s.name,
            rssUrl: s.rssUrl,
            state: s.state ?? null,
            scope: s.scope,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Probe a single state's local sources and return per-source health.
    // Probe a single RSS source on demand (used by the per-row "Refresh" button).
    if (body.action === "probe_one_source") {
      const url: string = typeof body.url === "string" ? body.url.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) {
        return new Response(JSON.stringify({ error: "invalid url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only probe URLs that exist in our configured catalog (prevents SSRF abuse)
      const allScoped: Array<{ name: string; rssUrl: string; state?: string; scope?: string }> = [];
      for (const [scopeKey, list] of Object.entries(SOURCES)) {
        for (const s of (list as Array<{ name: string; rssUrl: string; state?: string; scope?: string }>)) {
          allScoped.push({ ...s, scope: s.scope || scopeKey });
        }
      }
      const match = allScoped.find((s) => s.rssUrl === url);
      if (!match) {
        return new Response(JSON.stringify({ error: "url not in source catalog" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const start = Date.now();
      let result: Record<string, unknown>;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(match.rssUrl, {
          signal: ctrl.signal,
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OppoDB-Audit/1.0)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
          },
        });
        clearTimeout(timer);
        const ms = Date.now() - start;
        if (!res.ok) {
          result = { ok: false, status: res.status, ms, items: 0, error: `HTTP ${res.status}`, lastItemAt: null };
        } else {
          const text = await res.text();
          const itemMatches = text.match(/<(item|entry)\b/gi);
          const items = itemMatches ? itemMatches.length : 0;
          let lastItemAt: string | null = null;
          const dateMatches = [
            ...text.matchAll(/<pubDate[^>]*>([^<]+)<\/pubDate>/gi),
            ...text.matchAll(/<updated[^>]*>([^<]+)<\/updated>/gi),
            ...text.matchAll(/<published[^>]*>([^<]+)<\/published>/gi),
            ...text.matchAll(/<dc:date[^>]*>([^<]+)<\/dc:date>/gi),
          ];
          let maxTs = 0;
          for (const m of dateMatches) {
            const t = Date.parse((m[1] || "").trim());
            if (Number.isFinite(t) && t > maxTs) maxTs = t;
          }
          if (maxTs > 0) lastItemAt = new Date(maxTs).toISOString();
          result = items === 0
            ? { ok: false, status: res.status, ms, items, error: "No <item>/<entry> elements", lastItemAt }
            : { ok: true, status: res.status, ms, items, error: null, lastItemAt };
        }
      } catch (e) {
        const ms = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        result = { ok: false, status: 0, ms, items: 0, error: msg.slice(0, 200), lastItemAt: null };
      }
      return new Response(
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          source: {
            name: match.name,
            rssUrl: match.rssUrl,
            state: (match.state || "").toUpperCase() || null,
            scope: match.scope || "local",
            ...result,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "probe_local_sources") {
      const stateFilter: string | null = typeof body.state === "string" && body.state.trim()
        ? body.state.trim().toUpperCase()
        : null;
      const localSources = (SOURCES.local || []) as Array<{ name: string; rssUrl: string; scope: string; state?: string }>;
      const targets = stateFilter
        ? localSources.filter((s) => (s.state || "").toUpperCase() === stateFilter)
        : localSources.filter((s) => !!s.state);

      const probeOne = async (s: { name: string; rssUrl: string; state?: string }) => {
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          const res = await fetch(s.rssUrl, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; OppoDB-Audit/1.0)",
              "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
            },
          });
          clearTimeout(timer);
          const ms = Date.now() - start;
          if (!res.ok) {
            return { ok: false, status: res.status, ms, items: 0, error: `HTTP ${res.status}` };
          }
          const text = await res.text();
          const itemMatches = text.match(/<(item|entry)\b/gi);
          const items = itemMatches ? itemMatches.length : 0;
          if (items === 0) {
            return { ok: false, status: res.status, ms, items, error: "No <item>/<entry> elements", lastItemAt: null as string | null };
          }
          // Extract the most recent publish timestamp from <pubDate>, <updated>, or <published>
          let lastItemAt: string | null = null;
          const dateMatches = [
            ...text.matchAll(/<pubDate[^>]*>([^<]+)<\/pubDate>/gi),
            ...text.matchAll(/<updated[^>]*>([^<]+)<\/updated>/gi),
            ...text.matchAll(/<published[^>]*>([^<]+)<\/published>/gi),
            ...text.matchAll(/<dc:date[^>]*>([^<]+)<\/dc:date>/gi),
          ];
          let maxTs = 0;
          for (const m of dateMatches) {
            const t = Date.parse((m[1] || "").trim());
            if (Number.isFinite(t) && t > maxTs) maxTs = t;
          }
          if (maxTs > 0) lastItemAt = new Date(maxTs).toISOString();
          return { ok: true, status: res.status, ms, items, error: null as string | null, lastItemAt };
        } catch (e) {
          const ms = Date.now() - start;
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, status: 0, ms, items: 0, error: msg.slice(0, 200), lastItemAt: null as string | null };
        }
      };

      const results: Array<any> = [];
      const BATCH = 8;
      for (let i = 0; i < targets.length; i += BATCH) {
        const slice = targets.slice(i, i + BATCH);
        const out = await Promise.all(slice.map(async (s) => {
          const r = await probeOne(s);
          return {
            name: s.name,
            rssUrl: s.rssUrl,
            state: (s.state || "").toUpperCase() || null,
            ...r,
          };
        }));
        results.push(...out);
      }

      return new Response(
        JSON.stringify({
          state: stateFilter,
          checkedAt: new Date().toISOString(),
          count: results.length,
          healthy: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          sources: results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Audit: probe every local source and report per-state coverage vs a min threshold
    if (body.action === "audit_local_feeds") {
      const minPerState: number = Number.isFinite(body.minPerState) && body.minPerState > 0
        ? Math.min(20, Math.floor(body.minPerState))
        : 2;
      const localSources = (SOURCES.local || []) as Array<{ name: string; rssUrl: string; scope: string; state?: string }>;
      // Only probe sources tagged to a state (DC included), skip national/cross-cutting
      const stateSources = localSources.filter((s) => !!s.state);

      const probe = async (s: { name: string; rssUrl: string; state?: string }) => {
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          const res = await fetch(s.rssUrl, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; OppoDB-Audit/1.0)",
              "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
            },
          });
          clearTimeout(timer);
          const ms = Date.now() - start;
          if (!res.ok) {
            return { ok: false, status: res.status, ms, items: 0, error: `HTTP ${res.status}` };
          }
          const text = await res.text();
          const itemMatches = text.match(/<(item|entry)\b/gi);
          const items = itemMatches ? itemMatches.length : 0;
          if (items === 0) {
            return { ok: false, status: res.status, ms, items, error: "No <item>/<entry> elements" };
          }
          return { ok: true, status: res.status, ms, items, error: null as string | null };
        } catch (e) {
          const ms = Date.now() - start;
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, status: 0, ms, items: 0, error: msg.slice(0, 200) };
        }
      };

      // Probe in batches of 12 to avoid overwhelming
      const results: Array<{
        name: string; rssUrl: string; state: string;
        ok: boolean; status: number; ms: number; items: number; error: string | null;
      }> = [];
      const BATCH = 12;
      for (let i = 0; i < stateSources.length; i += BATCH) {
        const slice = stateSources.slice(i, i + BATCH);
        const out = await Promise.all(slice.map(async (s) => {
          const r = await probe(s);
          return { name: s.name, rssUrl: s.rssUrl, state: (s.state || "").toUpperCase(), ...r };
        }));
        results.push(...out);
      }

      // Aggregate per state
      const perState = new Map<string, {
        configured: number; healthy: number; failed: number;
        failedSources: Array<{ name: string; rssUrl: string; error: string | null; status: number }>;
      }>();
      for (const r of results) {
        const k = r.state;
        if (!perState.has(k)) {
          perState.set(k, { configured: 0, healthy: 0, failed: 0, failedSources: [] });
        }
        const entry = perState.get(k)!;
        entry.configured += 1;
        if (r.ok) entry.healthy += 1;
        else {
          entry.failed += 1;
          entry.failedSources.push({ name: r.name, rssUrl: r.rssUrl, error: r.error, status: r.status });
        }
      }

      const states = Array.from(perState.entries())
        .map(([state, v]) => ({
          state,
          configured: v.configured,
          healthy: v.healthy,
          failed: v.failed,
          meetsThreshold: v.healthy >= minPerState,
          failedSources: v.failedSources,
        }))
        .sort((a, b) => a.state.localeCompare(b.state));

      const totalConfigured = stateSources.length;
      const totalHealthy = results.filter((r) => r.ok).length;
      const totalFailed = results.length - totalHealthy;
      const statesBelowThreshold = states.filter((s) => !s.meetsThreshold).map((s) => s.state);

      return new Response(
        JSON.stringify({
          minPerState,
          generatedAt: new Date().toISOString(),
          summary: {
            totalConfigured,
            totalHealthy,
            totalFailed,
            statesAudited: states.length,
            statesBelowThreshold: statesBelowThreshold.length,
            statesBelowThresholdList: statesBelowThreshold,
          },
          states,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Top-up: for each low-coverage state, probe vetted reserve feeds and return
    // the next-best healthy candidates that aren't already configured.
    if (body.action === "top_up_local_sources") {
      const minPerState: number = Number.isFinite(body.minPerState) && body.minPerState > 0
        ? Math.min(20, Math.floor(body.minPerState))
        : 5;
      const perStateCap: number = Number.isFinite(body.perStateCap) && body.perStateCap > 0
        ? Math.min(10, Math.floor(body.perStateCap))
        : 3;
      const onlyStates: string[] | null = Array.isArray(body.states) && body.states.length > 0
        ? body.states.map((s: unknown) => String(s).toUpperCase())
        : null;

      const localSources = (SOURCES.local || []) as Array<{ name: string; rssUrl: string; scope: string; state?: string }>;
      const configuredByState = new Map<string, Set<string>>();
      // Global dedup set: every RSS URL already configured anywhere (any scope, any state).
      // A URL appearing in one state's `local` config (or any other scope) must NOT be re-added
      // to a different state during top-up.
      const globallyConfiguredUrls = new Set<string>();
      const normalizeUrl = (u: string): string => {
        try {
          const url = new URL(u);
          url.hash = "";
          // Lowercase host, strip default trailing slash for empty paths
          url.hostname = url.hostname.toLowerCase();
          if (url.pathname === "/") url.pathname = "";
          return url.toString().replace(/\/$/, "");
        } catch {
          return u.trim().toLowerCase();
        }
      };
      for (const scopeKey of Object.keys(SOURCES)) {
        for (const s of SOURCES[scopeKey] ?? []) {
          globallyConfiguredUrls.add(normalizeUrl(s.rssUrl));
        }
      }
      for (const s of localSources) {
        const st = (s.state || "").toUpperCase();
        if (!st) continue;
        if (!configuredByState.has(st)) configuredByState.set(st, new Set());
        configuredByState.get(st)!.add(normalizeUrl(s.rssUrl));
      }

      // Determine which states need top-up
      const targetStates = (onlyStates ?? Object.keys(LOCAL_RESERVE)).filter((st) => {
        const have = configuredByState.get(st)?.size ?? 0;
        return have < minPerState;
      });

      const probe = async (s: { name: string; rssUrl: string; state: string }) => {
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          const res = await fetch(s.rssUrl, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; OppoDB-Audit/1.0)",
              "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
            },
          });
          clearTimeout(timer);
          const ms = Date.now() - start;
          if (!res.ok) return { ok: false, status: res.status, ms, items: 0, error: `HTTP ${res.status}` };
          const text = await res.text();
          const itemMatches = text.match(/<(item|entry)\b/gi);
          const items = itemMatches ? itemMatches.length : 0;
          if (items === 0) return { ok: false, status: res.status, ms, items, error: "No <item>/<entry> elements" };
          return { ok: true, status: res.status, ms, items, error: null as string | null };
        } catch (e) {
          const ms = Date.now() - start;
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, status: 0, ms, items: 0, error: msg.slice(0, 200) };
        }
      };

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
          },
          perState: summaryByState,
          additions,
          skipped,
          note: "Healthy candidates were probed live from a vetted reserve pool. To persist them, add the entries under additions to SOURCES.local in supabase/functions/intel-briefing/index.ts.",
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
        `Dedup: ${allItems.length} fetched → ${deduped.length} unique in-batch → ${filtered.length} new (skipped ${skippedDbDuplicate} already in DB)`,
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
