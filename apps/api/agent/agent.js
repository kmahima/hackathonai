require('dotenv').config();
const { MongoClient } = require('mongodb');
const { AgentExecutor } = require("langchain/agents");
const { OpenAIFunctionsAgentOutputParser } = require("langchain/agents/openai/output_parser");
const { formatToOpenAIFunctionMessages } = require("langchain/agents/format_scratchpad");
const { DynamicTool } = require("@langchain/core/tools");
const { RunnableSequence } = require("@langchain/core/runnables");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { MessagesPlaceholder, ChatPromptTemplate } = require("@langchain/core/prompts");
const { convertToOpenAIFunction } = require("@langchain/core/utils/function_calling");
const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { AzureCosmosDBVectorStore } = require("@langchain/community/vectorstores/azure_cosmosdb");
const { PromptTemplate } = require("@langchain/core/prompts");
const {
    RunnablePassthrough,
} = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
// const { runTavilySearch } = require('./tavilytool');
const { tavily } = require("@tavily/core");




var dbname = process.env.MONGODB_Name;
// set up the OpenAI chat model
const chatModel = new ChatOpenAI();

class AnkoAIAgent {
    constructor() {

        // set up the MongoDB client
        this.dbClient = new MongoClient(process.env.MONGODB_CONNECTION_STRING);
        // set up the Azure Cosmos DB vector store
        const azureCosmosDBConfig = {
            client: this.dbClient,
            databaseName: process.env.MONGODB_NAME,
            collectionName: "products",
            indexName: "VectorSearchIndex",
            embeddingKey: "contentVector",
            textKey: "_id"
        }
        this.vectorStore = new AzureCosmosDBVectorStore(new OpenAIEmbeddings(), azureCosmosDBConfig);

        // set up the OpenAI chat model
        // https://js.langchain.com/docs/integrations/chat/azure
        this.chatModel = new ChatOpenAI({
            temperature: 0,
            azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
            azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
            azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
            verbose: true,
        });

        // initialize the chat history
        this.chatHistory = [];

        // initialize the agent executor
        (async () => {
            this.agentExecutor = await this.buildAgentExecutor();
        })();
    }

    async formatDocuments(docs) {
        // Prepares the product list for the system prompt.  
        let strDocs = "";
        for (let index = 0; index < docs.length; index++) {
            let doc = docs[index];
            let docFormatted = { "_id": doc.pageContent };
            Object.assign(docFormatted, doc.metadata);

            // Build the product document without the contentVector and tags
            if ("contentVector" in docFormatted) {
                delete docFormatted["contentVector"];
            }
            if ("tags" in docFormatted) {
                delete docFormatted["tags"];
            }

            // Add the formatted product document to the list
            strDocs += JSON.stringify(docFormatted, null, '\t');

            // Add a comma and newline after each item except the last
            if (index < docs.length - 1) {
                strDocs += ",\n";
            }
        }
        // Add two newlines after the last item
        strDocs += "\n\n";
        return strDocs;
    }

    async buildAgentExecutor() {
        // A system prompt describes the responsibilities, instructions, and persona of the AI.
        // Note the variable placeholders for the list of products and the incoming question are not included.
        // An agent system prompt contains only the persona and instructions for the AI.
        const systemMessage = `
**You are AnkoAI Agent, a helpful, fun, and friendly assistant designed to help users perform research on trending topics and generate images using advanced tools.**

**You are equipped to perform the following tasks based on the user request:**

1. **Research Task:** Perform research on current trends, summarizing the most relevant and up-to-date information.
2. **Image Generation Task:** Generate images based on specific user requests using image generation tools.

**Instructions:**

**Determine Task Type:**

* **Analyze the user's request:** 
    * If the request involves a question about a trending topic, a concept, or requires factual information, it's a **Research Task**.
    * If the request involves describing a scene, an object, or requesting an image based on a specific description, it's an **Image Generation Task**.

**Research Task:**

1. **Research the Topic:** When asked about a trending topic, use your research capabilities to gather and provide detailed, accurate information.
2. **Provide Trend Data:** Summarize key trends, including any new developments, popular items, and expert insights related to the topic.
3. **Be Up-to-Date:** Your answers should focus on the latest trends, keeping in mind the most current year or season. If possible, include recent statistics, popular products, or expert opinions.
4. **Clarity and Detail:** Your responses should be clear, well-organized, and detailed, offering a comprehensive view of the trends within the given topic.
5. **Be Neutral and Factual:** Provide factual and neutral information, avoiding any biased opinions or marketing language. Focus on presenting what is truly trending.
6. **If Unavailable Information:** If you cannot find specific information or if the topic is unclear, respond with: "I could not find sufficient information on this topic at this time."
7. **End your response with a follow-up question to engage the user.**

**Image Generation Task:**

1. **Generate an Image:** Use the **appropriate image generation tool** based on the user's request and the capabilities of the available tools. 
2. **Provide Image URL:** For image generation requests, respond to the user with: {{'image_url': <url returned from the tool>}}. This will provide the user with the URL of the generated image.
3. **Handle Failures:** If the image cannot be generated based on the description, reply: "I could not generate an image based on this request."
4. **End your response with a follow-up question to engage the user.**

**What you should NOT do:**

* Never **make up** an answer or provide speculative information.
* Only answer questions that fall under your capabilities (trending topics, research, and image generation).

If a question is unrelated to your areas of expertise, respond with: "I only answer questions about trending topics and image generation."
`;
        // Create vector store retriever chain to retrieve documents and formats them as a string for the prompt.
        // Define tools for the agent can use, the description is important this is what the AI will 
        // use to decide which tool to use.



        const searchTool = new DynamicTool({
            name: "trend_search_tool",
            description: `
            Searches for the top trending products based on the user query.
            return the title, url and content for the search topic.
            `,
            /**
             * @param {string} topic - The topic to conduct research on. This should be a specific product or category.
             */
            func: async (topic) => runTavilySearch(topic)
        });
        async function runTavilySearch(topic) {
            // Step 1. Instantiating your Tavily client
            const tvly = tavily({ apiKey: process.env.TAVILY_KEY });
          
            // Step 2. Executing a simple search query
            const response = await tvly.search(topic, { include_images: true });
            console.log("FROM TAVILY",response);
          
            // Step 3. That's it! You've done a Tavily Search!
            return JSON.stringify(response);
          }

        const dalleApiTool = new DynamicTool({
            name: "dalle_api_tool",
            description: `Generates an image based on a specific user request using the DALL-E API.
                      Returns the URL of the generated image.`,
            /**
            * @param {string} input - The input to be used by image Generator for genreting the image.
            */
            func: async (input) => imageGenerator(input)
        });

        async function imageGenerator(input) {
            const options = {
                api_version: "2024-02-01"
            };
            const size = '1024x1024';
            const n = 1;

            var openai_url = "https://arg-syd-aiapp1day-openai.openai.azure.com";
            var openai_key = process.env.AZURE_OPENAI_API_KEY;
            const client = new OpenAIClient(
                openai_url,
                new AzureKeyCredential(openai_key),
                options
            );

            const deploymentName = 'dalle3';
            const result = await client.getImages(deploymentName, input, { n, size });

            if (result.data[0].url) {
                console.log("image_url", result.data[0].url);
                return JSON.stringify({"image_url": result.data[0].url});
            } else {
                throw new Error("Image URL is undefined");
            }
        }


        // Generate OpenAI function metadata to provide to the LLM
        // The LLM will use this metadata to decide which tool to use based on the description.
        const tools = [searchTool, dalleApiTool];
        const modelWithFunctions = this.chatModel.bind({
            functions: tools.map((tool) => convertToOpenAIFunction(tool)),
        });

        // OpenAI function calling is fine-tuned for tool using therefore you don't need to provide instruction.
        // All that is required is that there be two variables: `input` and `agent_scratchpad`.
        // Input represents the user prompt and agent_scratchpad acts as a log of tool invocations and outputs.
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemMessage],
            new MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new MessagesPlaceholder("agent_scratchpad")
        ]);


        // Define the agent and executor
        // An agent is a type of chain that reasons over the input prompt and has the ability
        // to decide which function(s) (tools) to use and parses the output of the functions.
        const runnableAgent = RunnableSequence.from([
            {
                input: (i) => i.input,
                agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps),
                chat_history: (i) => i.chat_history
            },
            prompt,
            modelWithFunctions,
            new OpenAIFunctionsAgentOutputParser(),
        ]);

        // An agent executor can be thought of as a runtime, it orchestrates the actions of the agent
        // until completed. This can be the result of a single or multiple actions (one can feed into the next).
        // Note: If you wish to see verbose output of the tool usage of the agent, 
        //       set returnIntermediateSteps to true
        const executor = AgentExecutor.fromAgentAndTools({
            agent: runnableAgent,
            tools,
            returnIntermediateSteps: true,
            verbose: true,
        });

        return executor;
    }

    // Helper function that executes the agent with user input and returns the string output
    async executeAgent(input) {
        let returnValue = "";
        try {
            await this.dbClient.connect();
            // Invoke the agent with the user input
            const result = await this.agentExecutor.invoke({ input: input, chat_history: this.chatHistory });

            this.chatHistory.push(new HumanMessage(input));
            this.chatHistory.push(new AIMessage(result.output));

            // Output the intermediate steps of the agent if returnIntermediateSteps is set to true
            if (this.agentExecutor.returnIntermediateSteps) {
                console.log(JSON.stringify(result.intermediateSteps, null, 2));
            }
            // Return the final response from the agent
            returnValue = result.output;
        } finally {
            await this.dbClient.close();
        }
        return returnValue;
    }
};

module.exports = AnkoAIAgent;
