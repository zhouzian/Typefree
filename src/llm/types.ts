export interface LLMService {
  reorganize(text: string): Promise<string>;
}
