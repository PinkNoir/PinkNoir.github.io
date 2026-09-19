import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Files in public/ (favicons, CNAME, logo sources) are copied to the site root as-is.
export default defineConfig({
  plugins: [tailwindcss()],
});
