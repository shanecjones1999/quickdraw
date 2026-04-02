import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        https: {},
        proxy: {
            "/socket.io": {
                target: "https://localhost:3001",
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        },
    },
});
