// @ts-nocheck
import { getLanguage, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const DEFAULT_SETTINGS = {
  lockedBases: {},
  lockCheckboxes: true,
};

const I18N = {
  en: {
    commandToggleBasesLock: 'Toggle Bases view lock',
    noticeNotBasesView: 'The active view is not a Bases view.',
    basesViewLocked: 'Bases view locked',
    basesViewUnlocked: 'Bases view unlocked',
    noticeLockEnabled: 'Locked',
    noticeLockDisabled: 'Unlocked',
    settingLockCheckboxesName: 'Lock checkboxes',
    settingLockCheckboxesDesc: 'When disabled, checkboxes remain clickable while the Bases view is locked.',
  },
  zh: {
    commandToggleBasesLock: '切换 Bases 视图锁定',
    noticeNotBasesView: '当前活动视图不是 Bases 视图。',
    basesViewLocked: 'Bases 视图已锁定',
    basesViewUnlocked: 'Bases 视图未锁定',
    noticeLockEnabled: '已锁定',
    noticeLockDisabled: '已解锁',
    settingLockCheckboxesName: '锁定勾选框',
    settingLockCheckboxesDesc: '关闭后，即使 Bases 视图已锁定，勾选框仍然可以点击。',
  },
  ja: {
    commandToggleBasesLock: 'Bases ビューのロックを切り替え',
    noticeNotBasesView: '現在のアクティブビューは Bases ビューではありません。',
    basesViewLocked: 'Bases ビューはロック中',
    basesViewUnlocked: 'Bases ビューはロック解除中',
    noticeLockEnabled: 'ロックしました',
    noticeLockDisabled: 'ロックを解除しました',
    settingLockCheckboxesName: 'チェックボックスもロックする',
    settingLockCheckboxesDesc: 'オフにすると、Bases ビューがロック中でもチェックボックスはクリックできます。',
  },
};

export default class LockBasesView extends Plugin {
  getLocale() {
    const language = String(getLanguage() || 'en').toLowerCase();
    if (language.startsWith('zh')) {
      return 'zh';
    }
    if (language.startsWith('ja')) {
      return 'ja';
    }
    return 'en';
  }

  t(key) {
    const locale = this.getLocale();
    return I18N[locale]?.[key] || I18N.en[key] || key;
  }

  shouldLockCheckboxes() {
    return this.settings?.lockCheckboxes !== false;
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
    const label = el.closest('label');
    return !!label?.querySelector('input[type="checkbox"], [role="checkbox"], .checkbox-container');
  }

  isCheckboxCell(el) {
    if (!el || !(el instanceof Element)) {
      return false;
    }
    const cell = el.matches('.bases-table-cell') ? el : el.closest('.bases-table-cell');
    if (!(cell instanceof Element)) {
      return false;
    }
    if (cell.getAttribute('data-property-type') === 'checkbox') {
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
    const selector = this.shouldLockCheckboxes()
      ? 'input, textarea, [contenteditable="true"], [contenteditable=true], .multi-select-pill, [role="checkbox"], .checkbox-container'
      : 'input:not([type="checkbox"]), textarea, [contenteditable="true"], [contenteditable=true], .multi-select-pill';
    return !!root.querySelector(selector);
  }

  getOpenBasesViews() {
    const views = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf?.view;
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
    this.basesObservers = new WeakMap();
    this.basesListeners = new WeakMap();
    this.basesLocks = new WeakSet();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});

    this.addSettingTab(new LockBasesViewSettingTab(this.app, this));

    this.addCommand({
      id: 'toggle-bases-lock',
      name: this.t('commandToggleBasesLock'),
      callback: async () => {
        const view = this.getActiveBasesView();
        if (view && this.isBasesView(view)) {
          await this.toggleBasesLock(view);
        } else {
          new Notice(this.t('noticeNotBasesView'));
        }
      },
    });

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      void this.syncActiveBasesViewState();
    }));
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      void this.syncActiveBasesViewState();
    }));

    window.setTimeout(() => {
      void this.syncActiveBasesViewState();
    }, 200);
  }

  onunload() {
    const style = document.getElementById('lock-bases-view-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
    this.basesObservers = new WeakMap();
    this.basesListeners = new WeakMap();
    this.basesLocks = new WeakSet();
  }

  updateTitleButton() {
    const view = this.getActiveBasesView();
    if (!view || !view.containerEl || !this.isBasesView(view)) {
      return;
    }

    const toolbar = view.containerEl.querySelector('.bases-toolbar');
    if (!toolbar) {
      return;
    }

    const existingBtn = toolbar.querySelector('.lock-bases-btn');
    if (existingBtn) {
      this.updateToolbarButtonState(existingBtn, this.basesLocks.has(view));
      const existingItem = existingBtn.closest('.lock-bases-toolbar-item');
      const resultsItem = toolbar.querySelector('.bases-toolbar-results-menu');
      if (existingItem && resultsItem && existingItem.previousElementSibling !== resultsItem) {
        resultsItem.insertAdjacentElement('afterend', existingItem);
      }
      return;
    }

    const item = document.createElement('div');
    item.className = 'bases-toolbar-item lock-bases-toolbar-item';

    const btn = document.createElement('div');
    btn.className = 'text-icon-button lock-bases-btn';
    btn.tabIndex = 0;

    const icon = document.createElement('span');
    icon.className = 'text-button-icon';
    btn.appendChild(icon);
    this.updateToolbarButtonState(btn, this.basesLocks.has(view));

    const triggerToggle = () => {
      void this.toggleBasesLock(view);
    };
    btn.addEventListener('click', triggerToggle);
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        triggerToggle();
      }
    });

    item.appendChild(btn);

    const resultsItem = toolbar.querySelector('.bases-toolbar-results-menu');
    if (resultsItem && resultsItem.parentNode === toolbar) {
      resultsItem.insertAdjacentElement('afterend', item);
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
    const titleEl = view.containerEl && view.containerEl.querySelector('.view-header-title');
    const title = titleEl ? (titleEl.textContent || '').trim() : '';
    const type = view.getViewType && typeof view.getViewType === 'function' ? String(view.getViewType()) : 'bases';
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
      this.settings = { lockedBases: {} };
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

  async syncActiveBasesViewState() {
    const view = this.getActiveBasesView();
    if (!view || !this.isBasesView(view)) {
      return;
    }
    if (this.isPersistedLocked(view)) {
      if (!this.basesLocks.has(view)) {
        this.lockBases(view, { silent: true, persist: false });
      }
    } else if (this.basesLocks.has(view)) {
      this.unlockBases(view, { silent: true, persist: false });
    }
    this.updateTitleButton();
  }

  updateToolbarButtonState(button, isLocked) {
    const icon = button.querySelector('.text-button-icon');
    if (icon) {
      icon.innerHTML = isLocked ? this.getLockSvg() : this.getUnlockSvg();
    }
    const label = isLocked ? this.t('basesViewLocked') : this.t('basesViewUnlocked');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.classList.toggle('is-active', isLocked);
  }

  getLockSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  }

  getUnlockSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-lock-open"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
  }

  getActiveBasesView() {
    const workspace = this.app.workspace;
    const directLeaf = workspace.activeLeaf;
    if (directLeaf && directLeaf.view && this.isBasesView(directLeaf.view)) {
      return directLeaf.view;
    }

    if (directLeaf && directLeaf.view) {
      return directLeaf.view;
    }

    return null;
  }

  isBasesView(view) {
    try {
      if (view.getViewType && typeof view.getViewType === 'function') {
        const type = String(view.getViewType()).toLowerCase();
        if (type.includes('base')) {
          return true;
        }
      }
      const titleEl = view.containerEl.querySelector('.view-header-title');
      if (titleEl && /bases/i.test(titleEl.textContent || '')) {
        return true;
      }
      if (view.containerEl.querySelector('.bases-view')) {
        return true;
      }
    } catch (error) {}
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
    const editorCell = el.closest('.bases-table-cell');
    if (!editorCell || editorCell.classList.contains('bases-rendered-value')) {
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
    } catch (error) {}
    try {
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
    } catch (error) {}
  }

  applyLockDecorations(root, state) {
    if (!root || !state) {
      return;
    }

    const remember = (el, snapshot) => {
      if (!el || state.processed.has(el)) {
        return;
      }
      state.processed.add(el);
      state.changed.push({ el, ...snapshot });
    };

    const removeButtons = root.querySelectorAll('.multi-select-pill-remove-button');
    for (const button of removeButtons) {
      remember(button, {
        kind: 'removeButton',
        display: button.style.display,
        width: button.style.width,
        minWidth: button.style.minWidth,
        margin: button.style.margin,
        padding: button.style.padding,
        overflow: button.style.overflow,
        flex: button.style.flex,
        pointerEvents: button.style.pointerEvents,
      });
      button.style.display = 'none';
      button.style.width = '0';
      button.style.minWidth = '0';
      button.style.margin = '0';
      button.style.padding = '0';
      button.style.overflow = 'hidden';
      button.style.flex = '0 0 0';
      button.style.pointerEvents = 'none';
    }

    const editorCells = root.querySelectorAll('.bases-table-cell:not(.bases-rendered-value)');
    for (const cell of editorCells) {
      if (!this.shouldLockCheckboxes() && this.isCheckboxCell(cell)) {
        continue;
      }
      if (!this.hasBlockedEditableContent(cell)) {
        continue;
      }
      remember(cell, {
        kind: 'editorCell',
        pointerEvents: cell.style.pointerEvents,
      });
      cell.style.pointerEvents = 'none';
    }

  }

  async lockBases(view, options = {}) {
    const { silent = false, persist = true } = options;
    const container = view.containerEl;
    if (!container) {
      return;
    }

    container.classList.add('lock-bases-view-locked');
    const basesRoot = container.querySelector('.bases-view') || container;

    if (!document.getElementById('lock-bases-view-style')) {
      const style = document.createElement('style');
      style.id = 'lock-bases-view-style';
      style.textContent = `
        .lock-bases-view-locked .bases-view .multi-select-pill {
          background-color: var(--tag-background) !important;
          color: var(--tag-color) !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: var(--tag-radius, 999px) !important;
          padding: 0 var(--size-2-2, 0.45em) !important;
          gap: 0 !important;
        }
        .lock-bases-view-locked .bases-view .multi-select-pill,
        .lock-bases-view-locked .bases-view .multi-select-pill *:not(.multi-select-pill-remove-button) {
          color: var(--tag-color) !important;
        }
        .lock-bases-view-locked .bases-view .multi-select-pill:hover {
          background-color: var(--tag-background-hover, var(--tag-background)) !important;
          color: var(--tag-color-hover, var(--tag-color)) !important;
        }
        .lock-bases-view-locked .bases-view .multi-select-pill-remove-button {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          flex: 0 0 0 !important;
        }
        .lock-bases-view-locked .bases-view input,
        .lock-bases-view-locked .bases-view textarea,
        .lock-bases-view-locked .bases-view [contenteditable="true"] {
          user-select: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const state = {
      changed: [],
      processed: new WeakSet(),
      handlers: [],
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
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      this.releaseEditableFocus(basesRoot, target);
    };

    const eventNames = ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'focusin', 'keydown', 'beforeinput', 'input', 'compositionstart', 'paste', 'cut', 'drop', 'touchstart'];
    for (const name of eventNames) {
      basesRoot.addEventListener(name, stopEvent, true);
      state.handlers.push({ name, handler: stopEvent });
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.applyLockDecorations(node, state);
        }
      }
    });

    observer.observe(basesRoot, { childList: true, subtree: true });
    state.observer = observer;
    this.basesObservers.set(container, observer);
    this.basesListeners.set(container, state);
    this.basesLocks.add(view);
    if (persist) {
      await this.setPersistedLocked(view, true);
    }
    if (!silent) {
      new Notice(this.t('noticeLockEnabled'));
    }
    this.updateTitleButton();
  }

  async unlockBases(view, options = {}) {
    const { silent = false, persist = true } = options;
    const container = view.containerEl;
    if (!container) {
      return;
    }

    container.classList.remove('lock-bases-view-locked');

    const observer = this.basesObservers.get(container);
    if (observer) {
      observer.disconnect();
    }
    this.basesObservers.delete(container);

    const state = this.basesListeners.get(container);
    if (state && Array.isArray(state.handlers)) {
      const basesRoot = container.querySelector('.bases-view') || container;
      for (const item of state.handlers) {
        basesRoot.removeEventListener(item.name, item.handler, true);
      }
    }

    const changed = state ? state.changed : [];
    for (const prev of changed) {
      try {
        const el = prev.el;
        if (!el) {
          continue;
        }
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (prev.kind === 'removeButton') {
          el.style.display = prev.display || '';
          el.style.width = prev.width || '';
          el.style.minWidth = prev.minWidth || '';
          el.style.margin = prev.margin || '';
          el.style.padding = prev.padding || '';
          el.style.overflow = prev.overflow || '';
          el.style.flex = prev.flex || '';
          el.style.pointerEvents = prev.pointerEvents || '';
        } else if (prev.kind === 'editorCell') {
          el.style.pointerEvents = prev.pointerEvents || '';
        }
      } catch (error) {}
    }

    this.basesListeners.delete(container);
    this.basesLocks.delete(view);
    if (persist) {
      await this.setPersistedLocked(view, false);
    }
    if (!silent) {
      new Notice(this.t('noticeLockDisabled'));
    }
    this.updateTitleButton();
  }
};

class LockBasesViewSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(this.plugin.t('settingLockCheckboxesName'))
      .setDesc(this.plugin.t('settingLockCheckboxesDesc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.shouldLockCheckboxes())
        .onChange(async (value) => {
          this.plugin.settings.lockCheckboxes = value;
          await this.plugin.saveSettings();
          await this.plugin.refreshOpenBasesLocks();
        }));
  }
}


