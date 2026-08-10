import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { fetchWhatsAppPreference, optOutOfWhatsAppMarketing } from "@/lib/marketingApi";

const LOGO_URL =
  "https://easytag.app/cdn/shop/files/Logo_1_237d0cd1-29a7-4a50-9346-52bd4da97f33.png?v=1762888294&width=500";

function WhatsAppPreferences() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get("token") || "";
  const preferenceQuery = useQuery({
    queryKey: ["whatsapp-preference", token],
    queryFn: () => fetchWhatsAppPreference(token),
    enabled: Boolean(token),
    retry: false,
  });
  const optOutMutation = useMutation({
    mutationFn: () => optOutOfWhatsAppMarketing(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-preference", token] }),
  });

  const status = preferenceQuery.data;
  const isInvalid = !token || preferenceQuery.isError || status?.valid === false;

  return (
    <main className="min-h-screen bg-[#f7f7f6] text-slate-950">
      <header className="bg-[#ff6600] px-5 py-6">
        <img className="mx-auto h-auto w-36" src={LOGO_URL} alt="easyTag, part of the easyFamily of brands" />
      </header>

      <section className="mx-auto max-w-xl px-5 py-12 sm:py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-orange-100 text-[#d95700]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold">WhatsApp preferences</h1>

        {preferenceQuery.isLoading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Checking your preferences
          </div>
        ) : isInvalid ? (
          <div className="mt-8 border-l-4 border-amber-500 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
            This preferences link is no longer valid. You can reply STOP to any easyTag WhatsApp message instead.
          </div>
        ) : status?.optedOut ? (
          <div className="mt-8 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">WhatsApp marketing is off</p>
                <p className="mt-1 text-sm leading-6 text-emerald-900">
                  You will still receive replies when you contact easyTag customer support.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 text-base leading-7 text-slate-600">
              You currently receive occasional easyTag offers and useful travel updates. We send no more than two marketing messages in 30 days.
            </p>
            <div className="mt-8 border-y border-slate-200 py-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p className="text-sm leading-6 text-slate-600">
                  Turning marketing off does not affect orders, delivery updates, or customer-service conversations.
                </p>
              </div>
            </div>
            <Button
              className="mt-8 bg-slate-950 hover:bg-slate-800"
              disabled={optOutMutation.isPending}
              onClick={() => optOutMutation.mutate()}
            >
              {optOutMutation.isPending ? "Updating..." : "Stop WhatsApp marketing"}
            </Button>
            {optOutMutation.isError ? (
              <p className="mt-3 text-sm text-red-700">We could not update this preference. Please try again.</p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

export default WhatsAppPreferences;
