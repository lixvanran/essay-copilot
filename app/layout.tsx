import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '作文副驾驶 · Essay Co-Pilot',
  description: '不是写得最好，而是写得最像你 — AI 文风仿写工具',
  manifest: '/manifest.json',
  themeColor: '#171712',
  appleWebApp: {
    capable: true,
    title: '作文副驾驶',
    statusBarStyle: 'default'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#171712" />
      </head>
      <body className="min-h-screen">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}