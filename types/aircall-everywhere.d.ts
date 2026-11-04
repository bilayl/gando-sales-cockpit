declare module "aircall-everywhere" {
  type AircallWorkspaceSettings = {
    domToLoadWorkspace: string;
    size?: "big" | "small" | "auto";
    debug?: boolean;
    onLogin?: (settings: { user?: { email?: string; first_name?: string; last_name?: string } }) => void;
    onLogout?: () => void;
  };

  export default class AircallWorkspace {
    constructor(settings: AircallWorkspaceSettings);
    on(event: string, callback: (data: Record<string, unknown>) => void): void;
    send(event: string, data: Record<string, string>, callback?: (success: boolean, data?: { code?: string; message?: string }) => void): void;
    isLoggedIn(callback: (loggedIn: boolean) => void): void;
  }
}
