/** Only explicit maintainer-owned URLs are eligible for a public call to action. */
export function projectUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.origin !== 'https://github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname)
  )
    throw Error('Use the HTTPS URL of your GitHub repository.');
  return url.origin + url.pathname.replace(/\/$/, '').replace(/\.git$/, '');
}
export function publicDemoUrl(value) {
  if (!value) return null;
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !u.hostname.includes('.') ||
    u.hostname.endsWith('.localhost') ||
    u.hostname.endsWith('.local') ||
    /^[\d.]+$/.test(u.hostname) ||
    u.hostname.includes(':')
  )
    throw Error('Use a public HTTPS demo URL without credentials, query parameters or a fragment.');
  return u.href;
}
