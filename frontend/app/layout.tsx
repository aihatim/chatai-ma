import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoArabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-noto-arabic' });

export const metadata: Metadata = {
  title: 'ChatAi.ma — Enterprise AI Revenue Engine',
  description: 'Three Channels. One Brain. Infinite Revenue. Deploy AI on Website, WhatsApp & Prospecting in under 1 hour.',
};

const rtlLocales = ['ar'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr';
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${notoArabic.variable}`}>
      <body className="font-sans antialiased scrollbar-thin">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
