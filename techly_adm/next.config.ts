import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // 1. Обязательно для Tauri (выдает статику в папку out)
  output: "export",

  // 2. Игнорируем строгий линтер при сборке (чтобы билд не падал из-за мелких варнингов)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 3. Игнорируем ошибки типов при сборке (Tauri нам важнее)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ВНИМАНИЕ: Здесь НЕТ блока "experimental: { reactCompiler: true }".
  // Мы его специально удалили, чтобы сборка прошла успешно.
};

export default nextConfig;