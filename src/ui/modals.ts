/**
 * DOM pop-ups shared by every scene: generic modal, interviews, exhibits,
 * game intro cards, and the post-game debrief.
 */
import { speech } from '../speech';
import { audio } from '../audio';

export type Accent = 'gold' | 'pink' | 'cyan' | 'violet' | 'teal' | 'red';

let current: HTMLElement | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let onCloseCb: (() => void) | null = null;

export interface ModalOptions {
  kicker?: string;
  title: string;
  body: string;
  actions?: { label: string; kind?: 'primary' | 'ghost'; onClick: () => void; key?: string }[];
  className?: string;
  accent?: Accent;
  /** Close when clicking the dimmed background. Default true. */
  dismissable?: boolean;
  onMount?: (el: HTMLElement) => void;
  onClose?: () => void;
}

export function isModalOpen(): boolean {
  return current !== null;
}

export function showModal(opts: ModalOptions): void {
  closeModal();
  const root = document.getElementById('modal-root');
  if (!root) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal accent-${opts.accent ?? 'gold'} ${opts.className ?? ''}" role="dialog" aria-modal="true">
      ${opts.kicker ? `<div class="modal-kicker">${opts.kicker}</div>` : ''}
      <h3>${opts.title}</h3>
      <div class="modal-body">${opts.body}</div>
      ${opts.actions?.length ? '<div class="modal-actions"></div>' : ''}
    </div>
  `;

  const keyMap = new Map<string, () => void>();
  if (opts.actions?.length) {
    const actionsEl = backdrop.querySelector('.modal-actions') as HTMLElement;
    for (const a of opts.actions) {
      const btn = document.createElement('button');
      btn.className = `btn btn-${a.kind ?? 'primary'}`;
      btn.innerHTML = a.key ? `${a.label} <kbd>${a.key}</kbd>` : a.label;
      btn.addEventListener('click', () => { audio.sfx('click'); a.onClick(); });
      actionsEl.appendChild(btn);
      if (a.key) keyMap.set(a.key.toLowerCase(), a.onClick);
    }
  }

  if (opts.dismissable !== false) {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  }

  keyHandler = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const name = k === ' ' ? 'space' : k;
    if (keyMap.has(name)) { e.preventDefault(); e.stopPropagation(); keyMap.get(name)!(); return; }
    if (k === 'escape' && opts.dismissable !== false) { e.stopPropagation(); closeModal(); }
  };
  // Capture so Phaser's window listeners don't also see these keys
  window.addEventListener('keydown', keyHandler, true);

  root.appendChild(backdrop);
  current = backdrop;
  onCloseCb = opts.onClose ?? null;
  audio.sfx('open');
  if (opts.onMount) requestAnimationFrame(() => opts.onMount!(backdrop));
}

export function closeModal(): void {
  speech.stop();
  if (keyHandler) window.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
  if (current?.parentNode) current.parentNode.removeChild(current);
  const had = current !== null;
  current = null;
  const cb = onCloseCb;
  onCloseCb = null;
  if (had && cb) cb();
}

/* ------------------------------------------------------------------ */
/* Interviews                                                          */
/* ------------------------------------------------------------------ */

export interface InterviewOptions {
  name: string;
  role: string;
  where?: string;
  accent?: Accent;
  /** Data URL of the character portrait. */
  portrait?: string;
  questions: { q: string; a: string; takeaway?: string; codes?: string[] }[];
  onClose?: () => void;
}

export function showDialogue(opts: InterviewOptions): void {
  const body = `
    <div class="dialogue-header">
      <div class="dialogue-avatar" ${opts.portrait ? `style="background-image:url(${opts.portrait})"` : ''}>${opts.portrait ? '' : opts.name.charAt(0)}</div>
      <div class="dialogue-meta">
        <div class="dialogue-name">${opts.name}</div>
        <div class="dialogue-role">${opts.role}</div>
        ${opts.where ? `<div class="dialogue-where">${opts.where}</div>` : ''}
      </div>
    </div>
    <div class="dialogue-body">
      <div class="dialogue-questions">
        <div class="dialogue-section-title">ASK · PRESS 1–${opts.questions.length}</div>
        <div class="question-list">
          ${opts.questions.map((item, i) => `
            <button class="question-btn" data-idx="${i}">
              <span class="question-num">${i + 1}</span>
              <span>${item.q}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="dialogue-response">
        <p class="response-prompt" id="response-text">Pick a question to hear ${opts.name.split(' ')[0]}'s answer.</p>
        <div id="response-extra"></div>
        <div class="dialogue-footer">
          ${speech.supported() ? `<button class="voice-toggle" id="voice-toggle" type="button"></button>` : '<span></span>'}
          <button class="btn btn-ghost" id="dialogue-done">Done <kbd>ESC</kbd></button>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: '',
    body,
    accent: opts.accent,
    className: 'dialogue-modal',
    onClose: opts.onClose,
    onMount: (el) => {
      const btns = Array.from(el.querySelectorAll<HTMLButtonElement>('.question-btn'));
      const responseText = el.querySelector('#response-text') as HTMLElement;
      const extra = el.querySelector('#response-extra') as HTMLElement;
      const voiceBtn = el.querySelector('#voice-toggle') as HTMLButtonElement | null;
      let revealTimer: number | null = null;
      let lastIdx = -1;

      el.querySelector('#dialogue-done')?.addEventListener('click', closeModal);

      const paintVoice = () => { if (voiceBtn) voiceBtn.textContent = speech.enabled() ? '🔊 Voice on' : '🔇 Voice off'; };
      paintVoice();
      voiceBtn?.addEventListener('click', () => {
        speech.setEnabled(!speech.enabled());
        paintVoice();
        if (speech.enabled() && lastIdx >= 0) ask(lastIdx);
      });

      const ask = (idx: number) => {
        const item = opts.questions[idx];
        if (!item) return;
        lastIdx = idx;
        audio.sfx('click');
        btns.forEach(b => b.classList.remove('active'));
        btns[idx].classList.add('active', 'asked');

        // Words fade in, roughly in step with the voice
        const words = item.a.split(/(\s+)/);
        responseText.className = 'response-text';
        responseText.innerHTML = '“' + words.map(w => /\s+/.test(w) ? w : `<span class="word">${w}</span>`).join('') + '”';
        const spans = Array.from(responseText.querySelectorAll<HTMLElement>('.word'));
        extra.innerHTML = '';
        if (revealTimer) window.clearInterval(revealTimer);
        let shown = 0;
        const showUpTo = (n: number) => { for (; shown < Math.min(n, spans.length); shown++) spans[shown].classList.add('on'); };
        const finish = () => {
          showUpTo(spans.length);
          if (revealTimer) window.clearInterval(revealTimer);
          revealTimer = null;
          if (item.takeaway) extra.innerHTML = `<div class="response-takeaway"><b>WHAT THIS SHOWS</b>${item.takeaway}</div>`;
          if (item.codes?.length) extra.innerHTML += `<div class="code-tags">${item.codes.map(c => `<span class="code-tag">${c}</span>`).join('')}</div>`;
        };

        const speaking = speech.enabled();
        const msPerWord = speaking ? 330 : 28;
        revealTimer = window.setInterval(() => { showUpTo(shown + 1); if (shown >= spans.length) finish(); }, msPerWord);
        if (speaking) speech.speak(item.a, opts.name, { onEnd: finish });
      };

      btns.forEach((btn, i) => btn.addEventListener('click', () => ask(i)));

      // Number keys pick questions
      const numKeys = (e: KeyboardEvent) => {
        if (!current) { window.removeEventListener('keydown', numKeys, true); return; }
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= opts.questions.length) { e.preventDefault(); e.stopPropagation(); ask(n - 1); }
      };
      window.addEventListener('keydown', numKeys, true);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Exhibits                                                            */
/* ------------------------------------------------------------------ */

export function showExhibit(opts: {
  kicker?: string;
  title: string;
  accent?: Accent;
  tabs: { id: string; label: string; content: string }[];
  onClose?: () => void;
}): void {
  const body = `
    ${opts.tabs.length > 1 ? `<div class="exhibit-tabs">
      ${opts.tabs.map((t, i) => `<button class="exhibit-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>` : ''}
    <div class="exhibit-panels">
      ${opts.tabs.map((t, i) => `<div class="exhibit-panel ${i === 0 ? 'active' : ''}" id="panel-${t.id}">${t.content}</div>`).join('')}
    </div>
  `;

  showModal({
    kicker: opts.kicker ?? 'EXHIBIT',
    title: opts.title,
    body,
    accent: opts.accent,
    className: 'exhibit-modal',
    onClose: opts.onClose,
    onMount: (el) => {
      const tabs = Array.from(el.querySelectorAll<HTMLElement>('.exhibit-tab'));
      const panels = el.querySelectorAll('.exhibit-panel');
      tabs.forEach(tab => tab.addEventListener('click', () => {
        audio.sfx('click');
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        el.querySelector(`#panel-${tab.dataset.tab}`)?.classList.add('active');
      }));
    },
    actions: [{ label: 'Close', kind: 'ghost', key: 'Esc', onClick: closeModal }],
  });
}

/* ------------------------------------------------------------------ */
/* Game intro card                                                     */
/* ------------------------------------------------------------------ */

export interface GameIntro {
  number: string;          // '01'
  genre: string;           // 'MOBA'
  title: string;           // 'Battle Arena'
  realWorld: string;       // 'Modelled on Honor of Kings'
  pitch: string;           // One sentence: what the visitor will feel and why it matters
  controls: [string, string][]; // [['WASD', 'Move'], ...]
  goal: string;
  accent: Accent;
}

export function showGameIntro(intro: GameIntro, onStart: () => void, onCancel?: () => void): void {
  showModal({
    kicker: `CABINET ${intro.number} · ${intro.genre}`,
    title: intro.title,
    accent: intro.accent,
    className: 'intro-modal',
    onClose: onCancel,
    body: `
      <p class="intro-pitch">${intro.pitch}</p>
      <p class="intro-real">${intro.realWorld}</p>
      <div class="intro-grid">
        <div class="intro-box">
          <h4>Controls</h4>
          ${intro.controls.map(([k, v]) => `<div class="control-row"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}
        </div>
        <div class="intro-box">
          <h4>Goal</h4>
          <p>${intro.goal}</p>
        </div>
      </div>
    `,
    actions: [
      { label: 'Back', kind: 'ghost', key: 'Esc', onClick: closeModal },
      { label: 'Insert coin ▶', key: 'Enter', onClick: () => { onCloseCb = null; closeModal(); onStart(); } },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Debrief: the visitor's run next to the fieldwork finding           */
/* ------------------------------------------------------------------ */

export interface Debrief {
  outcome: 'win' | 'lose';
  kicker: string;              // 'BATTLE ARENA · VICTORY'
  title: string;               // 'Tower down!'
  stats: { label: string; value: string }[];
  /** One or two sentences about what the visitor just did, in their terms. */
  felt: string;
  /** Fieldwork evidence that matches the feeling. */
  finding: { quote: string; who: string; point: string };
  onReplay: () => void;
  onExit: () => void;
  /** Label for the replay button. Default 'Play again'. */
  replayLabel?: string;
}

export function showDebrief(d: Debrief): void {
  audio.sfx(d.outcome === 'win' ? 'win' : 'lose');
  showModal({
    kicker: d.kicker,
    title: d.title,
    className: 'debrief-modal',
    accent: d.outcome === 'win' ? 'teal' : 'red',
    dismissable: false,
    body: `
      <div class="debrief-grid">
        <div class="debrief-col">
          <h4>Your run</h4>
          <div class="debrief-stats">
            ${d.stats.map(s => `<div class="debrief-stat"><div class="v">${s.value}</div><div class="l">${s.label}</div></div>`).join('')}
          </div>
          <p class="debrief-felt">${d.felt}</p>
        </div>
        <div class="debrief-col">
          <h4>In the field</h4>
          <p class="debrief-quote">“${d.finding.quote}”</p>
          <p class="debrief-who">${d.finding.who}</p>
          <p class="debrief-point">${d.finding.point}</p>
        </div>
      </div>
    `,
    actions: [
      { label: d.replayLabel ?? 'Play again', kind: 'ghost', key: 'R', onClick: () => { closeModal(); d.onReplay(); } },
      { label: 'Back to the museum', key: 'Enter', onClick: () => { closeModal(); d.onExit(); } },
    ],
  });
}
