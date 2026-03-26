var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LockBasesView
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  lockedBases: {},
  lockCheckboxes: true
};
var I18N = {
  en: {
    commandToggleBasesLock: "Toggle Bases view lock",
    noticeNotBasesView: "The active view is not a Bases view.",
    basesViewLocked: "Bases view locked",
    basesViewUnlocked: "Bases view unlocked",
    noticeLockEnabled: "Locked",
    noticeLockDisabled: "Unlocked",
    settingLockCheckboxesName: "Lock checkboxes",
    settingLockCheckboxesDesc: "When disabled, checkboxes remain clickable while the Bases view is locked."
  },
  zh: {
    commandToggleBasesLock: "\u5207\u6362 Bases \u89C6\u56FE\u9501\u5B9A",
    noticeNotBasesView: "\u5F53\u524D\u6D3B\u52A8\u89C6\u56FE\u4E0D\u662F Bases \u89C6\u56FE\u3002",
    basesViewLocked: "Bases \u89C6\u56FE\u5DF2\u9501\u5B9A",
    basesViewUnlocked: "Bases \u89C6\u56FE\u672A\u9501\u5B9A",
    noticeLockEnabled: "\u5DF2\u9501\u5B9A",
    noticeLockDisabled: "\u5DF2\u89E3\u9501",
    settingLockCheckboxesName: "\u9501\u5B9A\u52FE\u9009\u6846",
    settingLockCheckboxesDesc: "\u5173\u95ED\u540E\uFF0C\u5373\u4F7F Bases \u89C6\u56FE\u5DF2\u9501\u5B9A\uFF0C\u52FE\u9009\u6846\u4ECD\u7136\u53EF\u4EE5\u70B9\u51FB\u3002"
  },
  ja: {
    commandToggleBasesLock: "Bases \u30D3\u30E5\u30FC\u306E\u30ED\u30C3\u30AF\u3092\u5207\u308A\u66FF\u3048",
    noticeNotBasesView: "\u73FE\u5728\u306E\u30A2\u30AF\u30C6\u30A3\u30D6\u30D3\u30E5\u30FC\u306F Bases \u30D3\u30E5\u30FC\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
    basesViewLocked: "Bases \u30D3\u30E5\u30FC\u306F\u30ED\u30C3\u30AF\u4E2D",
    basesViewUnlocked: "Bases \u30D3\u30E5\u30FC\u306F\u30ED\u30C3\u30AF\u89E3\u9664\u4E2D",
    noticeLockEnabled: "\u30ED\u30C3\u30AF\u3057\u307E\u3057\u305F",
    noticeLockDisabled: "\u30ED\u30C3\u30AF\u3092\u89E3\u9664\u3057\u307E\u3057\u305F",
    settingLockCheckboxesName: "\u30C1\u30A7\u30C3\u30AF\u30DC\u30C3\u30AF\u30B9\u3082\u30ED\u30C3\u30AF\u3059\u308B",
    settingLockCheckboxesDesc: "\u30AA\u30D5\u306B\u3059\u308B\u3068\u3001Bases \u30D3\u30E5\u30FC\u304C\u30ED\u30C3\u30AF\u4E2D\u3067\u3082\u30C1\u30A7\u30C3\u30AF\u30DC\u30C3\u30AF\u30B9\u306F\u30AF\u30EA\u30C3\u30AF\u3067\u304D\u307E\u3059\u3002"
  }
};
var LockBasesView = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.basesObservers = /* @__PURE__ */ new WeakMap();
    this.basesListeners = /* @__PURE__ */ new WeakMap();
    this.basesLocks = /* @__PURE__ */ new WeakSet();
  }
  getLocale() {
    const language = String((0, import_obsidian.getLanguage)() || "en").toLowerCase();
    if (language.startsWith("zh")) {
      return "zh";
    }
    if (language.startsWith("ja")) {
      return "ja";
    }
    return "en";
  }
  t(key) {
    var _a;
    const locale = this.getLocale();
    return ((_a = I18N[locale]) == null ? void 0 : _a[key]) || I18N.en[key] || key;
  }
  shouldLockCheckboxes() {
    var _a;
    return ((_a = this.settings) == null ? void 0 : _a.lockCheckboxes) !== false;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  isCheckboxElement(el) {
    if (!el || !(el instanceof Element)) {
      return false;
    }
    if (el.closest('input[type="checkbox"], [role="checkbox"], .checkbox-container')) {
      return true;
    }
    const label = el.closest("label");
    return !!(label == null ? void 0 : label.querySelector('input[type="checkbox"], [role="checkbox"], .checkbox-container'));
  }
  isCheckboxCell(el) {
    if (!el || !(el instanceof Element)) {
      return false;
    }
    const cell = el.matches(".bases-table-cell") ? el : el.closest(".bases-table-cell");
    if (!(cell instanceof Element)) {
      return false;
    }
    if (cell.getAttribute("data-property-type") === "checkbox") {
      return true;
    }
    return !!cell.querySelector('input[type="checkbox"], .metadata-input-checkbox, [role="checkbox"], .checkbox-container');
  }
  hasBlockedEditableContent(root) {
    if (!root || !(root instanceof Element)) {
      return false;
    }
    if (!this.shouldLockCheckboxes() && this.isCheckboxCell(root)) {
      return false;
    }
    const selector = this.shouldLockCheckboxes() ? 'input, textarea, [contenteditable="true"], [contenteditable=true], .multi-select-pill, [role="checkbox"], .checkbox-container' : 'input:not([type="checkbox"]), textarea, [contenteditable="true"], [contenteditable=true], .multi-select-pill';
    return !!root.querySelector(selector);
  }
  getOpenBasesViews() {
    const views = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf == null ? void 0 : leaf.view;
      if (!view || !this.isBasesView(view) || views.includes(view)) {
        return;
      }
      views.push(view);
    });
    return views;
  }
  async refreshOpenBasesLocks() {
    const views = this.getOpenBasesViews();
    for (const view of views) {
      if (this.basesLocks.has(view)) {
        await this.unlockBases(view, { silent: true, persist: false });
        await this.lockBases(view, { silent: true, persist: false });
        continue;
      }
      if (this.isPersistedLocked(view)) {
        await this.lockBases(view, { silent: true, persist: false });
      }
    }
    this.updateTitleButton();
  }
  async onload() {
    var _a, _b;
    this.basesObservers = /* @__PURE__ */ new WeakMap();
    this.basesListeners = /* @__PURE__ */ new WeakMap();
    this.basesLocks = /* @__PURE__ */ new WeakSet();
    const loaded = await this.loadData();
    this.settings = {
      lockedBases: { ...DEFAULT_SETTINGS.lockedBases, ...(_a = loaded == null ? void 0 : loaded.lockedBases) != null ? _a : {} },
      lockCheckboxes: (_b = loaded == null ? void 0 : loaded.lockCheckboxes) != null ? _b : DEFAULT_SETTINGS.lockCheckboxes
    };
    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      var _a2, _b2;
      if (!oldPath || !((_b2 = (_a2 = this.settings) == null ? void 0 : _a2.lockedBases) == null ? void 0 : _b2[oldPath])) {
        return;
      }
      this.settings.lockedBases[file.path] = this.settings.lockedBases[oldPath];
      delete this.settings.lockedBases[oldPath];
      await this.saveSettings();
    }));
    this.registerEvent(this.app.vault.on("delete", async (file) => {
      var _a2, _b2;
      if (!(file == null ? void 0 : file.path) || !((_b2 = (_a2 = this.settings) == null ? void 0 : _a2.lockedBases) == null ? void 0 : _b2[file.path])) {
        return;
      }
      delete this.settings.lockedBases[file.path];
      await this.saveSettings();
    }));
    this.addSettingTab(new LockBasesViewSettingTab(this.app, this));
    this.addCommand({
      id: "toggle-bases-lock",
      name: this.t("commandToggleBasesLock"),
      callback: async () => {
        const view = this.getActiveBasesView();
        if (view && this.isBasesView(view)) {
          await this.toggleBasesLock(view);
        } else {
          new import_obsidian.Notice(this.t("noticeNotBasesView"));
        }
      }
    });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      void this.syncActiveBasesViewState();
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      void this.syncActiveBasesViewState();
    }));
    window.setTimeout(() => {
      void this.syncActiveBasesViewState();
    }, 200);
  }
  onunload() {
    for (const view of this.getOpenBasesViews()) {
      this.cleanupViewLock(view);
    }
    document.querySelectorAll(".lock-bases-toolbar-item").forEach((el) => el.remove());
    this.basesObservers = /* @__PURE__ */ new WeakMap();
    this.basesListeners = /* @__PURE__ */ new WeakMap();
    this.basesLocks = /* @__PURE__ */ new WeakSet();
  }
  updateTitleButton() {
    const view = this.getActiveBasesView();
    if (!view || !view.containerEl || !this.isBasesView(view)) {
      return;
    }
    const toolbar = view.containerEl.querySelector(".bases-toolbar");
    if (!toolbar) {
      return;
    }
    const existingBtn = toolbar.querySelector(".lock-bases-btn");
    if (existingBtn instanceof HTMLElement) {
      this.updateToolbarButtonState(existingBtn, this.basesLocks.has(view));
      const existingItem = existingBtn.closest(".lock-bases-toolbar-item");
      const resultsItem2 = toolbar.querySelector(".bases-toolbar-results-menu");
      if (existingItem && resultsItem2 && existingItem.previousElementSibling !== resultsItem2) {
        resultsItem2.insertAdjacentElement("afterend", existingItem);
      }
      return;
    }
    const item = document.createElement("div");
    item.className = "bases-toolbar-item lock-bases-toolbar-item";
    const btn = document.createElement("div");
    btn.className = "text-icon-button lock-bases-btn";
    btn.tabIndex = 0;
    const icon = document.createElement("span");
    icon.className = "text-button-icon";
    btn.appendChild(icon);
    this.updateToolbarButtonState(btn, this.basesLocks.has(view));
    const triggerToggle = () => {
      void this.toggleBasesLock(view);
    };
    btn.addEventListener("click", triggerToggle);
    btn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        triggerToggle();
      }
    });
    item.appendChild(btn);
    const resultsItem = toolbar.querySelector(".bases-toolbar-results-menu");
    if (resultsItem && resultsItem.parentNode === toolbar) {
      resultsItem.insertAdjacentElement("afterend", item);
    } else {
      toolbar.appendChild(item);
    }
  }
  getBasesKey(view) {
    if (!view) {
      return null;
    }
    if (view.file && view.file.path) {
      return view.file.path;
    }
    const activeFile = this.app.workspace.getActiveFile && this.app.workspace.getActiveFile();
    if (activeFile && /\.base$/i.test(activeFile.path)) {
      return activeFile.path;
    }
    const titleEl = view.containerEl && view.containerEl.querySelector(".view-header-title");
    const title = titleEl ? (titleEl.textContent || "").trim() : "";
    const type = view.getViewType && typeof view.getViewType === "function" ? String(view.getViewType()) : "bases";
    return title ? `${type}:${title}` : type;
  }
  isPersistedLocked(view) {
    const key = this.getBasesKey(view);
    if (!key) {
      return false;
    }
    return !!(this.settings && this.settings.lockedBases && this.settings.lockedBases[key]);
  }
  async setPersistedLocked(view, locked) {
    const key = this.getBasesKey(view);
    if (!key) {
      return;
    }
    if (!this.settings) {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    if (!this.settings.lockedBases) {
      this.settings.lockedBases = {};
    }
    if (locked) {
      this.settings.lockedBases[key] = true;
    } else {
      delete this.settings.lockedBases[key];
    }
    await this.saveData(this.settings);
  }
  syncActiveBasesViewState() {
    const view = this.getActiveBasesView();
    if (!view || !this.isBasesView(view)) {
      return;
    }
    if (this.isPersistedLocked(view)) {
      if (!this.basesLocks.has(view)) {
        void this.lockBases(view, { silent: true, persist: false });
      }
    } else if (this.basesLocks.has(view)) {
      void this.unlockBases(view, { silent: true, persist: false });
    }
    this.updateTitleButton();
  }
  updateToolbarButtonState(button, isLocked) {
    const icon = button.querySelector(".text-button-icon");
    if (icon) {
      icon.replaceChildren();
      (0, import_obsidian.setIcon)(icon, isLocked ? "lock" : "lock-open");
    }
    const label = isLocked ? this.t("basesViewLocked") : this.t("basesViewUnlocked");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.classList.toggle("is-active", isLocked);
  }
  getActiveBasesView() {
    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    if ((recentLeaf == null ? void 0 : recentLeaf.view) && this.isBasesView(recentLeaf.view)) {
      return recentLeaf.view;
    }
    return this.getOpenBasesViews()[0] || null;
  }
  isBasesView(view) {
    if (!(view == null ? void 0 : view.containerEl)) {
      return false;
    }
    try {
      if (typeof view.getViewType === "function") {
        const type = String(view.getViewType()).toLowerCase();
        if (type.includes("base")) {
          return true;
        }
      }
      const titleEl = view.containerEl.querySelector(".view-header-title");
      if (titleEl && /bases/i.test(titleEl.textContent || "")) {
        return true;
      }
      if (view.containerEl.querySelector(".bases-view")) {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }
  async toggleBasesLock(view) {
    if (this.basesLocks.has(view)) {
      await this.unlockBases(view);
    } else {
      await this.lockBases(view);
    }
  }
  isEditableElement(el) {
    if (!el || !(el instanceof Element)) {
      return false;
    }
    if (!this.shouldLockCheckboxes() && this.isCheckboxElement(el)) {
      return false;
    }
    if (el.closest('textarea, [contenteditable="true"], [contenteditable=true], .multi-select-pill-remove-button, .multi-select-pill, input:not([type="checkbox"])')) {
      return true;
    }
    if (this.shouldLockCheckboxes() && this.isCheckboxElement(el)) {
      return true;
    }
    const editorCell = el.closest(".bases-table-cell");
    if (!editorCell || editorCell.classList.contains("bases-rendered-value")) {
      return false;
    }
    return this.hasBlockedEditableContent(editorCell);
  }
  releaseEditableFocus(basesRoot, target) {
    const active = target || document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    if (!basesRoot.contains(active)) {
      return;
    }
    if (!this.isEditableElement(active)) {
      return;
    }
    try {
      active.blur();
    } catch (e) {
    }
    try {
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
    } catch (e) {
    }
  }
  applyLockDecorations(root, state) {
    if (!root || !state) {
      return;
    }
    const remember = (el) => {
      if (!el || state.processed.has(el)) {
        return;
      }
      state.processed.add(el);
      state.disabledCells.push(el);
    };
    const editorCells = Array.from(root.querySelectorAll(".bases-table-cell:not(.bases-rendered-value)"));
    for (const cell of editorCells) {
      if (!this.shouldLockCheckboxes() && this.isCheckboxCell(cell)) {
        continue;
      }
      if (!this.hasBlockedEditableContent(cell)) {
        continue;
      }
      remember(cell);
      cell.classList.add("lock-bases-editor-cell-disabled");
    }
  }
  async lockBases(view, options = {}) {
    const { silent = false, persist = true } = options;
    const container = view.containerEl;
    if (!container) {
      return;
    }
    container.classList.add("lock-bases-view-locked");
    const basesRoot = container.querySelector(".bases-view") || container;
    const state = {
      disabledCells: [],
      processed: /* @__PURE__ */ new WeakSet(),
      handlers: []
    };
    this.applyLockDecorations(basesRoot, state);
    this.releaseEditableFocus(basesRoot);
    const stopEvent = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!basesRoot.contains(target)) {
        return;
      }
      if (!this.isEditableElement(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      this.releaseEditableFocus(basesRoot, target);
    };
    const eventNames = ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "focusin", "keydown", "beforeinput", "input", "compositionstart", "paste", "cut", "drop", "touchstart"];
    for (const name of eventNames) {
      basesRoot.addEventListener(name, stopEvent, true);
      state.handlers.push({ name, handler: stopEvent });
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.applyLockDecorations(node, state);
        }
      }
    });
    state.observer = observer;
    this.basesObservers.set(container, observer);
    this.basesListeners.set(container, state);
    this.basesLocks.add(view);
    if (persist) {
      await this.setPersistedLocked(view, true);
    }
    if (!silent) {
      new import_obsidian.Notice(this.t("noticeLockEnabled"));
    }
    this.updateTitleButton();
  }
  cleanupViewLock(view) {
    const container = view == null ? void 0 : view.containerEl;
    if (!container) {
      return;
    }
    container.classList.remove("lock-bases-view-locked");
    const observer = this.basesObservers.get(container);
    if (observer) {
      observer.disconnect();
    }
    this.basesObservers.delete(container);
    const state = this.basesListeners.get(container);
    if (state && Array.isArray(state.handlers)) {
      const basesRoot = container.querySelector(".bases-view") || container;
      for (const item of state.handlers) {
        basesRoot.removeEventListener(item.name, item.handler, true);
      }
    }
    const disabledCells = state ? state.disabledCells : [];
    for (const cell of disabledCells) {
      try {
        cell == null ? void 0 : cell.classList.remove("lock-bases-editor-cell-disabled");
      } catch (e) {
      }
    }
    this.basesListeners.delete(container);
    this.basesLocks.delete(view);
    this.updateTitleButton();
  }
  async unlockBases(view, options = {}) {
    const { silent = false, persist = true } = options;
    if (!(view == null ? void 0 : view.containerEl)) {
      return;
    }
    this.cleanupViewLock(view);
    if (persist) {
      await this.setPersistedLocked(view, false);
    }
    if (!silent) {
      new import_obsidian.Notice(this.t("noticeLockDisabled"));
    }
    this.updateTitleButton();
  }
};
var LockBasesViewSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName(this.plugin.t("settingLockCheckboxesName")).setDesc(this.plugin.t("settingLockCheckboxesDesc")).addToggle((toggle) => toggle.setValue(this.plugin.shouldLockCheckboxes()).onChange(async (value) => {
      this.plugin.settings.lockCheckboxes = value;
      await this.plugin.saveSettings();
      await this.plugin.refreshOpenBasesLocks();
    }));
  }
};
