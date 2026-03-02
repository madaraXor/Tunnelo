import "./globals.css";

export const metadata = {
  title: "Tunnelo",
  description: "SSH Tunnel Manager",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
