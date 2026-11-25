const INDEX_URL = "https://cdn.dsh.so/market/top-rank.json";
const PAGE_SIZE = 12;
const COLLECTIONS = {
  skills: {
    label: "DSH Skill",
    title: "技能库",
    url: "data/skills.json",
    placeholder: "搜索技能名称、简介、作者或标签…",
    categories: ["开发编程", "创作办公", "联网研究", "记忆知识", "技能管理", "智能体", "效率工具"],
  },
  themes: {
    label: "界面与主题",
    title: "界面与主题",
    url: "data/themes.json",
    placeholder: "搜索主题、皮肤、启动动画或挂件…",
    categories: ["启动动画", "主题皮肤", "桌面挂件", "界面增强"],
  },
  mcp: {
    label: "MCP",
    title: "MCP 服务",
    url: "data/mcp.json",
    placeholder: "搜索 MCP 服务、工具、作者或标签…",
    categories: ["研究与办公", "创作与媒体", "搜索与浏览", "系统与开发", "智能体与协作", "连接与集成"],
  },
};

const state = {
  collection: "skills",
  cache: { skills: [], themes: [], mcp: [] },
  loadId: 0,
  items: [],
  filtered: [],
  query: "",
  category: "全部",
  sort: "stars",
  verifiedOnly: false,
  favoritesOnly: false,
  visible: PAGE_SIZE,
  favorites: new Set(),
};

const elements = {
  grid: document.querySelector("#skill-grid"),
  summary: document.querySelector("#result-summary"),
  empty: document.querySelector("#empty-state"),
  loadMore: document.querySelector("#load-more"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  categories: document.querySelector("#categories"),
  verified: document.querySelector("#verified-only"),
  favoritesOnly: document.querySelector("#favorites-only"),
  favoriteCount: document.querySelector("#favorite-count"),
  dialog: document.querySelector("#skill-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  toast: document.querySelector("#toast"),
};

let toastTimer;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
}

function skillInitial(item) {
  const cleaned = item.name.replace(/^@/, "").replace(/^(dsh|deepseek)[-_]/i, "");
  return (cleaned.match(/[a-z0-9]/i)?.[0] || cleaned[0] || "S").toUpperCase();
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem("dsh-skillbox-favorites") || "[]");
    if (Array.isArray(saved)) state.favorites = new Set(saved.filter((value) => typeof value === "string").map((value) => value.includes(":") ? value : `skills:${value}`));
  } catch {
    state.favorites = new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem("dsh-skillbox-favorites", JSON.stringify([...state.favorites]));
  } catch {
    showToast("浏览器未允许保存收藏，本次仍然有效");
  }
}

function favoriteKey(item) {
  return `${state.collection}:${item.id}`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function copyText(text, successMessage = "已复制") {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
    showToast(successMessage);
    return true;
  } catch {
    showToast("自动复制不可用，请按 Ctrl+C 复制已选中的文本");
    return false;
  }
}

function createBadge(text, className = "") {
  return makeElement("span", `badge ${className}`.trim(), text);
}

function createCard(item) {
  const card = makeElement("article", "skill-card");
  card.dataset.category = item.category;

  const top = makeElement("div", "card-top");
  top.append(makeElement("span", "skill-icon", skillInitial(item)));
  const favorite = makeElement("button", `favorite-button${state.favorites.has(favoriteKey(item)) ? " active" : ""}`, state.favorites.has(favoriteKey(item)) ? "★" : "☆");
  favorite.type = "button";
  favorite.setAttribute("aria-label", `${state.favorites.has(favoriteKey(item)) ? "取消收藏" : "收藏"} ${item.name}`);
  favorite.setAttribute("aria-pressed", String(state.favorites.has(favoriteKey(item))));
  favorite.addEventListener("click", () => toggleFavorite(favoriteKey(item)));
  top.append(favorite);

  const badges = makeElement("div", "card-badges");
  badges.append(createBadge(item.category));
  badges.append(item.verified ? createBadge("✓ 安装已验证", "verified") : createBadge("安装未验证", "pending"));
  if (item.risk === "low") badges.append(createBadge("数据源：低风险"));

  const title = makeElement("h3", "", item.name);
  const description = makeElement("p", "skill-description", item.summary || "该项目暂未提供简介，请前往仓库查看。");

  const meta = makeElement("div", "card-meta");
  meta.append(makeElement("span", "stars", `★ ${formatNumber(item.stars)}`));
  meta.append(makeElement("span", "", `@${item.author}`));
  if (item.version) meta.append(makeElement("span", "", `v${item.version}`));

  const actions = makeElement("div", "card-actions");
  const details = makeElement("button", "details-button", "查看详情 →");
  details.type = "button";
  details.addEventListener("click", () => openDetails(item));
  const repo = makeElement("a", "repo-link", "GitHub ↗");
  repo.href = item.repo;
  repo.target = "_blank";
  repo.rel = "noopener";
  repo.setAttribute("aria-label", `打开 ${item.name} 的 GitHub 仓库`);
  actions.append(details, repo);

  card.append(top, badges, title, description, meta, actions);
  return card;
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    showToast("已取消收藏");
  } else {
    state.favorites.add(id);
    showToast("已加入收藏");
  }
  saveFavorites();
  updateFavoriteCount();
  applyFilters();
}

function updateFavoriteCount() {
  elements.favoriteCount.textContent = state.favorites.size;
  elements.favoritesOnly.classList.toggle("active", state.favoritesOnly);
  elements.favoritesOnly.setAttribute("aria-pressed", String(state.favoritesOnly));
  elements.favoritesOnly.firstChild.textContent = state.favoritesOnly ? "★ 收藏 " : "☆ 收藏 ";
}

function renderCategories() {
  const present = new Set(state.items.map((item) => item.category));
  const categories = ["全部", ...COLLECTIONS[state.collection].categories.filter((category) => present.has(category))];
  elements.categories.replaceChildren();
  categories.forEach((category) => {
    const count = category === "全部" ? state.items.length : state.items.filter((item) => item.category === category).length;
    const button = makeElement("button", `category-button${state.category === category ? " active" : ""}`, `${category} ${count}`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.category === category));
    button.addEventListener("click", () => {
      state.category = category;
      state.visible = PAGE_SIZE;
      renderCategories();
      applyFilters();
    });
    elements.categories.append(button);
  });
}

function applyFilters() {
  const query = state.query.trim().toLowerCase();
  state.filtered = state.items.filter((item) => {
    if (state.category !== "全部" && item.category !== state.category) return false;
    if (state.verifiedOnly && !item.verified) return false;
    if (state.favoritesOnly && !state.favorites.has(favoriteKey(item))) return false;
    if (!query) return true;
    const haystack = [item.name, item.summary, item.author, item.category, ...(item.keywords || [])].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  state.filtered.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (state.sort === "verified") return Number(b.verified) - Number(a.verified) || b.stars - a.stars;
    return b.stars - a.stars;
  });
  renderCards();
}

function renderCards() {
  const visibleItems = state.filtered.slice(0, state.visible);
  elements.grid.replaceChildren(...visibleItems.map(createCard));
  elements.grid.setAttribute("aria-busy", "false");
  elements.empty.hidden = state.filtered.length !== 0;
  elements.grid.hidden = state.filtered.length === 0;
  elements.summary.textContent = `找到 ${state.filtered.length} 个项目${state.filtered.length ? ` · 当前显示 ${visibleItems.length} 个` : ""}`;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
  elements.loadMore.textContent = `加载更多（还有 ${Math.max(0, state.filtered.length - state.visible)} 个）`;
}

function resetFilters() {
  state.query = "";
  state.category = "全部";
  state.sort = "stars";
  state.verifiedOnly = false;
  state.favoritesOnly = false;
  state.visible = PAGE_SIZE;
  elements.search.value = "";
  elements.sort.value = "stars";
  elements.verified.checked = false;
  updateFavoriteCount();
  renderCategories();
  applyFilters();
}

function addDetail(list, label, value) {
  const item = makeElement("div", "detail-item");
  item.append(makeElement("dt", "", label), makeElement("dd", "", value || "未提供"));
  list.append(item);
}

function openDetails(item) {
  elements.dialogContent.replaceChildren();
  const kicker = makeElement("p", "dialog-kicker", `${item.category} / ${COLLECTIONS[state.collection].label}`);
  const title = makeElement("h2", "", item.name);
  title.id = "dialog-title";
  const description = makeElement("p", "dialog-description", item.summary || "该项目暂未提供简介，请前往仓库查看。");
  const badges = makeElement("div", "dialog-badges");
  badges.append(item.verified ? createBadge("✓ 安装已验证", "verified") : createBadge("安装未验证", "pending"));
  if (item.risk === "low") badges.append(createBadge("数据源：低风险"));
  badges.append(createBadge(`★ ${formatNumber(item.stars)}`));

  const details = makeElement("dl", "detail-grid");
  addDetail(details, "作者", `@${item.author}`);
  addDetail(details, "版本", item.version);
  addDetail(details, "安装来源", item.sourceType === "npm" ? "npm 精确版本" : "GitHub 固定提交 / 版本");
  addDetail(details, "DSH 版本要求", item.dsh || "请到原仓库核验");
  addDetail(details, "固定提交", item.commit ? item.commit.slice(0, 12) : "未提供");
  addDetail(details, "许可证", item.license || "未结构化提供，请到仓库核验");

  const installLabel = makeElement("p", "install-label", "在 DSH 终端中安装");
  const installBox = makeElement("div", "install-box");
  const code = makeElement("code", "", item.install);
  const copy = makeElement("button", "", "复制命令");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const copied = await copyText(item.install, "安装命令已复制");
    copy.textContent = copied ? "已复制" : "请手动复制";
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setTimeout(() => { copy.textContent = "复制命令"; }, 2400);
  });
  installBox.append(code, copy);

  const actions = makeElement("div", "dialog-actions");
  const repo = makeElement("a", "button button-dark", "打开 GitHub 仓库 ↗");
  repo.href = item.repo;
  repo.target = "_blank";
  repo.rel = "noopener";
  const license = makeElement("span", "dialog-license", "安装前请阅读原仓库 README 与许可证");
  actions.append(repo, license);

  elements.dialogContent.append(kicker, title, description, badges, details, installLabel, installBox, actions);
  elements.dialog.showModal();
  document.body.style.overflow = "hidden";
}

function closeDialog() {
  elements.dialog.close();
  document.body.style.overflow = "";
}

function renderLoading() {
  elements.grid.hidden = false;
  elements.empty.hidden = true;
  elements.loadMore.hidden = true;
  elements.grid.setAttribute("aria-busy", "true");
  elements.grid.replaceChildren(...Array.from({ length: 6 }, () => makeElement("div", "skeleton")));
  elements.summary.textContent = "正在读取技能数据…";
}

function renderError(message) {
  elements.grid.hidden = false;
  elements.grid.setAttribute("aria-busy", "false");
  const wrapper = makeElement("div", "error-state");
  wrapper.append(makeElement("h3", "", "技能数据暂时没有加载成功"));
  wrapper.append(makeElement("p", "", message));
  const retry = makeElement("button", "", "重新加载");
  retry.type = "button";
  retry.addEventListener("click", loadData);
  wrapper.append(retry);
  elements.grid.replaceChildren(wrapper);
  elements.summary.textContent = "数据加载失败";
  elements.loadMore.hidden = true;
}

function updateCollectionUI() {
  const collection = COLLECTIONS[state.collection];
  document.querySelector("#catalog-title").textContent = collection.title;
  elements.search.placeholder = collection.placeholder;
  document.querySelector(".quick-start").hidden = state.collection !== "skills";
  document.querySelectorAll("[data-collection]").forEach((button) => {
    const active = button.dataset.collection === state.collection;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

async function loadData() {
  const collection = state.collection;
  const loadId = ++state.loadId;
  state.items = state.cache[collection];
  if (state.items.length === 0) renderLoading();
  try {
    if (state.items.length === 0) {
      const response = await fetch(COLLECTIONS[collection].url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.items) || data.items.length === 0) throw new Error("数据格式不正确");
      state.cache[collection] = data.items;
    }
    if (loadId !== state.loadId || collection !== state.collection) return;
    state.items = state.cache[collection];
    document.querySelector("#skill-count").textContent = state.items.length;
    document.querySelector("#verified-count").textContent = state.items.filter((item) => item.verified).length;
    document.querySelector(`[data-collection="${collection}"] .collection-count`).textContent = state.items.length;
    state.visible = PAGE_SIZE;
    renderCategories();
    updateFavoriteCount();
    applyFilters();
  } catch (error) {
    if (loadId === state.loadId && collection === state.collection) renderError(`请检查网络或稍后再试（${error.message}）。`);
  }
}

function switchCollection(collection) {
  if (!COLLECTIONS[collection]) return;
  state.collection = collection;
  state.query = "";
  state.category = "全部";
  state.verifiedOnly = false;
  state.favoritesOnly = false;
  state.visible = PAGE_SIZE;
  elements.search.value = "";
  elements.verified.checked = false;
  updateCollectionUI();
  updateFavoriteCount();
  loadData();
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.visible = PAGE_SIZE;
  applyFilters();
});

elements.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  applyFilters();
});

elements.verified.addEventListener("change", (event) => {
  state.verifiedOnly = event.target.checked;
  state.visible = PAGE_SIZE;
  applyFilters();
});

elements.favoritesOnly.addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.visible = PAGE_SIZE;
  updateFavoriteCount();
  applyFilters();
});

elements.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderCards();
});

document.querySelector("#reset-filters").addEventListener("click", resetFilters);
document.querySelector("[data-reset]").addEventListener("click", resetFilters);
document.querySelector("#dialog-close").addEventListener("click", closeDialog);
elements.dialog.addEventListener("close", () => { document.body.style.overflow = ""; });
elements.dialog.addEventListener("click", (event) => {
  if (event.target !== elements.dialog) return;
  const rect = elements.dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
});

document.querySelectorAll("[data-collection]").forEach((button) => {
  button.addEventListener("click", () => switchCollection(button.dataset.collection));
});

document.querySelectorAll("[data-collection-link]").forEach((link) => {
  link.addEventListener("click", () => switchCollection(link.dataset.collectionLink));
});

document.querySelectorAll("[data-copy-index]").forEach((button) => {
  button.addEventListener("click", () => copyText(INDEX_URL, "DSH 索引源已复制"));
});

document.querySelectorAll("[data-quick]").forEach((button) => {
  button.addEventListener("click", () => {
    state.query = button.dataset.quick;
    state.category = "全部";
    state.visible = PAGE_SIZE;
    elements.search.value = state.query;
    renderCategories();
    applyFilters();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !elements.dialog.open) {
    event.preventDefault();
    elements.search.focus();
  }
});

loadFavorites();
updateCollectionUI();
loadData();
