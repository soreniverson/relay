import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';

const zalandoSans = localFont({
  src: [
    {
      path: '../fonts/ZalandoSans-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/ZalandoSans-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/ZalandoSans-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-zalando-sans',
});

export const metadata: Metadata = {
  title: 'Relay - Feedback & Support Platform',
  description: 'In-app feedback, bug reporting, session replay, and customer support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={zalandoSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
