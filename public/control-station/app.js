const STORAGE_KEY = "refind-control-station-demo-state-v4";

const todayWeekOffset = 0;
let visibleWeekOffset = 0;
let selectedCampaignId = null;

const defaultCampaigns = [
  {
    id: "2026-06-15-01",
    product: "ReFind AirTag Holder & Keyring",
    status: "approved",
    lane: "Relatable problem",
    trend: "Does this actually deserve the hype?",
    hookTitle: "The key check before you leave",
    concept: "Static frame: keys on an entryway table beside the tracker holder, with a hand reaching in from the edge as if leaving in a hurry.",
    caption: "The point is not hype. It is the moment when your keys are somehow missing at the exact moment you need to leave.",
    fitScore: 93,
    assetStatus: "generated",
    assetType: "static image",
    productTone: "#77a6be",
    image: "assets/ref-keyring.jpg",
  },
  {
    id: "2026-06-22-01",
    product: "ReFind AirTag Bike Bottle Holder",
    status: "approved",
    lane: "Useful proof",
    trend: "The bike upgrade that hides in plain sight",
    hookTitle: "The bike upgrade that hides in plain sight",
    concept: "Static frame: a locked bike outside with the bottle holder visible on the frame and a phone map check held naturally beside it.",
    caption: "Bike upgrades make the most sense when they still look like they belong on the bike. This one keeps the tracker hidden in the bottle holder.",
    fitScore: 96,
    assetStatus: "generated",
    assetType: "static image",
    productTone: "#e2b029",
    image: "assets/ref-bike-holder.jpg",
  },
  {
    id: "2026-06-22-02",
    product: "ReFind M10 Card Tracker",
    status: "needs_review",
    lane: "Relatable problem",
    trend: "The wallet check before you leave",
    hookTitle: "The wallet check before you leave",
    concept: "Static frame: an open wallet held at the front door, with the slim tracker clearly visible in the card slot and keys blurred on the hall table.",
    caption: "That tiny pause before leaving is usually a wallet check. The M10 Card Tracker makes sense for the one thing that is easy to put down and annoying to search for.",
    fitScore: 91,
    assetStatus: "waiting for approval",
    assetType: "static image",
    productTone: "#82ad8b",
  },
  {
    id: "2026-06-23-01",
    product: "PawView AirTag Pet Collar Holder",
    status: "needs_review",
    lane: "Warm proof",
    trend: "The lead, collar, and keys check",
    hookTitle: "The collar check before the walk",
    concept: "5-second video: collar is clipped before a walk, the tracker holder catches light, and the lead lifts as the owner heads out.",
    caption: "The pre-walk check is collar, lead, keys, then out the door. PawView gives the tracker a proper place on the collar.",
    fitScore: 94,
    assetStatus: "waiting for approval",
    assetType: "short video",
    productTone: "#8a7ac0",
  },
  {
    id: "2026-06-24-01",
    product: "Desk Divider Pro",
    status: "needs_revision",
    lane: "Workspace reset",
    trend: "The five minute desk reset",
    hookTitle: "The desk reset that actually sticks",
    concept: "Static frame: a home desk split into clean work zones, with papers, laptop, and accessories visibly controlled by the divider.",
    caption: "The best desk reset is the one you do not have to keep redoing. Desk Divider Pro gives the messy middle a proper boundary.",
    fitScore: 87,
    assetStatus: "needs revision",
    assetType: "static image",
    productTone: "#d0a157",
  },
  {
    id: "2026-06-29-01",
    product: "Finein Tag Luggage Scale",
    status: "approved",
    lane: "Useful proof",
    trend: "The airport check that saves the repack",
    hookTitle: "The airport check before the counter",
    concept: "Static frame: luggage on a bedroom floor before an airport run, with the scale and tracker tag visible beside the suitcase handle.",
    caption: "The useful bit is knowing before you reach the counter. This keeps the tracker and luggage check in one obvious place.",
    fitScore: 90,
    assetStatus: "generated",
    assetType: "static image",
    productTone: "#b9c7d6",
  },
];

const defaultPosts = [
  post("ig-old-01", "2026-06-15-01", "Instagram", "2026-06-16", "09:16", "posted", "Shop tag + profile link", "https://www.instagram.com/refindcommerce/p/demo-keyring"),
  post("fb-old-01", "2026-06-15-01", "Facebook", "2026-06-16", "09:18", "posted", "Product link in post", "https://www.facebook.com/refindcommerce/posts/demo-keyring"),
  post("pin-old-01", "2026-06-15-01", "Pinterest", "2026-06-16", "12:10", "posted", "Destination URL", "https://www.pinterest.com/pin/demo-keyring"),
  post("thr-old-01", "2026-06-15-01", "Threads", "2026-06-17", "18:40", "posted", "Soft CTA only", "https://www.threads.net/@refindcommerce/post/demo-keyring"),
  post("ig-old-02", "2026-06-15-01", "Instagram", "2026-06-18", "09:16", "failed", "Image crop rejected by channel"),
  post("ig-01", "2026-06-22-01", "Instagram", "2026-06-23", "09:16", "ready_to_post", "Shop tag + profile link"),
  post("fb-01", "2026-06-22-01", "Facebook", "2026-06-23", "09:18", "ready_to_post", "Product link in post"),
  post("pin-01", "2026-06-22-01", "Pinterest", "2026-06-23", "12:10", "ready_to_post", "Destination URL"),
  post("thr-01", "2026-06-22-01", "Threads", "2026-06-23", "18:40", "posted", "Soft CTA only", "https://www.threads.net/@refindcommerce/post/demo-bike-holder"),
  post("tt-01", "2026-06-22-01", "TikTok", "2026-06-23", "19:30", "blocked", "API review pending"),
  post("ig-02", "2026-06-22-02", "Instagram", "2026-06-24", "09:16", "needs_approval", "Shop tag + profile link"),
  post("fb-02", "2026-06-22-02", "Facebook", "2026-06-24", "09:18", "needs_approval", "Product link in post"),
  post("pin-02", "2026-06-22-02", "Pinterest", "2026-06-24", "12:10", "needs_approval", "Destination URL"),
  post("thr-02", "2026-06-22-02", "Threads", "2026-06-24", "18:40", "needs_approval", "Soft CTA only"),
  post("tt-02", "2026-06-22-02", "TikTok", "2026-06-24", "19:30", "blocked", "API review pending"),
  post("ig-03", "2026-06-23-01", "Instagram", "2026-06-26", "09:16", "needs_approval", "Shop tag + profile link"),
  post("fb-03", "2026-06-23-01", "Facebook", "2026-06-26", "09:18", "needs_approval", "Product link in post"),
  post("pin-03", "2026-06-23-01", "Pinterest", "2026-06-26", "12:10", "needs_approval", "Destination URL"),
  post("thr-03", "2026-06-23-01", "Threads", "2026-06-26", "18:40", "needs_approval", "Soft CTA only"),
  post("ig-04", "2026-06-24-01", "Instagram", "2026-06-28", "10:05", "draft", "Waiting for revised creative"),
  post("fb-04", "2026-06-24-01", "Facebook", "2026-06-28", "10:07", "draft", "Waiting for revised creative"),
  post("pin-04", "2026-06-24-01", "Pinterest", "2026-06-28", "13:15", "draft", "Waiting for revised creative"),
  post("thr-04", "2026-06-24-01", "Threads", "2026-06-28", "18:10", "draft", "Waiting for revised creative"),
  post("ig-next-01", "2026-06-29-01", "Instagram", "2026-07-01", "09:16", "ready_to_post", "Shop tag + profile link"),
  post("fb-next-01", "2026-06-29-01", "Facebook", "2026-07-01", "09:18", "ready_to_post", "Product link in post"),
  post("pin-next-01", "2026-06-29-01", "Pinterest", "2026-07-01", "12:10", "ready_to_post", "Destination URL"),
  post("thr-next-01", "2026-06-29-01", "Threads", "2026-07-02", "18:40", "ready_to_post", "Soft CTA only"),
];

function post(id, campaignId, channel, date, time, status, linkMode, publishedUrl = "") {
  return { id, campaignId, channel, date, time, status, linkMode, publishedUrl };
}

let state = loadState();

const viewTitles = {
  overview: "Schedule",
  campaigns: "Campaigns",
  posts: "Channel posts",
  health: "Health and log",
};

const statusLabels = {
  needs_review: "Needs review",
  approved: "Approved",
  needs_revision: "Needs revision",
  needs_approval: "Needs approval",
  ready_to_post: "Ready to post",
  posted: "Posted",
  blocked: "Blocked",
  failed: "Failed",
  draft: "Draft",
};

const compactStatusLabels = {
  needs_approval: "needs approval",
  ready_to_post: "ready",
  posted: "posted",
  blocked: "blocked",
  failed: "failed",
  draft: "draft",
};

const statusPill = {
  needs_review: "amber",
  approved: "green",
  needs_revision: "coral",
  needs_approval: "amber",
  ready_to_post: "blue",
  posted: "green",
  blocked: "coral",
  failed: "coral",
  draft: "grey",
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderAll();
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.campaigns) && Array.isArray(saved.posts)) {
      visibleWeekOffset = Number.isInteger(saved.visibleWeekOffset) ? saved.visibleWeekOffset : 0;
      return saved;
    }
  } catch (error) {
    console.warn("Could not load demo state", error);
  }

  return {
    campaigns: structuredClone(defaultCampaigns),
    posts: structuredClone(defaultPosts),
    visibleWeekOffset: 0,
    audit: [
      "09:16 - Sheet watcher checked campaign queue. No duplicate generation detected.",
      "09:18 - Instagram crop guard passed for ready posts.",
      "09:22 - TikTok remains blocked until API approval is complete.",
      "09:24 - Prototype opened. No Sheet writes are enabled.",
    ],
  };
}

function saveState() {
  state.visibleWeekOffset = visibleWeekOffset;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  document.querySelectorAll("[data-view], [data-view-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view || button.dataset.viewTrigger;
      switchView(nextView);
    });
  });

  document.getElementById("previousWeekButton").addEventListener("click", () => {
    visibleWeekOffset -= 1;
    saveState();
    renderAll();
  });

  document.getElementById("nextWeekButton").addEventListener("click", () => {
    visibleWeekOffset += 1;
    saveState();
    renderAll();
  });

  document.getElementById("thisWeekButton").addEventListener("click", () => {
    visibleWeekOffset = todayWeekOffset;
    saveState();
    renderAll();
  });

  document.getElementById("resetDemoButton").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    visibleWeekOffset = 0;
    selectedCampaignId = null;
    state = loadState();
    closeDrawer();
    renderAll();
    showToast("Demo state reset. The real Sheet was not touched.");
  });

  document.getElementById("closeDrawerButton").addEventListener("click", closeDrawer);
  document.getElementById("detailDrawer").addEventListener("click", (event) => {
    if (event.target.id === "detailDrawer") {
      closeDrawer();
    }
  });

  ["campaignSearch", "campaignStatusFilter", "postChannelFilter", "postStatusFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderAll);
  });
}

function switchView(view) {
  document.getElementById("viewTitle").textContent = viewTitles[view];

  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-visible", panel.id === `${view}View`);
  });

  document.querySelectorAll(".nav-button, .mobile-nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

function renderAll() {
  renderMetrics();
  renderWeekBoard();
  renderCampaignList();
  renderPostGroups();
  renderHealth();
  if (selectedCampaignId) {
    renderDrawer(selectedCampaignId);
  }
}

function renderMetrics() {
  const needsReview = state.campaigns.filter((campaign) => campaign.status === "needs_review").length;
  const postApprovals = state.posts.filter((item) => item.status === "needs_approval").length;
  const issues = issuePosts().length;
  const nextPost = state.posts
    .filter((item) => item.status === "ready_to_post")
    .sort(sortPosts)[0];

  document.getElementById("metricNeedsReview").textContent = needsReview;
  document.getElementById("metricPostApprovals").textContent = postApprovals;
  document.getElementById("metricNextPost").textContent = nextPost ? `${formatShortDate(nextPost.date)} ${nextPost.time}` : "None";
  document.getElementById("metricPostingIssues").textContent = issues;
}

function renderWeekBoard() {
  const dates = weekDates(visibleWeekOffset);
  const firstDate = dates[0];
  const lastDate = dates[6];
  const title = `${formatShortDate(firstDate)} - ${formatShortDate(lastDate)}`;
  document.getElementById("scheduleWindowTitle").textContent = title;
  document.getElementById("planWindowLabel").textContent = `Week of ${formatLongDate(firstDate)}, UK time`;

  document.getElementById("weekBoard").innerHTML = dates
    .map((date) => {
      const dayPosts = state.posts
        .filter((item) => item.date === date)
        .sort(sortPosts);
      const campaignGroups = groupPostsByCampaign(dayPosts);
      const content = dayPosts.length
        ? campaignGroups.map(renderNeutralScheduleCampaign).join("")
        : `<div class="schedule-item empty"><strong>No post planned</strong><span>Open slot for spacing.</span></div>`;
      return `
        <article class="day-column">
          <div class="day-heading"><span>${weekdayName(date)}</span><span>${formatShortDate(date)}</span></div>
          ${content}
        </article>
      `;
    })
    .join("");
}

function renderScheduleCampaign(group) {
  const campaign = campaignById(group.campaignId);
  const earliestPost = group.posts[0];
  const dominantStatus = getGroupStatus(group.posts);
  const statusSummary = summarizeStatuses(group.posts);
  const groupLabel = summarizeGroupState(group.posts);
  const channelSummary = group.posts.map((item) => item.channel).join(", ");
  return `
    <details class="schedule-campaign status-${dominantStatus}">
      <summary>
        <span class="campaign-color" style="background:${campaign.productTone}"></span>
        <span>
          <strong>${earliestPost.time} ${campaign.product}</strong>
          <small>${group.posts.length} posts · ${statusSummary}</small>
        </span>
      </summary>
      <div class="schedule-channel-list">
        <p>${channelSummary}</p>
        ${group.posts.map(renderScheduleChannel).join("")}
        <button class="mini-button" type="button" onclick="openCampaign('${campaign.id}')">Open details</button>
      </div>
    </details>
  `;
}

function renderScheduleChannel(item) {
  return `
    <div class="schedule-channel-row">
      <span><strong>${item.time}</strong> ${item.channel}</span>
      <span class="pill ${statusPill[item.status]}">${statusLabels[item.status]}</span>
    </div>
  `;
}

function renderNeutralScheduleCampaign(group) {
  const campaign = campaignById(group.campaignId);
  const earliestPost = group.posts[0];
  const dominantStatus = getGroupStatus(group.posts);
  const statusSummary = summarizeStatuses(group.posts);
  const groupLabel = summarizeGroupState(group.posts);
  const channelSummary = group.posts.map((item) => item.channel).join(", ");

  return `
    <details class="schedule-campaign">
      <summary>
        <span class="schedule-time">${earliestPost.time}</span>
        <span>
          <strong>${campaign.product}</strong>
          <small>${group.posts.length} posts - ${statusSummary}</small>
        </span>
        <span class="pill ${statusPill[dominantStatus]}">${groupLabel}</span>
      </summary>
      <div class="schedule-channel-list">
        <p>${channelSummary}</p>
        ${group.posts.map(renderNeutralScheduleChannel).join("")}
        <button class="mini-button" type="button" onclick="openCampaign('${campaign.id}')">Open details</button>
      </div>
    </details>
  `;
}

function renderNeutralScheduleChannel(item) {
  const channel = channelClass(item.channel);
  return `
    <div class="schedule-channel-row channel-${channel}">
      <span><i class="channel-marker channel-${channel}"></i><strong>${item.time}</strong> ${item.channel}</span>
      <span class="pill ${statusPill[item.status]}">${statusLabels[item.status]}</span>
    </div>
  `;
}

function renderCampaignList() {
  const search = document.getElementById("campaignSearch").value.trim().toLowerCase();
  const status = document.getElementById("campaignStatusFilter").value;
  const campaigns = state.campaigns.filter((campaign) => {
    const matchesStatus = status === "all" || campaign.status === status;
    const haystack = `${campaign.id} ${campaign.product} ${campaign.trend} ${campaign.caption}`.toLowerCase();
    return matchesStatus && (!search || haystack.includes(search));
  });

  document.getElementById("campaignList").innerHTML = campaigns.map(renderCampaignCard).join("");
}

function renderCampaignCard(campaign) {
  return `
    <article class="campaign-card">
      ${renderCreativePreview(campaign, "campaign-media")}
      <div class="campaign-body">
        <div class="status-line">
          <span class="pill ${statusPill[campaign.status]}">${statusLabels[campaign.status]}</span>
          <span class="pill blue">${campaign.lane}</span>
        </div>
        <h4>${campaign.product}</h4>
        <div class="approval-copy">
          <span>Creative brief</span>
          <p>${campaign.concept}</p>
        </div>
        <div class="approval-copy">
          <span>Base caption</span>
          <p>${campaign.caption}</p>
        </div>
        <div class="meta-row">
          <span class="pill">${campaign.assetType}</span>
          <span class="pill">${campaign.id}</span>
        </div>
        <div class="row-actions">
          <button class="mini-button" type="button" onclick="openCampaign('${campaign.id}')">Details</button>
          <button class="secondary-button" type="button" onclick="approveCampaign('${campaign.id}')">Approve campaign</button>
          <button class="mini-button" type="button" onclick="requestRevision('${campaign.id}')">Needs revision</button>
        </div>
      </div>
    </article>
  `;
}

function renderPostGroups() {
  const channel = document.getElementById("postChannelFilter").value;
  const status = document.getElementById("postStatusFilter").value;
  const filteredPosts = state.posts.filter((item) => {
    const matchesChannel = channel === "all" || item.channel === channel;
    const matchesStatus = status === "all" || item.status === status;
    return matchesChannel && matchesStatus;
  });

  const groups = state.campaigns
    .map((campaign) => ({
      campaign,
      posts: filteredPosts.filter((item) => item.campaignId === campaign.id).sort(sortPosts),
    }))
    .filter((group) => group.posts.length);

  document.getElementById("postTable").innerHTML = groups.length
    ? groups.map(renderPostGroup).join("")
    : `<article class="empty-state"><strong>No matching channel posts</strong><span>Change the filters or reset the demo state.</span></article>`;
}

function renderPostGroup(group) {
  const { campaign, posts } = group;
  const needsApproval = posts.filter((item) => item.status === "needs_approval").length;
  const issueCount = posts.filter((item) => isIssueStatus(item.status)).length;
  return `
    <details class="post-group" open>
      <summary>
        <span class="campaign-color" style="background:${campaign.productTone}"></span>
        <div>
          <strong>${campaign.product}</strong>
          <small>${campaign.hookTitle}</small>
        </div>
        <span class="pill ${needsApproval ? "amber" : issueCount ? "coral" : "green"}">
          ${needsApproval ? `${needsApproval} to approve` : issueCount ? `${issueCount} issue` : "No approval needed"}
        </span>
      </summary>
      <div class="post-group-body">
        ${renderCreativePreview(campaign, "post-creative")}
        <div class="post-copy">
          <span class="eyebrow">Caption preview</span>
          <p>${campaign.caption}</p>
          <button class="mini-button" type="button" onclick="openCampaign('${campaign.id}')">Open campaign details</button>
        </div>
        <div class="channel-post-list">
          ${posts.map(renderChannelPostRow).join("")}
        </div>
      </div>
    </details>
  `;
}

function renderChannelPostRow(item) {
  const canApprove = item.status === "needs_approval";
  return `
    <article class="channel-post-row">
      <div>
        <strong>${item.channel}</strong>
        <span>${formatShortDate(item.date)} at ${item.time} BST</span>
      </div>
      <div>
        <span class="pill ${statusPill[item.status]}">${statusLabels[item.status]}</span>
        <small>${item.linkMode}</small>
      </div>
      <div class="row-actions">
        ${renderLivePostAction(item)}
        <button class="secondary-button" type="button" ${canApprove ? "" : "disabled"} onclick="approvePost('${item.id}')">Approve</button>
      </div>
    </article>
  `;
}

function renderLivePostAction(item) {
  if (item.publishedUrl) {
    return `<a class="mini-link-button" href="${item.publishedUrl}" target="_blank" rel="noopener noreferrer">View live post</a>`;
  }

  const label = item.status === "posted" ? "URL missing" : "No live URL yet";
  return `<span class="disabled-link-button">${label}</span>`;
}

function renderHealth() {
  const issues = issuePosts();
  document.getElementById("issueList").innerHTML = issues.length
    ? issues.map((item) => {
        const campaign = campaignById(item.campaignId);
        return `
          <article class="issue-row">
            <strong>${item.channel} - ${statusLabels[item.status]}</strong>
            <span>${campaign.product}</span>
            <small>${formatShortDate(item.date)} ${item.time} BST. ${item.linkMode}.</small>
          </article>
        `;
      }).join("")
    : `<article class="issue-row"><strong>No current posting issues</strong><span>Blocked and failed posts will appear here.</span></article>`;

  document.getElementById("eventLog").innerHTML = state.audit
    .slice(-8)
    .reverse()
    .map((entry) => `<p>${entry}</p>`)
    .join("");
}

function renderCreativePreview(campaign, className) {
  const imageStyle = campaign.image
    ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.22)),url('${campaign.image}');--product-tone:${campaign.productTone}"`
    : `--product-tone:${campaign.productTone}`;
  const imageClass = campaign.image ? "with-image" : "mock-creative";
  return `
    <button class="${className} ${imageClass}" style="${imageStyle}" type="button" onclick="openCampaign('${campaign.id}')">
      <span class="asset-tag">${campaign.assetStatus}</span>
      <span class="creative-title">${campaign.hookTitle}</span>
    </button>
  `;
}

function openCampaign(id) {
  selectedCampaignId = id;
  renderDrawer(id);
  document.getElementById("detailDrawer").classList.add("is-open");
}

function closeDrawer() {
  document.getElementById("detailDrawer").classList.remove("is-open");
}

function renderDrawer(id) {
  const campaign = campaignById(id);
  const relatedPosts = state.posts.filter((item) => item.campaignId === id).sort(sortPosts);

  document.getElementById("drawerContent").innerHTML = `
    ${renderCreativePreview(campaign, "drawer-hero")}
    <div class="drawer-copy">
      <div class="status-line">
        <span class="pill ${statusPill[campaign.status]}">${statusLabels[campaign.status]}</span>
        <span class="pill green">${campaign.fitScore}% concept fit</span>
        <span class="pill blue">${campaign.assetType}</span>
      </div>
      <h3>${campaign.product}</h3>
      <p><strong>${campaign.hookTitle}</strong></p>
      <div class="approval-copy">
        <span>Creative brief</span>
        <p>${campaign.concept}</p>
      </div>
      <div class="approval-copy">
        <span>Base caption</span>
        <p>${campaign.caption}</p>
      </div>
    </div>

    <label class="search-field">
      <span>Approval note</span>
      <textarea id="approvalNote" placeholder="Optional note for the real Sheet integration later."></textarea>
    </label>

    <div class="drawer-actions">
      <button class="secondary-button" type="button" onclick="approveCampaign('${campaign.id}')">Approve campaign</button>
      <button class="danger-button" type="button" onclick="requestRevision('${campaign.id}')">Send to revision</button>
      <button class="primary-button" type="button" onclick="approveCampaignPosts('${campaign.id}')">Approve all posts</button>
      <button class="ghost-button" type="button" onclick="switchView('posts')">Open post groups</button>
    </div>

    <h4>Channel posts</h4>
    <div class="drawer-posts">
      ${relatedPosts.map(renderDrawerPost).join("")}
    </div>

    <div class="audit-log">
      <p><strong>Recent log</strong></p>
      ${state.audit.slice(-5).reverse().map((entry) => `<p>${entry}</p>`).join("")}
    </div>
  `;
}

function renderDrawerPost(item) {
  return `
    <article class="drawer-post">
      <div class="status-line">
        <strong>${item.channel}</strong>
        <span class="pill ${statusPill[item.status]}">${statusLabels[item.status]}</span>
      </div>
      <p>${formatShortDate(item.date)} at ${item.time} BST. ${item.linkMode}.</p>
      <div class="row-actions">
        ${renderLivePostAction(item)}
        <button class="mini-button" type="button" onclick="approvePost('${item.id}')" ${item.status === "needs_approval" ? "" : "disabled"}>Approve this post</button>
      </div>
    </article>
  `;
}

function approveCampaign(id) {
  const campaign = campaignById(id);
  if (campaign.status === "approved") {
    showToast(`${campaign.product} is already approved.`);
    return;
  }

  campaign.status = "approved";
  campaign.assetStatus = campaign.assetStatus === "needs revision" ? "waiting for generation" : campaign.assetStatus;
  addAudit(`Campaign ${id} approved in prototype mode.`);
  saveState();
  renderAll();
  showToast("Campaign approved locally. Future build would update the Sheet after confirmation.");
}

function requestRevision(id) {
  const campaign = campaignById(id);
  campaign.status = "needs_revision";
  campaign.assetStatus = "needs revision";
  addAudit(`Campaign ${id} marked needs revision in prototype mode.`);
  saveState();
  renderAll();
  showToast("Campaign sent to revision locally. No Sheet row changed.");
}

function approvePost(id) {
  const item = state.posts.find((postItem) => postItem.id === id);
  if (!item || item.status !== "needs_approval") {
    showToast("This post is not waiting for approval.");
    return;
  }

  item.status = "ready_to_post";
  addAudit(`${item.channel} post ${id} approved in prototype mode.`);
  saveState();
  renderAll();
  showToast(`${item.channel} post approved locally.`);
}

function approveCampaignPosts(campaignId) {
  const posts = state.posts.filter((item) => item.campaignId === campaignId && item.status === "needs_approval");
  posts.forEach((item) => {
    item.status = "ready_to_post";
  });

  addAudit(`${posts.length} posts approved for ${campaignId} in prototype mode.`);
  saveState();
  renderAll();
  showToast(posts.length ? `${posts.length} posts approved locally.` : "No posts were waiting for approval.");
}

function addAudit(entry) {
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  state.audit.push(`${time} - ${entry}`);
  document.getElementById("lastAction").textContent = `Last local action: ${time}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

function weekDates(offset) {
  const start = parseDate("2026-06-22");
  start.setDate(start.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayName(dateKey) {
  return parseDate(dateKey).toLocaleDateString("en-GB", { weekday: "short" });
}

function formatShortDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatLongDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function sortPosts(a, b) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function groupPostsByCampaign(posts) {
  const groups = new Map();
  posts.forEach((item) => {
    if (!groups.has(item.campaignId)) {
      groups.set(item.campaignId, {
        campaignId: item.campaignId,
        posts: [],
      });
    }
    groups.get(item.campaignId).posts.push(item);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    posts: group.posts.sort(sortPosts),
  }));
}

function getGroupStatus(posts) {
  if (posts.some((item) => item.status === "failed")) return "failed";
  if (posts.some((item) => item.status === "blocked")) return "blocked";
  if (posts.some((item) => item.status === "needs_approval")) return "needs_approval";
  if (posts.some((item) => item.status === "draft")) return "draft";
  if (posts.some((item) => item.status === "ready_to_post")) return "ready_to_post";
  return "posted";
}

function summarizeStatuses(posts) {
  const counts = posts.reduce((summary, item) => {
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(counts)
    .map(([status, count]) => `${count} ${compactStatusLabels[status] || statusLabels[status].toLowerCase()}`)
    .join(", ");
}

function summarizeGroupState(posts) {
  const issueCount = posts.filter((item) => isIssueStatus(item.status)).length;
  const approvalCount = posts.filter((item) => item.status === "needs_approval").length;
  const readyCount = posts.filter((item) => item.status === "ready_to_post").length;
  const draftCount = posts.filter((item) => item.status === "draft").length;
  const postedCount = posts.filter((item) => item.status === "posted").length;

  if (issueCount) return `${issueCount} issue${issueCount === 1 ? "" : "s"}`;
  if (approvalCount) return `${approvalCount} to approve`;
  if (draftCount) return `${draftCount} draft${draftCount === 1 ? "" : "s"}`;
  if (readyCount && readyCount === posts.length) return "Ready";
  if (postedCount && postedCount === posts.length) return "Posted";
  if (readyCount) return `${readyCount} ready`;
  return "Scheduled";
}

function campaignById(id) {
  return state.campaigns.find((campaign) => campaign.id === id);
}

function issuePosts() {
  return state.posts.filter((item) => isIssueStatus(item.status)).sort(sortPosts);
}

function isIssueStatus(status) {
  return status === "blocked" || status === "failed";
}

function channelClass(channel) {
  return channel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
