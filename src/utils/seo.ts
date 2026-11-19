import type { Institution } from '../types/institution';
import { getBestContactInfo } from './validators';

export function updatePageMeta(params: {
  title: string;
  description: string;
  canonicalPath?: string;
  noIndex?: boolean;
}) {
  document.title = params.title;

  const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', params.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', params.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', params.description);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', params.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', params.description);

  const robotsEl = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (params.noIndex) {
    setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
  } else if (robotsEl) {
    robotsEl.setAttribute('content', 'index, follow');
  }

  if (params.canonicalPath) {
    const base = window.location.origin;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${base}${params.canonicalPath}`;
  }
}

export function setDynamicJsonLd(id: string, schema: Record<string, unknown> | null) {
  const existing = document.getElementById(id);
  if (!schema) {
    existing?.remove();
    return;
  }
  const script = (existing as HTMLScriptElement | null) ?? document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function buildInstitutionJsonLd(inst: Institution, url: string): Record<string, unknown> {
  const contact = getBestContactInfo(inst);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        name: inst.name_bn ? `${inst.name_bn} (${inst.name_en})` : inst.name_en,
        alternateName: inst.name_en,
        identifier: inst.eiin ? `EIIN-${inst.eiin}` : inst.id,
        url,
        ...(contact.hasValidEmail ? { email: contact.email } : {}),
        ...(contact.primaryDisplayNumber ? { telephone: contact.primaryDisplayNumber } : {}),
        address: {
          '@type': 'PostalAddress',
          addressLocality: inst.upazila,
          addressRegion: inst.district,
          addressCountry: 'BD',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'EduDirectory BD',
            item: window.location.origin,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: inst.district,
            item: `${window.location.origin}/?district=${encodeURIComponent(inst.district)}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: inst.name_bn || inst.name_en,
            item: url,
          },
        ],
      },
    ],
  };
}
