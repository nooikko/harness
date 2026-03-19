import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { ThemeProvider } from './_components/theme-provider';
import { TopBar } from './_components/top-bar';
import { WsProvider } from './_components/ws-provider';
import './globals.css';

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Harness Dashboard',
  description: 'Orchestrator dashboard — threads, tasks, crons, and real-time monitoring',
};

type RootLayoutProps = {
  children: React.ReactNode;
};

type RootLayoutComponent = (props: RootLayoutProps) => Promise<React.ReactNode>;

const RootLayout: RootLayoutComponent = async ({ children }) => {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${figtree.variable} flex h-screen flex-col`}>
        <ThemeProvider>
          <WsProvider>
            <TopBar />
            <div className='flex min-h-0 flex-1'>{children}</div>
          </WsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
