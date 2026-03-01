/** TreeDex: Tree-based document RAG framework. */

export { TreeDex, QueryResult } from "./core.js";
export {
  PDFLoader,
  TextLoader,
  HTMLLoader,
  DOCXLoader,
  autoLoader,
  textToPages,
} from "./loaders.js";
export {
  BaseLLM,
  GeminiLLM,
  OpenAILLM,
  ClaudeLLM,
  MistralLLM,
  CohereLLM,
  OpenAICompatibleLLM,
  GroqLLM,
  TogetherLLM,
  FireworksLLM,
  OpenRouterLLM,
  DeepSeekLLM,
  CerebrasLLM,
  SambanovaLLM,
  HuggingFaceLLM,
  OllamaLLM,
  FunctionLLM,
} from "./llm-backends.js";
export {
  listToTree,
  assignPageRanges,
  assignNodeIds,
  embedTextInTree,
  findLargeNodes,
} from "./tree-builder.js";
export {
  createNodeMapping,
  stripTextFromTree,
  collectNodeTexts,
  countNodes,
  getLeafNodes,
  treeToFlatList,
  extractJson,
  printTree,
} from "./tree-utils.js";
export {
  countTokens,
  extractPages,
  pagesToTaggedText,
  groupPages,
} from "./pdf-parser.js";
export {
  structureExtractionPrompt,
  structureContinuePrompt,
  retrievalPrompt,
  answerPrompt,
} from "./prompts.js";
export type { Page, TreeNode, IndexData, Stats } from "./types.js";
