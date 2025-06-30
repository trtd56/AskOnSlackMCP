/**
 * Abstract interface for human interaction.
 */

export abstract class Human {
  /**
   * Ask a question to a human.
   * 
   * @param question - The question to ask
   * @returns The human's response
   */
  abstract ask(question: string): Promise<string>;
}