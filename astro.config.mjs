import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

const applyAdminMiddleware = (middlewares) => {
  middlewares.use((req, res, next) => {
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
};

// Note: only configureServer (dev) is wired here. astro preview does not
// invoke Vite plugin preview hooks, so canonicalization in preview cannot be
// added without a custom server. Production canonicalization is handled by
// vercel.json. preview already serves /admin and /admin/ with the same
// content, so the gap is the missing 301 only.
const adminStaticRouteCanonical = () => ({
  name: "admin-static-route-canonical",
  configureServer(server) {
    applyAdminMiddleware(server.middlewares);
  },
});

export default defineConfig({
  vite: {
    plugins: [tailwindcss(), adminStaticRouteCanonical()],
  },
});
