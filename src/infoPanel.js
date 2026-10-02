const KIND_LABEL = { about: 'About', project: 'Project', contact: 'Contact' };

export function createInfoPanel() {
  const panel = document.getElementById('info-panel');
  const kicker = document.getElementById('panel-kicker');
  const title = document.getElementById('panel-title');
  const meta = document.getElementById('panel-meta');
  const body = document.getElementById('panel-body');
  const links = document.getElementById('panel-links');

  let currentId = null;

  function show(data) {
    if (currentId === data.id) return;
    currentId = data.id;

    kicker.textContent = KIND_LABEL[data.kind] ?? '';
    title.textContent = data.kind === 'project' ? `${data.index} — ${data.title}` : data.title;
    meta.textContent = data.tags ? data.tags.join(' · ') : (data.subtitle ?? '');
    body.textContent = data.body;

    links.innerHTML = '';
    (data.links ?? []).forEach(({ label, href }) => {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `${label} ↗`;
      links.appendChild(a);
    });
    if (data.facts) {
      const ul = document.createElement('ul');
      data.facts.forEach((f) => {
        const li = document.createElement('li');
        li.textContent = f;
        ul.appendChild(li);
      });
      links.appendChild(ul);
    }

    panel.classList.add('visible');
  }

  function hide() {
    if (currentId === null) return;
    currentId = null;
    panel.classList.remove('visible');
  }

  return { show, hide };
}
