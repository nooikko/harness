import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TopBar } from './_components/top-bar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Harness Dashboard',
  description: 'Orchestrator dashboard — threads, tasks, crons, and real-time monitoring',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${inter.className} flex h-screen flex-col`}>
        <TopBar />
        <div className='flex min-h-0 flex-1'>{children}</div>
      </body>
    </html>
  );
}
