import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { recordWhatsAppMarketingClick } from "@/lib/marketingApi";

type RedirectState = "loading" | "invalid" | "error";

function WhatsAppMarketingClick() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<RedirectState>("loading");
  const token = searchParams.get("token") || "";

  useEffect(() => {
    let active = true;

    async function redirect() {
      if (!token) {
        setState("invalid");
        return;
      }

      try {
        const result = await recordWhatsAppMarketingClick(token);
        if (!active) return;

        if (!result.valid || !result.destination) {
          setState("invalid");
          return;
        }

        window.location.replace(result.destination);
      } catch {
        if (active) setState("error");
      }
    }

    void redirect();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f6] px-5 text-slate-950">
      <section className="w-full max-w-md text-center">
        {state === "loading" ? (
          <>
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#d95700]" />
            <h1 className="mt-5 text-xl font-semibold">Opening easyTag</h1>
            <p className="mt-2 text-sm text-slate-600">One moment while we open the page.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">This link is no longer available</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Visit easyTag directly to see the latest travel products and offers.
            </p>
            <a className="mt-6 inline-block font-medium text-[#b34800] underline" href="https://easytag.app/">
              Go to easyTag
            </a>
          </>
        )}
      </section>
    </main>
  );
}

export default WhatsAppMarketingClick;
