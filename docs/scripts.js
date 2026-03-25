// Win98 Help Application Scripts

const toc = [
  { title: 'Home', file: 'Home.md' },
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', file: '01-Overview.md' },
      { title: 'Candidate Profiles', file: '02-Candidate-Profiles.md' },
      { title: 'District Intelligence', file: '03-District-Intelligence.md' }
    ]
  },
  {
    title: 'Data & Analytics',
    items: [
      { title: 'Polling Data', file: '04-Polling-Data.md' },
      { title: 'Campaign Finance', file: '05-Campaign-Finance.md' },
      { title: 'State Legislative Districts', file: '06-State-Legislative-Districts.md' }
    ]
  },
  {
    title: 'Features',
    items: [
      { title: 'Additional Features', file: '07-Additional-Features.md' },
      { title: 'Authentication & User Management', file: '08-Authentication-and-User-Management.md' },
      { title: 'API Access', file: '09-API-Access.md' }
    ]
  },
  {
    title: 'Reference',
    items: [
      { title: 'UI Design System', file: '10-UI-Design-System.md' },
      { title: 'Data Sync and Sources', file: '11-Data-Sync-and-Sources.md' },
      { title: 'Cook Ratings and Forecasting', file: '12-Cook-Ratings-and-Forecasting.md' },
      { title: 'Admin Panel', file: '13-Admin-Panel.md' }
    ]
  }
];

const wikiContent = {
"Home.md": "<h1>Welcome to OppoDB Help</h1><p>OppoDB is a comprehensive political intelligence database built for political campaigns, consultants, and journalists.</p><h2>Getting Started</h2><p>Use the <strong>Contents</strong> tab on the left to browse topics. Click any topic to view its documentation.</p>",
"01-Overview.md": "<h1>Overview</h1><p>OppoDB is a comprehensive opposition research platform built for political campaigns, consultants, and journalists. It provides a unified database of candidate profiles, district intelligence, polling data, campaign finance records, and narrative research.</p><h2>Tech Stack</h2><ul><li><strong>Frontend</strong>: React 18 + TypeScript + Vite</li><li><strong>Database</strong>: Supabase (PostgreSQL + Auth + Realtime)</li><li><strong>Styling</strong>: Tailwind CSS + shadcn/ui</li><li><strong>Charts</strong>: Recharts</li><li><strong>AI Integration</strong>: Lovable</li></ul><h2>UI Theme</h2><p>The application wraps its modern functionality in a nostalgic Windows 98 / AOL desktop environment.</p>",
"02-Candidate-Profiles.md": "<h1>Candidate Profiles</h1><p>Candidate Profiles form the core content of OppoDB. Each profile contains opposition research on a political candidate.</p><h2>Supported Candidate Types</h2><ul><li><strong>house</strong> - U.S. House of Representatives</li><li><strong>senate</strong> - U.S. Senate candidates</li><li><strong>governor</strong> - Gubernatorial candidates</li><li><strong>state</strong> - State-level candidates</li></ul><h2>Components</h2><ul><li>Basic Profile Header with PDF Export</li><li>Issue Research Subpages</li><li>Candidate Polling Panel</li><li>Legislative Voting Record (LegiScan API)</li><li>Campaign Finance Panel (FEC data)</li><li>Version History (GitHub commits)</li></ul>",
"03-District-Intelligence.md": "<h1>District Intelligence</h1><p>District Intelligence provides comprehensive data on all 435 U.S. Congressional Districts combining demographic data, partisan lean metrics, election history, and polling data.</p><h2>Data Points</h2><ul><li>Population, Median Income, Median Age</li><li>Racial and Ethnic Demographics</li><li>Economic Indicators</li><li>Cook Rating and PVI</li></ul><h2>Features</h2><ul><li>Interactive SVG District Map</li><li>District Compare Mode</li><li>Cook Rating History</li><li>Election History</li></ul>",
"04-Polling-Data.md": "<h1>Polling Data</h1><p>OppoDB maintains a comprehensive polling database covering presidential approval, generic congressional ballot, issue polling, and candidate favorability.</p><h2>Poll Types</h2><ul><li><code>approval</code> - Presidential approval</li><li><code>favorability</code> - Candidate favorability</li><li><code>generic_ballot</code> - Generic D vs R ballot</li><li><code>head_to_head</code> - Two-candidate matchup</li></ul><h2>Data Sources</h2><p>Polling data sourced from 538, RCP, Trafalgar, Quinnipiac, Emerson, and other major pollsters.</p>",
"05-Campaign-Finance.md": "<h1>Campaign Finance</h1><p>Campaign Finance tracks FEC filings for federal candidates and state-level finance data from FollowTheMoney.org.</p><h2>Federal Finance Data</h2><ul><li>Total Raised, Total Spent, Cash on Hand</li><li>Individual vs PAC vs Self-Funding</li><li>Small Dollar vs Large Donor %</li><li>Top Industries and Contributors</li></ul><h2>Components</h2><ul><li>CampaignFinancePanel - Candidate-level view</li><li>AreaFinancePanel - District-level view</li><li>StateFinancePanel - State-level overview</li></ul>",
"06-State-Legislative-Districts.md": "<h1>State Legislative Districts</h1><p>State Legislative Districts provides intelligence on state legislature races across all 50 states.</p><h2>Coverage</h2><p>Both House and Senate chambers for all 50 U.S. states.</p><h2>Data Includes</h2><ul><li>District Demographics</li><li>Economic Indicators</li><li>Housing Data</li><li>Voter Registration</li><li>Historical Election Results</li></ul>",
"07-Additional-Features.md": "<h1>Additional Features</h1><h2>MAGA Files</h2><p>Documentation of Trump administration appointees and their backgrounds.</p><h2>Local Impact Reports</h2><p>State-level reports on local impact of political decisions.</p><h2>Narrative Reports</h2><p>Thematic narrative reports for long-form research.</p><h2>Other Sections</h2><ul><li>Voter Data - Registration statistics</li><li>Live Elections - Real-time results</li><li>Legislation - Bill tracking</li><li>Dashboard - Overview landing page</li></ul>",
"08-Authentication-and-User-Management.md": "<h1>Authentication & User Management</h1><p>OppoDB implements full authentication and role-based access control on Supabase Auth.</p><h2>User Roles</h2><ul><li><strong>user</strong> - Read-only access</li><li><strong>premium</strong> - Read + API keys</li><li><strong>moderator</strong> - Content management</li><li><strong>admin</strong> - Full system access</li></ul><h2>Auth Features</h2><ul><li>Email/password authentication</li><li>Invite-based signup</li><li>Password reset</li><li>AOL dial-up animation on load</li></ul>",
"09-API-Access.md": "<h1>API Access</h1><p>OppoDB provides programmatic access to all data through a REST API.</p><h2>Authentication</h2><p>API keys generated per user in the ApiPage. Keys are prefixed with <code>oppodb_</code>.</p><h2>Endpoints</h2><ul><li><code>GET /api/candidates</code> - List all candidates</li><li><code>GET /api/districts</code> - List all districts</li><li><code>GET /api/polling</code> - Polling data</li><li><code>GET /api/finance</code> - Campaign finance</li></ul><h2>Rate Limits</h2><p>Premium users get 1000 requests/hour. Standard users get 100 requests/hour.</p>",
"10-UI-Design-System.md": "<h1>UI Design System</h1><p>OppoDB features a nostalgic Windows 98 / AOL desktop aesthetic.</p><h2>Win98 Components</h2><ul><li>Win98Window - Draggable window chrome</li><li>Win98Taskbar - Classic taskbar with Start button</li><li>Win98Button, Win98Input, Win98Select</li></ul><h2>AOL Components</h2><ul><li>AOLToolbar - Browser navigation</li><li>AOLBuddyList - AIM-style sidebar</li><li>AOLMailWindow - Mail simulation</li></ul><h2>Design Philosophy</h2><p>The Win98/AOL aesthetic makes heavy political research data feel approachable and distinctive.</p>",
"11-Data-Sync-and-Sources.md": "<h1>Data Sync and Sources</h1><h2>GitHub Content Sync</h2><p>Candidate profiles are synced from GitHub markdown files. Each candidate has a main profile and optional issue subpages.</p><h2>Census Data Sync</h2><p>District demographics synced from U.S. Census Bureau ACS 5-Year Estimates.</p><h2>Election Results</h2><p>Results synced from OpenElections API across all 50 states.</p><h2>Security</h2><p>JWT verification enabled on all edge functions. RLS policies on all Supabase tables.</p>",
"12-Cook-Ratings-and-Forecasting.md": "<h1>Cook Ratings & Forecasting</h1><p>OppoDB integrates Cook Political Report ratings and PVI data.</p><h2>Rating Scale</h2><ul><li>Solid D, Likely D, Lean D</li><li>Tossup</li><li>Lean R, Likely R, Solid R</li></ul><h2>PVI (Partisan Voting Index)</h2><p>Measures district performance vs national average. Range: D+10+ to R+10+.</p><h2>Forecast Models</h2><p>Comparisons with 538, Cook, Inside Elections, and Sabatos Crystal Ball.</p>",
"13-Admin-Panel.md": "<h1>Admin Panel</h1><p>The Admin Panel provides administrative oversight for OppoDB.</p><h2>Admin Tabs</h2><ul><li>Users - User lifecycle management</li><li>Role Groups - Team-based categorization</li><li>Access Control - Fine-grained permissions</li><li>Candidates - Content management</li><li>MAGA Files - Appointee documentation</li><li>Local Impact - State reports</li><li>Narratives - Thematic reports</li></ul><h2>Access Control</h2><p>Only admin and moderator roles can access. Regular users see Access Denied.</p>"
};

let currentPage = "Home.md";
let history = [];
let historyIndex = -1;

function init() {
  renderTree();
  loadContent("Home.md", "Home");
  setupEventListeners();
}

function renderTree() {
  const treeView = document.getElementById("tree-view");
  treeView.innerHTML = "";

  toc.forEach((section) => {
    if (section.items) {
      const sectionEl = document.createElement("div");
      sectionEl.className = "tree-section";
      sectionEl.textContent = section.title;
      treeView.appendChild(sectionEl);

      const childrenEl = document.createElement("div");
      childrenEl.className = "tree-children";

      section.items.forEach((item) => {
        const itemEl = document.createElement("div");
        itemEl.className = "tree-item page";
        itemEl.textContent = item.title;
        itemEl.dataset.file = item.file;
        itemEl.addEventListener("click", () => {
          selectTreeItem(itemEl);
          loadContent(item.file, item.title);
        });
        childrenEl.appendChild(itemEl);
      });

      treeView.appendChild(childrenEl);
    } else {
      const itemEl = document.createElement("div");
      itemEl.className = "tree-item page";
      itemEl.textContent = section.title;
      itemEl.dataset.file = section.file;
      itemEl.addEventListener("click", () => {
        selectTreeItem(itemEl);
        loadContent(section.file, section.title);
      });
      treeView.appendChild(itemEl);
    }
  });
}

function selectTreeItem(el) {
  document.querySelectorAll(".tree-item.selected").forEach((item) => {
    item.classList.remove("selected");
  });
  el.classList.add("selected");
}

function loadContent(filename, title) {
  currentPage = filename;
  updateBreadcrumb(title);
  updateStatus("Loading " + title + "...");

  const content = wikiContent[filename] || "<h1>" + title + "</h1><p>Content coming soon.</p>";
  document.getElementById("topic-content").innerHTML = content;
  updateStatus(title + " - 1 of " + countPages());

  addToHistory(filename, title);
}

function updateBreadcrumb(title) {
  document.getElementById("breadcrumb").textContent = title;
}

function updateStatus(text) {
  document.getElementById("status-text").textContent = text;
}

function countPages() {
  let count = 1;
  toc.forEach((section) => {
    if (section.items) count += section.items.length;
  });
  return count;
}

function addToHistory(filename, title) {
  history = history.slice(0, historyIndex + 1);
  history.push({ filename, title });
  historyIndex = history.length - 1;
}

function goBack() {
  if (historyIndex > 0) {
    historyIndex--;
    const item = history[historyIndex];
    document.getElementById("topic-content").innerHTML = wikiContent[item.filename] || "<h1>" + item.title + "</h1>";
    updateBreadcrumb(item.title);
  }
}

function goForward() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const item = history[historyIndex];
    document.getElementById("topic-content").innerHTML = wikiContent[item.filename] || "<h1>" + item.title + "</h1>";
    updateBreadcrumb(item.title);
  }
}

function setupEventListeners() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  document.querySelector('.tb-btn[title="Back"]').addEventListener("click", goBack);
  document.querySelector('.tb-btn[title="Forward"]').addEventListener("click", goForward);

  document.querySelector('.title-btn[aria-label="Help"]').addEventListener("click", () => {
    document.getElementById("about-dialog").style.display = "block";
  });

  window.closeDialog = function () {
    document.getElementById("about-dialog").style.display = "none";
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "F1") {
      e.preventDefault();
      document.getElementById("about-dialog").style.display = "block";
    }
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      document.querySelector('.tab[data-tab="search"]').click();
      document.getElementById("search-input").focus();
    }
  });

  document.getElementById("search-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSearch(e.target.value);
    }
  });
}

function performSearch(query) {
  const resultsEl = document.getElementById("search-results");
  if (!query.trim()) {
    resultsEl.innerHTML = '<p class="note">Enter keywords to search.</p>';
    return;
  }

  const results = [];
  const allItems = [
    { title: "Home", file: "Home.md" },
    ...toc.flatMap((s) => s.items || [])
  ];

  allItems.forEach((item) => {
    const content = (wikiContent[item.file] || "").toLowerCase();
    if (item.title.toLowerCase().includes(query.toLowerCase()) ||
        content.includes(query.toLowerCase())) {
      results.push(item);
    }
  });

  if (results.length === 0) {
    resultsEl.innerHTML = `<p class="note">No results found for "${query}"</p>`;
    return;
  }

  resultsEl.innerHTML = results.map((r) => 
    `<div class="search-result-item" onclick="selectTreeItem(document.querySelector('[data-file=\\'${r.file}\\']')); loadContent('${r.file}', '${r.title}')"><strong>${r.title}</strong></div>`
  ).join("");
}

document.addEventListener("DOMContentLoaded", init);
