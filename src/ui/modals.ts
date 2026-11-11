/**
 * Simple modal system - all game modals use this
 */

let current: HTMLElement | null = null;

export interface ModalOptions {
  kicker?: string;
  title: string;
  body: string;
  actions?: { label: string; kind?: 'primary' | 'ghost'; onClick: () => void }[];
  className?: string;
  onMount?: (el: HTMLElement) => void;
}

export function showModal(opts: ModalOptions): void {
  closeModal();

  const root = document.getElementById('modal-root');
  if (!root) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${opts.className || ''}" role="dialog">
      ${opts.kicker ? `<div class="modal-kicker">${opts.kicker}</div>` : ''}
      <h3>${opts.title}</h3>
      <div class="modal-body">${opts.body}</div>
      ${opts.actions?.length ? '<div class="modal-actions"></div>' : ''}
    </div>
  `;

  // Wire up action buttons
  if (opts.actions?.length) {
    const actionsEl = backdrop.querySelector('.modal-actions') as HTMLElement;
    for (const a of opts.actions) {
      const btn = document.createElement('button');
      btn.className = `btn btn-${a.kind || 'primary'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => a.onClick());
      actionsEl.appendChild(btn);
    }
  }

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  root.appendChild(backdrop);
  current = backdrop;

  // Call onMount after DOM is ready
  if (opts.onMount) {
    requestAnimationFrame(() => opts.onMount!(backdrop));
  }
}

export function closeModal(): void {
  if (current && current.parentNode) {
    current.parentNode.removeChild(current);
  }
  current = null;
}

/**
 * Show NPC dialogue modal
 */
export function showDialogue(opts: {
  name: string;
  role: string;
  portrait: 'warm' | 'cool' | 'violet';
  questions: { q: string; a: string; codes?: string[] }[];
}): void {
  const body = `
    <div class="dialogue-header">
      <div class="dialogue-avatar ${opts.portrait}">${opts.name.charAt(0)}</div>
      <div class="dialogue-meta">
        <div class="dialogue-name">${opts.name}</div>
        <div class="dialogue-role">${opts.role}</div>
      </div>
    </div>
    <div class="dialogue-body">
      <div class="dialogue-questions">
        <div class="dialogue-section-title">ASK</div>
        <div class="question-list">
          ${opts.questions.map((item, i) => `
            <button class="question-btn" data-idx="${i}">
              <span class="question-num">${String(i + 1).padStart(2, '0')}</span>
              <span>${item.q}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="dialogue-response">
        <div class="dialogue-section-title">RESPONSE</div>
        <p class="response-prompt" id="response-text">Select a question above.</p>
        <div class="code-tags" id="response-codes"></div>
      </div>
    </div>
  `;

  showModal({
    title: '',
    body,
    className: 'dialogue-modal',
    onMount: (el) => {
      const questions = opts.questions;
      const btns = el.querySelectorAll('.question-btn');
      const responseText = el.querySelector('#response-text') as HTMLElement;
      const responseCodes = el.querySelector('#response-codes') as HTMLElement;

      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
          const item = questions[idx];

          responseText.className = 'response-text';
          responseText.textContent = `"${item.a}"`;

          if (item.codes?.length) {
            responseCodes.innerHTML = item.codes.map(c => `<span class="code-tag">${c}</span>`).join('');
          } else {
            responseCodes.innerHTML = '';
          }
        });
      });
    },
    actions: [{ label: 'Done', kind: 'ghost', onClick: closeModal }],
  });
}

/**
 * Show exhibit modal with tabs
 */
export function showExhibit(opts: {
  title: string;
  tabs: { id: string; label: string; content: string }[];
}): void {
  const body = `
    <div class="exhibit-tabs">
      ${opts.tabs.map((t, i) => `
        <button class="exhibit-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
      `).join('')}
    </div>
    <div class="exhibit-panels">
      ${opts.tabs.map((t, i) => `
        <div class="exhibit-panel ${i === 0 ? 'active' : ''}" id="panel-${t.id}">${t.content}</div>
      `).join('')}
    </div>
  `;

  showModal({
    kicker: 'RESEARCH EXHIBIT',
    title: opts.title,
    body,
    className: 'exhibit-modal',
    onMount: (el) => {
      const tabs = el.querySelectorAll('.exhibit-tab');
      const panels = el.querySelectorAll('.exhibit-panel');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          panels.forEach(p => p.classList.remove('active'));
          tab.classList.add('active');

          const id = (tab as HTMLElement).dataset.tab;
          const panel = el.querySelector(`#panel-${id}`);
          if (panel) panel.classList.add('active');
        });
      });
    },
    actions: [{ label: 'Close', kind: 'ghost', onClick: closeModal }],
  });
}

/**
 * Show game intro modal
 */
export function showGameIntro(opts: {
  game: 'battle' | 'realm' | 'frontier';
  onStart: () => void;
}): void {
  const intros: Record<string, { kicker: string; title: string; controls: string; goal: string }> = {
    battle: {
      kicker: '01 / MOBA',
      title: 'Battle Arena',
      controls: '<b>WASD</b> move · <b>SPACE</b> attack · <b>J</b> special (5s CD)',
      goal: 'Destroy the enemy tower before they destroy yours. Minions spawn from the top.',
    },
    realm: {
      kicker: '02 / RPG',
      title: 'Lost Realm',
      controls: '<b>WASD</b> move · <b>SPACE</b> attack · <b>E</b> interact',
      goal: 'Collect 3 elemental shards to awaken the guardian, then defeat it.',
    },
    frontier: {
      kicker: '03 / SLG',
      title: 'Frontier Settlement',
      controls: 'Click to assign workers, build structures, and manage resources.',
      goal: 'Survive 3 raid waves. Balance food, wood, and stone to keep your settlement alive.',
    },
  };

  const info = intros[opts.game];

  showModal({
    kicker: info.kicker,
    title: info.title,
    body: `
      <h4>Controls</h4>
      <p>${info.controls}</p>
      <h4>Objective</h4>
      <p>${info.goal}</p>
    `,
    actions: [
      { label: 'Start Game', onClick: opts.onStart },
      { label: 'Cancel', kind: 'ghost', onClick: closeModal },
    ],
  });
}
