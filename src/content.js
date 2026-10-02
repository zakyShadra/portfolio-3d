// Real portfolio content, pulled from ~/Projects/scroll-portfolio (main.js /
// index.html) so the world isn't full of lorem ipsum placeholders.

export const ABOUT = {
  id: 'about',
  kind: 'about',
  title: 'Zaky Shadra Ibnu Hibban',
  subtitle: 'Software Engineer — Jakarta, Indonesia',
  body: 'I build local-first AI agents, automation bots and small tools that run close to the metal — no cloud required to be useful. I care about software that keeps working when the network is gone.',
  facts: ['Based in Jakarta, Indonesia', 'Timezone WIB (UTC+7)', 'Focus: AI agents · automation · tooling'],
};

export const CONTACT = {
  id: 'contact',
  kind: 'contact',
  title: 'Contact',
  subtitle: 'Open to new projects and collaboration',
  body: 'The fastest way to reach me is email — or find the code on GitHub.',
  links: [
    { label: 'Email', href: 'mailto:zakyshadra@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/zakyShadra' },
  ],
};

export const PROJECTS = [
  {
    id: 'ice', kind: 'project', index: '01', title: 'ICE', tags: ['Python', 'Ollama', 'SQLite'],
    body: 'A local-first coding agent that asks before it touches your system.',
  },
  {
    id: 'telegram-bot', kind: 'project', index: '02', title: 'Telegram Assistant Bot', tags: ['Java 17', 'Docker'],
    body: 'The one that is actually running in production.',
  },
  {
    id: 'ices-mail', kind: 'project', index: '03', title: 'Ices Mail', tags: ['TypeScript', 'Workers', 'D1'],
    body: 'Disposable email that you can promote to permanent.',
  },
  {
    id: 'signal-90', kind: 'project', index: '04', title: 'SIGNAL/90', tags: ['Vanilla JS', 'localStorage'],
    body: 'A 99-day security curriculum you answer your way through.',
  },
  {
    id: 'myosai', kind: 'project', index: '05', title: 'MYOSAI', tags: ['Python', 'Whisper', 'Tkinter'],
    body: 'A desktop assistant where the model is a swappable part.',
  },
  {
    id: 'browser-cli', kind: 'project', index: '06', title: 'browser-cli', tags: ['Python', 'curses'],
    body: 'A browser that lives in a terminal and parses HTML itself.',
  },
  {
    id: 'terminal-games', kind: 'project', index: '07', title: 'Terminal Games', tags: ['Python', 'stdlib'],
    body: 'Eleven games, standard library only.',
  },
];

// Fixed order used everywhere positions/arrows need to agree.
export const ALL_POINTS = [ABOUT, ...PROJECTS, CONTACT];
