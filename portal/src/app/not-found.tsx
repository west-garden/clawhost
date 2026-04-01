import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">{t("notFound")}</p>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
