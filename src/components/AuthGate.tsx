import { createContext, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_STORAGE_KEY = "refind_inbox_auth_v1";
const PASSCODE_HASH =
  "ead106fc782fda164e599dea0baa56f367250bb2730da502242892bb0d1c6d5e";

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredAuth(): boolean {
  return localStorage.getItem(AUTH_STORAGE_KEY) === PASSCODE_HASH;
}

type AuthGateProps = {
  children: React.ReactNode;
};

type AuthContextValue = {
  lockInbox: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthGate(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthGate must be used inside AuthGate");
  }

  return context;
}

export function AuthGate({ children }: AuthGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredAuth);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const canSubmit = useMemo(() => passcode.trim().length > 0, [passcode]);

  useEffect(() => {
    const onStorage = () => setIsAuthenticated(getStoredAuth());
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isChecking) {
      return;
    }

    setIsChecking(true);
    setError("");

    try {
      const candidateHash = await sha256(passcode.trim());
      if (candidateHash === PASSCODE_HASH) {
        localStorage.setItem(AUTH_STORAGE_KEY, candidateHash);
        setIsAuthenticated(true);
        setPasscode("");
        return;
      }

      setError("That passcode did not match.");
    } catch {
      setError("Your browser could not verify the passcode.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  };

  if (isAuthenticated) {
    return <AuthContext.Provider value={{ lockInbox: handleLogout }}>{children}</AuthContext.Provider>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">ReFind Inbox</h1>
            <p className="text-sm text-slate-400">Private access</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-slate-200" htmlFor="inbox-passcode">
              Passcode
            </Label>
            <Input
              autoComplete="current-password"
              autoFocus
              className="border-slate-700 bg-slate-950 text-slate-100"
              id="inbox-passcode"
              onChange={(event) => setPasscode(event.target.value)}
              type="password"
              value={passcode}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <Button className="w-full" disabled={!canSubmit || isChecking} type="submit">
            {isChecking ? "Checking..." : "Unlock inbox"}
          </Button>
        </form>
      </section>
    </main>
  );
}
