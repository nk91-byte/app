import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'NoteFlow - Notebook & Todos',
  description: 'A clean, minimalistic notebook and todo system',
  icons: {
    icon: '/icon.png',
  }
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster position="bottom-left" />
      </body>
    </html>
  );
}
