import type { Metadata } from 'next';
import { getBrandName } from '@/lib/utils';
import { routing } from '@/lib/i18n/routing';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.vercel.ai'),
  title: getBrandName(),
  description: 'Next Generation MCP router enabled chat app',
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  return children;
}
