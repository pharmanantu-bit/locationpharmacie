import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
    </main>
  );
}
