import { CartDrawer } from "@/components/CartDrawer";
import { CartSync } from "@/components/CartSync";
import { ChatWidget } from "@/components/ChatWidget";
import { Header } from "@/components/Header";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CartSync />
      <p className="bg-zinc-900 px-4 py-2 text-center text-xs text-white dark:bg-white dark:text-zinc-900">
        Demo store in Stripe test mode. Use code <span className="font-semibold">WELCOME10</span> for 10% off.
      </p>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
        © {new Date().getFullYear()} StoreCraft. Test mode: use card 4242 4242 4242 4242.
      </footer>
      <CartDrawer />
      <ChatWidget />
    </>
  );
}
