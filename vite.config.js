import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { minify } from "html-minifier-terser";
import { optimize } from "svgo";

// Vite minifies JS and CSS but ships index.html as authored, and this page is almost
// entirely markup — a hand-inlined SVG logo plus the copy around it. These two build-only
// plugins squeeze it: svgo first (it needs well-formed XML), then the HTML minifier.

// Precision 2 keeps the path within 0.01 user units of the original; the logo is 186 units
// wide and renders at ~270px, so the error stays far below a pixel.
const svgOptimize = () => ({
  name: "pn-svg-optimize",
  apply: "build",
  transformIndexHtml: {
    order: "pre",
    handler: (html) =>
      html.replace(/<svg[\s\S]*?<\/svg>/g, (svg) =>
        optimize(svg, {
          multipass: true,
          floatPrecision: 2,
          plugins: [
            {
              name: "preset-default",
              params: {
                // keepRoleAttr: the logo's role="img" pairs with its aria-label.
                overrides: { removeUnknownsAndDefaults: { keepRoleAttr: true } },
              },
            },
          ],
        }).data,
      ),
  },
});

const htmlMinify = () => ({
  name: "pn-html-minify",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      minify(html, {
        collapseWhitespace: true, // leaves one space around inline tags, so the copy stays intact
        removeComments: true,
        removeAttributeQuotes: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        decodeEntities: true,
        sortAttributes: true, // both sorts only reorder; they give gzip longer repeats
        sortClassName: true,
        minifyCSS: true, // the inline style="animation-delay: …" attributes
        minifyJS: true,
      }),
  },
});

// Files in public/ (favicons, CNAME, logo sources) are copied to the site root as-is.
export default defineConfig({
  plugins: [tailwindcss(), svgOptimize(), htmlMinify()],
});
