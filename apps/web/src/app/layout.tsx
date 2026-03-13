import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
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
    <html lang='en'>
      <body className={`${figtree.variable} flex h-screen flex-col`}>
        <WsProvider>
          <TopBar />
          <div className='flex min-h-0 flex-1'>{children}</div>
        </WsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
