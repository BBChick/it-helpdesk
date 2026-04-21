import "./globals.css";

export const metadata = {
  title: "ZENOPS ADM",
  description: "IT Support Admin Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  );
}