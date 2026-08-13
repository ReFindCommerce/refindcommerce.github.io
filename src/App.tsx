import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Routes, Route } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import Index from "./pages/Index";
import Marketing from "./pages/Marketing";
import NotFound from "./pages/NotFound";
import WhatsAppPreferences from "./pages/WhatsAppPreferences";
import WhatsAppMarketingClick from "./pages/WhatsAppMarketingClick";

const queryClient = new QueryClient();

const PrivateRoutes = () => (
  <AuthGate>
    <Outlet />
  </AuthGate>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/marketing/preferences" element={<WhatsAppPreferences />} />
          <Route path="/marketing/click" element={<WhatsAppMarketingClick />} />
          <Route element={<PrivateRoutes />}>
            <Route path="/" element={<Index />} />
            <Route path="/marketing" element={<Marketing />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

