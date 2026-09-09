import { LoginForm } from "./LoginForm";

export const metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#faf9f7]">
      <div className="w-[360px]">
        <h1 className="text-[22px] font-semibold text-stone-900">Family</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
          This tree is private. Enter the family password to come in.
        </p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
