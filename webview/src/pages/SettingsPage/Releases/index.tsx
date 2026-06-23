import { useState, useMemo } from 'react';
import { ROUTE_META, Route } from '@/router/routes';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { usePluginUpdates } from '@/hooks/usePluginUpdates';
import { useVersionInfo } from '@/hooks/useVersionInfo';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType } from '@/shared';

/**
 * Sanitize HTML by stripping all tags except a safe allowlist.
 * This prevents XSS from untrusted release notes.
 *
 * Strategy: bottom-up walk so that when a disallowed parent is unwrapped,
 * its children have already been sanitized.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'blockquote',
  'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'dl', 'dt', 'dd', 'sup', 'sub', 'del', 'ins',
  'img',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['title', 'class', 'id', 'style']),
  'a': new Set(['href']),
  'img': new Set(['src', 'alt', 'width', 'height']),
};

function isAllowedAttr(tag: string, attrName: string): boolean {
  return (ALLOWED_ATTRS['*']?.has(attrName) ?? false)
    || (ALLOWED_ATTRS[tag]?.has(attrName) ?? false);
}

function isSafeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('#') || value.startsWith('/');
}

function sanitizeReleaseHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    walkBottomUp(doc.body);
    return doc.body.innerHTML;
  } catch {
    // DOMParser unavailable (e.g. certain JCEF versions) — strip all HTML as fallback
    const temp = document.createElement('div');
    temp.textContent = html.replace(/<[^>]*>/g, '');
    return temp.innerHTML;
  }
}

function walkBottomUp(node: Node): void {
  // Recurse children first (bottom-up), snapshot to handle mutations
  const children = Array.from(node.childNodes);
  for (const child of children) {
    walkBottomUp(child);
  }

  // Now process the current node itself
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    // Unwrap: move (already-sanitized) children before this node, then remove it
    while (el.firstChild) {
      el.parentNode?.insertBefore(el.firstChild, el);
    }
    el.parentNode?.removeChild(el);
    return;
  }

  // Remove disallowed attributes
  for (const attr of Array.from(el.attributes)) {
    if (!isAllowedAttr(tag, attr.name.toLowerCase())) {
      el.removeAttribute(attr.name);
    }
  }

  // Sanitize URL attributes
  for (const urlAttr of ['href', 'src']) {
    if (el.hasAttribute(urlAttr)) {
      const val = el.getAttribute(urlAttr) ?? '';
      if (!isSafeUrl(val)) {
        el.removeAttribute(urlAttr);
      }
    }
  }
}

function formatDate(cdate: string | number): string {
  const ms = typeof cdate === 'string' ? parseInt(cdate, 10) : cdate;
  if (isNaN(ms)) return 'Unknown date';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const tz = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts().find(p => p.type === 'timeZoneName')?.value ?? '';
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} (${tz})`;
}

function extractTitle(notes: string): string | null {
  const match = notes.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  if (!match) return null;
  try {
    // Strip any HTML tags from the title text to prevent XSS
    const temp = document.createElement('div');
    temp.innerHTML = match[1];
    return temp.textContent ?? null;
  } catch {
    // Fallback: strip tags with regex
    return match[1].replace(/<[^>]*>/g, '') || null;
  }
}

function stripTitle(notes: string): string {
  return notes.replace(/<h[1-3][^>]*>.*?<\/h[1-3]>/i, '').trim();
}

function ReleasesSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-raised rounded-lg border border-border-default p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-surface-overlay rounded animate-pulse" />
            <div className="h-5 w-16 bg-surface-overlay rounded animate-pulse" />
            <div className="h-4 w-48 bg-surface-overlay rounded animate-pulse" />
            <div className="h-4 w-32 bg-surface-overlay rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ReleaseAccordionProps {
  update: { id: number; version: string; notes: string; cdate: string | number };
  isCurrent: boolean;
  defaultOpen: boolean;
}

function ReleaseAccordion(props: ReleaseAccordionProps) {
  const { update, isCurrent, defaultOpen } = props;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const title = extractTitle(update.notes);
  const rawBody = stripTitle(update.notes);
  const body = useMemo(() => rawBody ? sanitizeReleaseHtml(rawBody) : '', [rawBody]);

  return (
    <div className="bg-surface-raised rounded-lg border border-border-default">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex flex-col gap-1 px-4 py-3 text-left hover:bg-surface-hover transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 w-full">
          <ChevronRightIcon
            className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
          <span className="text-sm font-semibold text-text-primary shrink-0">
            v{update.version}
          </span>
          <span className="text-xs text-text-tertiary shrink-0 ml-auto">
            {formatDate(update.cdate)}
          </span>
          {isCurrent && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-surface-tooltip text-text-secondary shrink-0">
              Current
            </span>
          )}
        </div>
        {title && (
          <span className="text-sm text-text-secondary pl-6">{title}</span>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pl-10">
          {body ? (
            <div
              className="text-sm text-text-secondary prose prose-invert prose-sm max-w-none
                [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5
                [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-secondary
                [&_a]:text-text-link [&_a:hover]:text-text-link"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-sm text-text-disabled italic">No release notes</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ReleasesSettings() {
  const meta = ROUTE_META[Route.SETTINGS_RELEASES];
  const { updates, isLoading, error, refresh } = usePluginUpdates();
  const { pluginVersion, requiresRestart } = useVersionInfo();
  const { send } = useBridgeContext();

  const latestUpdate = updates[0];
  const hasNewVersion =
    latestUpdate != null && latestUpdate.version !== pluginVersion;

  const handleUpdate = () => {
    send(MessageType.UPDATE_PLUGIN, {});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{meta.label}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">v{pluginVersion}</span>
          {hasNewVersion && (
            <div className="flex flex-col items-end gap-1">
              {requiresRestart && <span className="text-xs text-text-secondary">IDE restart required</span>}
              <button
                onClick={handleUpdate}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-accent-primary-hover hover:bg-accent-primary text-text-primary transition-colors"
              >
                Update to v{latestUpdate.version}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-state-error-bg border border-state-error-border rounded-lg text-sm text-state-error-fg">
          {error}
        </div>
      )}

      {isLoading && updates.length === 0 ? (
        <ReleasesSkeleton />
      ) : updates.length > 0 ? (
        <div className="space-y-2">
          {updates.map((update, index) => (
            <ReleaseAccordion
              key={update.id}
              update={update}
              isCurrent={update.version === pluginVersion}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      ) : !isLoading ? (
        <p className="text-sm text-text-tertiary">No releases found.</p>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-text-tertiary mt-4">
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
