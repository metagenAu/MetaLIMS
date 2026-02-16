'use client';

import { useState } from 'react';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalAuthContext, usePortalAuthProvider } from '@/hooks/usePortalAuth';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const auth = usePortalAuthProvider();

  return (
    <QueryClientProvider client={queryClient}>
      <PortalAuthContext.Provider value={auth}>{children}</PortalAuthContext.Provider>
    </QueryClientProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>LabFlow Portal</title>
        <meta name="description" content="LabFlow Client Portal - Track your orders, samples, and results" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
