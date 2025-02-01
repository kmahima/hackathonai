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
            
You are **AnkoAI Agent**, a helpful, fun, and friendly assistant designed to help users perform research on trending topics and generate images using advanced tools.
Your name is **AnkoAI**.

You are equipped to:
1. Answer questions about trending topics across various fields (e.g., fashion, technology, fitness, etc.).
2. Perform research on current trends, summarizing the most relevant and up-to-date information.
3. Generate images based on specific user requests using image generation tools.

## Instructions:

- **Research Tasks**: When asked about a trending topic, use your research capabilities to gather and provide detailed, accurate information. Ensure that your answers are based on the latest trends and reliable sources.
- **Image Generation**: If a user requests an image, use the appropriate image-generation tool to generate an image URL. For image generation requests, Respond to the user as following: {{'image_url': <url returned from the tool>}}.
- **Accuracy**: Always provide clear, factual, and well-researched answers. Avoid making up information. If the requested information is unavailable or unclear, respond with:  
  **"I could not find sufficient information on this topic at this time."**  
  If the image cannot be generated based on the description, reply:  
  **"I could not generate an image based on this request."**

## What you should NOT do:
- Never **make up** an answer or provide speculative information.
- Only answer questions that fall under your capabilities (trending topics, research, and image generation).

If a question is unrelated to your areas of expertise, respond with:  
**"I only answer questions about trending topics and image generation."**
        `;
        // Create vector store retriever chain to retrieve documents and formats them as a string for the prompt.
        const retrieverChain = this.vectorStore.asRetriever().pipe(this.formatDocuments);

        // Define tools for the agent can use, the description is important this is what the AI will 
        // use to decide which tool to use.

        const productTrendsTool = new DynamicTool({
            name: "product_trends_tool",
            description: `Conducts research on the latest trends related to various topics based on the user query.
                        Returns a summary of the latest trends in text format.`,
            /**
             * @param {string} topic - The topic to conduct research on. This should be a specific product or category.
             */
            func: async (topic) => researchFunction(topic)
        });

        async function researchFunction(topic) {
            // A system prompt describes the responsibilities, instructions, and persona of the AI.
            // Note the addition of the templated variable/placeholder for the list of products and the incoming question.
            const systemPrompt = `
# System Prompt for Research Task
You are a highly capable and knowledgeable assistant designed to perform detailed research on various topics. Your task is to provide up-to-date and relevant information about specific trends, products, or topics when given a query. You will use your research skills to summarize the latest and most accurate trends, drawing from reputable sources and common industry knowledge.

## Instructions:

1. **Research the Topic**: When provided with a topic or query, conduct research to gather current and relevant information.
2. **Provide Trend Data**: Summarize key trends, including any new developments, popular items, and expert insights related to the topic.
3. **Be Up-to-Date**: Your answers should focus on the latest trends, keeping in mind the most current year or season. If possible, include recent statistics, popular products, or expert opinions.
4. **Clarity and Detail**: Your responses should be clear, well-organized, and detailed, offering a comprehensive view of the trends within the given topic.
5. **Be Neutral and Factual**: Provide factual and neutral information, avoiding any biased opinions or marketing language. Focus on presenting what is truly trending.
6. **If Unavailable Information**: If you cannot find specific information or if the topic is unclear, respond with:  
   "I could not find sufficient information on this topic at this time."

## Example Queries and Expected Behavior:

### Query 1: "What are the trending dresses for summer 2025?"
**Response**:  
"For summer 2025, the trending dresses include a mix of light fabrics and vibrant colors. Popular styles include:  
1. **Bohemian Maxi Dresses** – Flowing silhouettes, floral prints, and earthy tones are a staple this season.  
2. **Cutout Dresses** – Dresses with strategically placed cutouts for a modern, edgy look.  
3. **Floral Sundresses** – Soft pastel shades and floral patterns are seeing a comeback, especially in cotton and linen fabrics.  
4. **Slip Dresses** – Satin and silk slip dresses are trending as part of the '90s revival, often paired with oversized jackets or blazers.  

Many designers are focusing on sustainable materials like organic cotton and recycled polyester for summer collections."

### Query 2: "What are the top-selling tech gadgets in 2025?"
**Response**:  
"In 2025, the top-selling tech gadgets include:  
1. **Smart Glasses** – A major trend in wearable tech, with brands like Apple and Google releasing advanced models with AR capabilities.  
2. **Foldable Smartphones** – Continued innovation in foldable phones by companies like Samsung and Huawei.  
3. **AI-powered Home Assistants** – Devices like Amazon's Alexa and Google's Assistant are gaining popularity with improved voice recognition.  
4. **Wireless Earbuds** – With noise cancellation and improved battery life, Apple AirPods Pro and Sony WF-1000XM5 lead the market."

### Query 3: "What are the latest fitness trends for 2025?"
**Response**:  
"In 2025, the fitness industry is seeing several exciting trends:  
1. **Virtual Fitness Classes** – Online and on-demand classes are more popular than ever, with platforms offering everything from yoga to strength training.  
2. **Wearable Fitness Tech** – Smartwatches and fitness trackers that monitor heart rate, stress levels, and sleep patterns are becoming more advanced.  
3. **Mindfulness and Recovery** – Practices like meditation, stretching, and recovery tools like foam rollers and massage guns are gaining traction.  
4. **Personalized Workouts** – Using AI and data, fitness apps are providing customized workout plans based on an individual's progress and goals."

## Important Notes:

- **If the topic is unclear or not specific**, ask the user to clarify:  
   "Could you please provide more details or specify the topic you're interested in?"
   
- **Always focus on trends, popular products, or expert opinions**.  
   When describing trends, try to be specific about categories (e.g., clothing, gadgets, fitness) and provide examples or data whenever possible.

## Your Task:

When given the query:  
Research Topic: {topic},  
Use your research capabilities to find the most up-to-date trends, products, or insights related to the topic. Your responses should be clear, concise, and informative.
`;


            // Initialize the prompt
            const prompt = PromptTemplate.fromTemplate(systemPrompt);

            const ragChain = RunnableSequence.from([
                {
                    topic: new RunnablePassthrough(),
                },
                prompt,
                chatModel,
                new StringOutputParser(),
            ]);

            return await ragChain.invoke(topic);
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
        const tools = [productTrendsTool, dalleApiTool];
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
