const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight"),
    markdownIt = require('markdown-it');
const pluginRss = require("@11ty/eleventy-plugin-rss");
const Image = require("@11ty/eleventy-img");

async function imageShortcode(src, alt, sizes) {
  let metadata = await Image(src, {
    widths: [300, 600],
    formats: ["avif", "jpeg"],
    urlPath: "/images/",
    outputDir: "./_site/images/"
  });

  let imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };

  // You bet we throw an error on missing alt in `imageAttributes` (alt="" works okay)
  return Image.generateHTML(metadata, imageAttributes, {
    whitespaceMode: "inline",
  });
}

module.exports = eleventyConfig => {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addLiquidFilter("dateToRfc3339", pluginRss.dateRfc3339);
  eleventyConfig.addLiquidFilter("getNewestCollectionItemDate", pluginRss.getNewestCollectionItemDate);
  eleventyConfig.addLiquidFilter("absoluteUrl", pluginRss.absoluteUrl);
  eleventyConfig.addLiquidFilter("convertHtmlToAbsoluteUrls", pluginRss.convertHtmlToAbsoluteUrls);
  eleventyConfig.addPassthroughCopy('favicon.ico');
  eleventyConfig.addPassthroughCopy('assets/fonts');
  eleventyConfig.addPassthroughCopy('assets/images');
  const options = {
    html: true,
    breaks: true,
    linkify: false
  };
  eleventyConfig.setLibrary("md", markdownIt(options));
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.addLiquidShortcode("image", imageShortcode);
  eleventyConfig.addJavaScriptFunction("image", imageShortcode);
  return {
    // Use liquid in html templates
    htmlTemplateEngine: "liquid",
    passthroughFileCopy: true
  };
};
