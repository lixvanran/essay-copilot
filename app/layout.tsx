import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '作文副驾驶',
  description: '不是写得最好，而是写得最像你'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
