export type CurrentUser = { id: string; displayName: string; role: string } | null;

/** Common props passed to most feature modules. */
export interface ModuleProps {
  featureId: string;
  feature: string;
  csrfToken: string;
  currentUser: CurrentUser;
  stage?: string;
  description?: string;
}
