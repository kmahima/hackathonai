require('dotenv').config();
const { tavily } = require("@tavily/core");


async function runTavilySearch(topic) {
  // Step 1. Instantiating your Tavily client
  const tvly = tavily({ apiKey: process.env.TAVILY_KEY });

  // Step 2. Executing a simple search query
  const response = await tvly.search(topic, { include_images: true });
  console.log("FROM TAVILY",response);

  // Step 3. That's it! You've done a Tavily Search!
  return response
}


if (require.main === module) {
    runTavilySearch("Top trending dresses for summer images")
        .then(response => console.log(response))
        .catch(console.error);
}
