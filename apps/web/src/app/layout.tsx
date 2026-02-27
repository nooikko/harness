import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TopBar } from './_components/top-bar';
import { WsProvider } from './_components/ws-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Harness Dashboard',
  description: 'Orchestrator dashboard — threads, tasks, crons, and real-time monitoring',
};

type RootLayoutProps = {
  children: React.ReactNode;
};

type RootLayoutComponent = (props: RootLayoutProps) => React.ReactNode;

const RootLayout: RootLayoutComponent = ({ children }) => {
  return (
    <html lang='en'>
      <body className={`${inter.className} flex h-screen flex-col`}>
        <WsProvider>
          <TopBar />
          <div className='flex min-h-0 flex-1'>{children}</div>
        </WsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
