import './globals.css';

export const metadata = {
  title: 'AI Repository Reviewer',
  description: 'Analyze GitHub repositories with RAG and OpenRouter'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
