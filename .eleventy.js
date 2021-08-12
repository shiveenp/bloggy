const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight"),
    markdownIt = require('markdown-it');
const pluginRss = require("@11ty/eleventy-plugin-rss");
const generateSocialImages = require("@manustays/eleventy-plugin-generate-social-images");
module.exports = eleventyConfig => {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(generateSocialImages, {
    promoImage: "./assets/images/about_me.jpg",
    outputDir: "./_site/img/preview",
    urlPath: "/img/preview",
    siteName: "shiveenp.com/",
    titleColor: "#fedb8b"
  });
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

  return {
    // Use liquid in html templates
    htmlTemplateEngine: "liquid",
    passthroughFileCopy: true
  };
};
