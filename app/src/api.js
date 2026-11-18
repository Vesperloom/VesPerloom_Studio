let token = '';
export function setToken(value) {
  token = value;
}
export const privateMedia = (url) => Boolean(token) && url?.startsWith('/api/');
export async function request(url, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    const e = Error(message);
    e.status = res.status;
    throw e;
  }
  return res;
}
export const api = async (url, opts) => await (await request(url, opts)).json();
export async function download(url, name) {
  const blob = await (await request(url)).blob();
  const link = document.createElement('a');
  const href = URL.createObjectURL(blob);
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}
export const seedNumber = () => crypto.getRandomValues(new Uint32Array(1))[0];
