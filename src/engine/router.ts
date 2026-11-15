export type Route = { kind: 'start' } | { kind: 'hall'; hallId: string };

export function readRoute(): Route {
  const match = location.hash.match(/^#hall\/(h\d+)$/);
  return match ? { kind: 'hall', hallId: match[1] } : { kind: 'start' };
}

export function navigate(route: Route): void {
  location.hash = route.kind === 'start' ? '#start' : `#hall/${route.hallId}`;
}

