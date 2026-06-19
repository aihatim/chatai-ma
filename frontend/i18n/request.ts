import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'fr', 'ar', 'es'];
export const defaultLocale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && locales.includes(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export { locales };
