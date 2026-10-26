export function canRetryRequest(method: string | undefined, url: string | undefined, status: number | undefined, retries: number): boolean {
  if (retries >= 3 || (status !== undefined && ![502, 503, 504].includes(status))) return false;
  if (method?.toLowerCase() === 'get') return true;
  if (method?.toLowerCase() !== 'post' || !url) return false;
  return /^\/attempts\/\d+\/(answers|submit)$/.test(url) || /^\/student\/exams\/\d+\/start$/.test(url);
}
