import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "admin-static-route-canonical",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (!req.url) {
              next();
              return;
            }

            const [pathname, search = ""] = req.url.split("?");

            if (pathname === "/admin") {
              res.statusCode = 301;
              res.setHeader("Location", search ? `/admin/?${search}` : "/admin/");
              res.end();
              return;
            }

            if (pathname === "/admin/") {
              req.url = search ? `/admin/index.html?${search}` : "/admin/index.html";
            }

            next();
          });
        },
      },
    ],
  },
});
