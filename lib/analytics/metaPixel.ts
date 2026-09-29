export function createMetaEventId(_source?: string): string {
  return `local-${Date.now()}`
}

export function buildMetaApiTrackingFields(_eventId: string): Record<string, never> {
  return {}
}

export function trackDemoLocalLeadSubmit(_params: Record<string, unknown>): void {}

export function trackCTAClick(_cta: string, _location: string): void {}
