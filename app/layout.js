import './globals.css';

export const metadata = {
  title: 'NoteFlow - Notebook & Todos',
  description: 'A clean, minimalistic notebook and todo system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
