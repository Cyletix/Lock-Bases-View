import { App, getLanguage, Notice, Plugin, PluginSettingTab, setIcon, Setting, TAbstractFile, TFile, View } from 'obsidian';

interface LockBasesViewSettings {
  lockedBases: Record<string, boolean>;
  lockCheckboxes: boolean;
}

interface LockHandler {
  name: string;
  handler: EventListener;
}

interface LockState {
  processed: WeakSet<Element>;
  handlers: LockHandler[];
  observer?: MutationObserver;
}

interface LockOptions {
  silent?: boolean;
  persist?: boolean;
}

interface BasesView extends View {
  file?: TFile | null;
}

const DEFAULT_SETTINGS: LockBasesViewSettings = {
  lockedBases: {},
  lockCheckboxes: true,
};

const MAX_LOCKED_BASES = 128;

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
} as const;

type Locale = keyof typeof I18N;
type TranslationKey = keyof typeof I18N.en;

export default class LockBasesView extends Plugin {
  settings!: LockBasesViewSettings;
  basesObservers = new WeakMap<HTMLElement, MutationObserver>();
  basesListeners = new WeakMap<HTMLElement, LockState>();
  basesLocks = new WeakSet<BasesView>();
  embeddedObservers = new WeakMap<HTMLElement, MutationObserver>();
  embeddedListeners = new WeakMap<HTMLElement, LockState>();
  embeddedLocks = new WeakSet<HTMLElement>();

  getLocale(): Locale {
    const language = String(getLanguage() || 'en').toLowerCase();
    if (language.startsWith('zh')) {
      return 'zh';
    }
    if (language.startsWith('ja')) {
      return 'ja';
    }
    return 'en';
  }

  t(key: TranslationKey): string {
    const locale = this.getLocale();
    return I18N[locale]?.[key] || I18N.en[key] || key;
  }

  shouldLockCheckboxes(): boolean {
    return this.settings?.lockCheckboxes !== false;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  isCheckboxElement(el: unknown): el is Element {
    if (!el || !(el instanceof Element)) {
      return false;
    }
    if (el.closest('input[type="checkbox"], [role="checkbox"], .checkbox-container')) {
      return true;
    }
    const label = el.closest('label');
    return !!label?.querySelector('input[type="checkbox"], [role="checkbox"], .checkbox-container');
  }

  isCheckboxCell(el: Element | null | undefined): boolean {
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

  hasBlockedEditableContent(root: Element | null | undefined): boolean {
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

  getOpenBasesViews(): BasesView[] {
    const views: BasesView[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf?.view;
      if (!view || !this.isBasesView(view) || views.includes(view)) {
        return;
      }
      views.push(view);
    });
    return views;
  }

  async refreshOpenBasesLocks(): Promise<void> {
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
    await this.refreshEmbeddedBasesLocks();
    this.updateTitleButton();
  }

  async onload(): Promise<void> {
    this.basesObservers = new WeakMap<HTMLElement, MutationObserver>();
    this.basesListeners = new WeakMap<HTMLElement, LockState>();
    this.basesLocks = new WeakSet<BasesView>();
    this.embeddedObservers = new WeakMap<HTMLElement, MutationObserver>();
    this.embeddedListeners = new WeakMap<HTMLElement, LockState>();
    this.embeddedLocks = new WeakSet<HTMLElement>();

    const loaded = (await this.loadData()) as Partial<LockBasesViewSettings> | null;
    this.settings = {
      lockedBases: { ...DEFAULT_SETTINGS.lockedBases, ...(loaded?.lockedBases ?? {}) },
      lockCheckboxes: loaded?.lockCheckboxes ?? DEFAULT_SETTINGS.lockCheckboxes,
    };

    this.registerEvent(this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
      if (!oldPath || !this.settings?.lockedBases?.[oldPath]) {
        return;
      }
      this.settings.lockedBases[file.path] = this.settings.lockedBases[oldPath];
      delete this.settings.lockedBases[oldPath];
      await this.saveSettings();
    }));

    this.registerEvent(this.app.vault.on('delete', async (file: TAbstractFile) => {
      if (!file?.path || !this.settings?.lockedBases?.[file.path]) {
        return;
      }
      delete this.settings.lockedBases[file.path];
      await this.saveSettings();
    }));

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

    this.app.workspace.onLayoutReady(() => {
      void this.syncActiveBasesViewState();
    });
  }

  onunload(): void {
    for (const view of this.getOpenBasesViews()) {
      this.cleanupViewLock(view);
    }
    document.querySelectorAll('.internal-embed.bases-embed, .internal-embed.bases-embed.is-loaded').forEach((el) => {
      this.cleanupEmbeddedLock(el as HTMLElement);
    });
    document.querySelectorAll('.lock-bases-toolbar-item').forEach((el) => el.remove());
    this.basesObservers = new WeakMap<HTMLElement, MutationObserver>();
    this.basesListeners = new WeakMap<HTMLElement, LockState>();
    this.basesLocks = new WeakSet<BasesView>();
    this.embeddedObservers = new WeakMap<HTMLElement, MutationObserver>();
    this.embeddedListeners = new WeakMap<HTMLElement, LockState>();
    this.embeddedLocks = new WeakSet<HTMLElement>();
  }

  updateTitleButton(): void {
    const view = this.getActiveBasesView();
    if (!view || !view.containerEl || !this.isBasesView(view)) {
      return;
    }

    const toolbar = view.containerEl.querySelector('.bases-toolbar');
    if (!toolbar) {
      return;
    }

    const existingBtn = toolbar.querySelector<HTMLElement>('.lock-bases-btn');
    if (existingBtn instanceof HTMLElement) {
      this.updateToolbarButtonState(existingBtn, this.isActuallyLocked(view.containerEl));
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
    this.updateToolbarButtonState(btn, this.isActuallyLocked(view.containerEl));

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

  getBasesKey(view: BasesView | null | undefined): string | null {
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
    return null;
  }

  isPersistedLocked(view: BasesView): boolean {
    const key = this.getBasesKey(view);
    if (!key) {
      return false;
    }
    return !!(this.settings && this.settings.lockedBases && this.settings.lockedBases[key]);
  }

  async setPersistedLocked(view: BasesView, locked: boolean): Promise<void> {
    const key = this.getBasesKey(view);
    if (!key) {
      return;
    }
    await this.setPersistedLockedKey(key, locked);
  }

  async setPersistedLockedKey(key: string, locked: boolean): Promise<void> {
    if (!this.settings) {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    if (!this.settings.lockedBases) {
      this.settings.lockedBases = {};
    }

    if (locked) {
      delete this.settings.lockedBases[key];
      this.settings.lockedBases[key] = true;

      const keys = Object.keys(this.settings.lockedBases);
      if (keys.length > MAX_LOCKED_BASES) {
        delete this.settings.lockedBases[keys[0]];
      }
    } else {
      delete this.settings.lockedBases[key];
    }

    await this.saveSettings();
  }

  syncActiveBasesViewState(): void {
    const view = this.getActiveBasesView();
    if (view && this.isBasesView(view)) {
      if (this.isPersistedLocked(view)) {
        if (!this.basesLocks.has(view)) {
          void this.lockBases(view, { silent: true, persist: false });
        }
      } else if (this.basesLocks.has(view)) {
        void this.unlockBases(view, { silent: true, persist: false });
      }
    }
    void this.refreshEmbeddedBasesLocks();
    this.updateTitleButton();
  }

  async refreshEmbeddedBasesLocks(): Promise<void> {
    const roots = this.getEmbeddedBasesRoots();
    for (const root of roots) {
      const key = this.getEmbeddedBasesKey(root);
      if (!key) {
        continue;
      }
      if (this.isPersistedLockedKey(key)) {
        if (!this.embeddedLocks.has(root)) {
          await this.lockEmbeddedBases(root, key, { silent: true, persist: false });
        }
      } else if (this.embeddedLocks.has(root)) {
        await this.unlockEmbeddedBases(root, key, { silent: true, persist: false });
      }
    }
    this.updateEmbeddedToolbarButtons();
  }

  getEmbeddedBasesRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.internal-embed.bases-embed.is-loaded, .internal-embed.bases-embed'));
  }

  getEmbeddedBasesKey(root: HTMLElement | null | undefined): string | null {
    if (!root) {
      return null;
    }
    const src = root.getAttribute('src') || root.getAttribute('alt');
    if (!src) {
      return null;
    }
    return /\.base$/i.test(src) ? src : null;
  }

  isPersistedLockedKey(key: string): boolean {
    return !!(this.settings && this.settings.lockedBases && this.settings.lockedBases[key]);
  }

  isActuallyLocked(root: Element | null | undefined): boolean {
    if (!root || !(root instanceof Element)) {
      return false;
    }
    return root.classList.contains('lock-bases-view-locked') || !!root.querySelector('.lock-bases-editor-cell-disabled');
  }

  updateEmbeddedToolbarButtons(): void {
    const roots = this.getEmbeddedBasesRoots();
    for (const root of roots) {
      const key = this.getEmbeddedBasesKey(root);
      if (!key) {
        continue;
      }
      const toolbar = root.querySelector('.bases-toolbar');
      if (!toolbar) {
        continue;
      }
      const existingBtn = toolbar.querySelector<HTMLElement>('.lock-bases-btn');
      const isLocked = this.isActuallyLocked(root);
      if (existingBtn instanceof HTMLElement) {
        this.updateToolbarButtonState(existingBtn, isLocked);
        continue;
      }

      const item = document.createElement('div');
      item.className = 'bases-toolbar-item lock-bases-toolbar-item';

      const btn = document.createElement('div');
      btn.className = 'text-icon-button lock-bases-btn';
      btn.tabIndex = 0;

      const icon = document.createElement('span');
      icon.className = 'text-button-icon';
      btn.appendChild(icon);
      this.updateToolbarButtonState(btn, isLocked);

      const triggerToggle = () => {
        const locked = this.isActuallyLocked(root);
        void (locked ? this.unlockEmbeddedBases(root, key) : this.lockEmbeddedBases(root, key));
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
  }

  async lockEmbeddedBases(root: HTMLElement, key: string, options: LockOptions = {}): Promise<void> {
    const { silent = false, persist = true } = options;
    const basesRoot = root.querySelector<HTMLElement>('.bases-view') || root;
    if (!root) {
      return;
    }

    root.classList.add('lock-bases-view-locked');

    const state: LockState = {
      processed: new WeakSet(),
      handlers: [],
    };

    this.applyLockDecorations(basesRoot, state);
    this.releaseEditableFocus(basesRoot);

    const stopEvent: EventListener = (event: Event) => {
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
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.applyLockDecorations(node, state);
        }
      }
    });

    state.observer = observer;
    observer.observe(basesRoot, { childList: true, subtree: true });
    this.embeddedObservers.set(root, observer);
    this.embeddedListeners.set(root, state);
    this.embeddedLocks.add(root);
    if (persist) {
      await this.setPersistedLockedKey(key, true);
      await this.refreshOpenBasesLocks();
      await this.refreshEmbeddedBasesLocks();
    }
    if (!silent) {
      new Notice(this.t('noticeLockEnabled'));
    }
    this.updateEmbeddedToolbarButtons();
  }

  cleanupEmbeddedLock(root: HTMLElement | null | undefined): void {
    if (!root) {
      return;
    }

    root.classList.remove('lock-bases-view-locked');

    const observer = this.embeddedObservers.get(root);
    if (observer) {
      observer.disconnect();
    }
    this.embeddedObservers.delete(root);

    const state = this.embeddedListeners.get(root);
    if (state && Array.isArray(state.handlers)) {
      const basesRoot = root.querySelector<HTMLElement>('.bases-view') || root;
      for (const item of state.handlers) {
        basesRoot.removeEventListener(item.name, item.handler, true);
      }
    }

    const lockedCells = root.querySelectorAll('.lock-bases-editor-cell-disabled');
    lockedCells.forEach((cell) => {
      cell.classList.remove('lock-bases-editor-cell-disabled');
    });

    this.embeddedListeners.delete(root);
    this.embeddedLocks.delete(root);
    this.updateEmbeddedToolbarButtons();
  }

  async unlockEmbeddedBases(root: HTMLElement, key: string, options: LockOptions = {}): Promise<void> {
    const { silent = false, persist = true } = options;
    this.cleanupEmbeddedLock(root);
    if (persist) {
      await this.setPersistedLockedKey(key, false);
      await this.refreshOpenBasesLocks();
      await this.refreshEmbeddedBasesLocks();
    }
    if (!silent) {
      new Notice(this.t('noticeLockDisabled'));
    }
    this.updateEmbeddedToolbarButtons();
  }

  updateToolbarButtonState(button: HTMLElement, isLocked: boolean): void {
    const icon = button.querySelector<HTMLElement>('.text-button-icon');
    if (icon) {
      icon.replaceChildren();
      setIcon(icon, isLocked ? 'lock' : 'lock-open');
    }
    const label = isLocked ? this.t('basesViewLocked') : this.t('basesViewUnlocked');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.classList.toggle('is-active', isLocked);
  }

  getActiveBasesView(): BasesView | null {
    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    if (recentLeaf?.view && this.isBasesView(recentLeaf.view)) {
      return recentLeaf.view;
    }

    return this.getOpenBasesViews()[0] || null;
  }

  isBasesView(view: View | null | undefined): view is BasesView {
    if (!view?.containerEl) {
      return false;
    }
    try {
      if (typeof view.getViewType === 'function') {
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
    } catch (error) {
      void error;
      return false;
    }
    return false;
  }

  async toggleBasesLock(view: BasesView): Promise<void> {
    if (this.basesLocks.has(view)) {
      await this.unlockBases(view);
    } else {
      await this.lockBases(view);
    }
  }

  isEditableElement(el: EventTarget | null): boolean {
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

  releaseEditableFocus(basesRoot: Element, target?: EventTarget | null): void {
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
    } catch (error) {
      void error;
    }
    try {
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
    } catch (error) {
      void error;
    }
  }

  applyLockDecorations(root: Element, state: LockState): void {
    if (!root || !state) {
      return;
    }

    const remember = (el: Element) => {
      if (!el || state.processed.has(el)) {
        return;
      }
      state.processed.add(el);
    };

    const editorCells = Array.from(root.querySelectorAll('.bases-table-cell:not(.bases-rendered-value)'));
    for (const cell of editorCells) {
      if (!this.shouldLockCheckboxes() && this.isCheckboxCell(cell)) {
        continue;
      }
      if (!this.hasBlockedEditableContent(cell)) {
        continue;
      }
      remember(cell);
      cell.classList.add('lock-bases-editor-cell-disabled');
    }

  }

  async lockBases(view: BasesView, options: LockOptions = {}): Promise<void> {
    const { silent = false, persist = true } = options;
    const container = view.containerEl;
    if (!container) {
      return;
    }

    container.classList.add('lock-bases-view-locked');
    const basesRoot = container.querySelector<HTMLElement>('.bases-view') || container;

    const state: LockState = {
      processed: new WeakSet(),
      handlers: [],
    };

    this.applyLockDecorations(basesRoot, state);
    this.releaseEditableFocus(basesRoot);

    const stopEvent: EventListener = (event: Event) => {
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
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) {
            continue;
          }
          this.applyLockDecorations(node, state);
        }
      }
    });

    state.observer = observer;
    observer.observe(basesRoot, { childList: true, subtree: true });
    this.basesObservers.set(container, observer);
    this.basesListeners.set(container, state);
    this.basesLocks.add(view);
    if (persist) {
      await this.setPersistedLocked(view, true);
      await this.refreshEmbeddedBasesLocks();
    }
    if (!silent) {
      new Notice(this.t('noticeLockEnabled'));
    }
    this.updateTitleButton();
  }

  cleanupViewLock(view: BasesView | null | undefined): void {
    const container = view?.containerEl;
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
      const basesRoot = container.querySelector<HTMLElement>('.bases-view') || container;
      for (const item of state.handlers) {
        basesRoot.removeEventListener(item.name, item.handler, true);
      }
    }

    const lockedCells = container.querySelectorAll('.lock-bases-editor-cell-disabled');
    lockedCells.forEach((cell) => {
      cell.classList.remove('lock-bases-editor-cell-disabled');
    });

    this.basesListeners.delete(container);
    this.basesLocks.delete(view);
    this.updateTitleButton();
  }

  async unlockBases(view: BasesView, options: LockOptions = {}): Promise<void> {
    const { silent = false, persist = true } = options;
    if (!view?.containerEl) {
      return;
    }
    this.cleanupViewLock(view);
    if (persist) {
      await this.setPersistedLocked(view, false);
      await this.refreshEmbeddedBasesLocks();
    }
    if (!silent) {
      new Notice(this.t('noticeLockDisabled'));
    }
    this.updateTitleButton();
  }
};

class LockBasesViewSettingTab extends PluginSettingTab {
  plugin: LockBasesView;

  constructor(app: App, plugin: LockBasesView) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
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
