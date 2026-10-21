import type { TFunction } from 'i18next';
import type { ServiceKind } from '../domain/types';

/** The name of a service for the texts (`sync.services.<kind>`). */
export const serviceName = (t: TFunction, service: ServiceKind): string => t(`sync.services.${service}`);

/**
 * `t` with the name of the service filled in as `{{service}}`, so the texts of the sync can say "GitHub" or "Jira"
 * without every place passing it (#66). It also sets the context to the service, so a text can have a variant for one
 * service (`notFound_jira`). Values given in the call win.
 */
export function withService(t: TFunction, service: ServiceKind): TFunction {
  const name = serviceName(t, service);
  return ((key: string, options?: Record<string, unknown>) => t(key, { service: name, context: service, ...options })) as unknown as TFunction;
}
