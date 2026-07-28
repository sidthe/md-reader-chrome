// GitHub-parity markdown rendering. Factory-injected deps so node tests pass
// npm packages while the extension passes the vendored UMD globals.

const ALERT_TYPES = {
  note: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  tip: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  important: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  warning: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  caution: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
};

const LINK_ICON_PATH = 'm7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z';

function octicon(path, cls) {
  return `<svg class="octicon ${cls}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"></path></svg>`;
}

// GitHub-style heading slugs: lowercase, drop punctuation, spaces to hyphens,
// duplicate slugs get -1, -2, ... suffixes.
export function createSlugger() {
  const seen = new Map();
  return (text) => {
    let slug = text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-');
    const n = seen.get(slug);
    seen.set(slug, (n || 0) + 1);
    if (n) slug = `${slug}-${n}`;
    return slug;
  };
}

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/;

// Core rule: transform `> [!NOTE]` blockquotes into GitHub's
// <div class="markdown-alert markdown-alert-note"> with a title row.
function alertRule(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue;
    // First inline token inside this blockquote decides whether it's an alert.
    let j = i + 1;
    while (j < tokens.length && tokens[j].type !== 'inline' && tokens[j].type !== 'blockquote_close') j++;
    if (j >= tokens.length || tokens[j].type !== 'inline') continue;
    const inline = tokens[j];
    const firstLine = inline.content.split('\n', 1)[0];
    const m = firstLine.match(ALERT_RE);
    if (!m) continue;

    const type = m[1].toLowerCase();
    const title = m[1][0] + m[1].slice(1).toLowerCase();

    // Strip the marker line from the inline token (and its child tokens).
    inline.content = inline.content.split('\n').slice(1).join('\n');
    if (inline.children) {
      let cut = 0;
      while (cut < inline.children.length && inline.children[cut].type !== 'softbreak') cut++;
      inline.children = inline.children.slice(cut + 1);
    }

    // Find the matching close (blockquotes can nest).
    let depth = 0;
    let close = i;
    for (let k = i; k < tokens.length; k++) {
      if (tokens[k].type === 'blockquote_open') depth++;
      if (tokens[k].type === 'blockquote_close' && --depth === 0) {
        close = k;
        break;
      }
    }

    tokens[i].type = 'alert_open';
    tokens[i].tag = 'div';
    tokens[i].attrSet('class', `markdown-alert markdown-alert-${type}`);
    tokens[close].type = 'alert_close';
    tokens[close].tag = 'div';

    const titleTok = new state.Token('html_block', '', 0);
    titleTok.content = `<p class="markdown-alert-title">${octicon(ALERT_TYPES[type], `octicon-${type}`)}${title}</p>\n`;
    tokens.splice(i + 1, 0, titleTok);

    // If the marker was the whole first paragraph, drop the now-empty paragraph.
    const p = i + 2;
    if (
      tokens[p]?.type === 'paragraph_open' &&
      tokens[p + 1]?.type === 'inline' &&
      tokens[p + 1].content === '' &&
      (!tokens[p + 1].children || tokens[p + 1].children.length === 0) &&
      tokens[p + 2]?.type === 'paragraph_close'
    ) {
      tokens.splice(p, 3);
    }
  }
}

// Core rule: give each heading a GitHub-style id + hover anchor link.
// Ids get GitHub's `user-content-` prefix — it also keeps DOMPurify's
// DOM-clobbering protection from stripping ids like "title".
function headingAnchorRule(state) {
  const slugger = createSlugger();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    if (!inline || inline.type !== 'inline') continue;
    const slug = slugger(inline.content);
    tokens[i].attrSet('id', `user-content-${slug}`);
    const anchor = new state.Token('html_inline', '', 0);
    anchor.content = `<a class="anchor" href="#${slug}" aria-hidden="true">${octicon(LINK_ICON_PATH, 'octicon-link')}</a>`;
    inline.children = [anchor, ...(inline.children || [])];
  }
}

export function createRenderer({ markdownit, taskLists, hljs, DOMPurify }) {
  const md = markdownit({
    html: true,
    linkify: true,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        } catch {
          /* fall through to escaped output */
        }
      }
      return ''; // markdown-it escapes the code itself
    },
  });
  md.use(taskLists, { label: false });
  md.core.ruler.push('github_alerts', alertRule);
  md.core.ruler.push('heading_anchors', headingAnchorRule);

  return {
    render(text) {
      return DOMPurify.sanitize(md.render(text), {
        USE_PROFILES: { html: true, svg: true },
        // task-list checkboxes survive; markdown-it never emits on* handlers
        // and DOMPurify strips any coming from raw HTML in the source.
        ADD_ATTR: ['checked', 'disabled'],
      });
    },
  };
}
