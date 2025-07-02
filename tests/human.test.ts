import { describe, it, expect } from 'vitest'
import { Human } from '../src/human'

class TestHuman extends Human {
  async ask(question: string): Promise<string> {
    return `Answer to: ${question}`
  }
}

describe('Human Abstract Class', () => {
  it('should be able to extend Human class', () => {
    const human = new TestHuman()
    expect(human).toBeInstanceOf(Human)
  })

  it('should implement ask method', async () => {
    const human = new TestHuman()
    const response = await human.ask('What is the meaning of life?')
    expect(response).toBe('Answer to: What is the meaning of life?')
  })

  it('should handle async operations', async () => {
    class AsyncHuman extends Human {
      async ask(question: string): Promise<string> {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(`Delayed answer to: ${question}`)
          }, 10)
        })
      }
    }

    const human = new AsyncHuman()
    const response = await human.ask('Test question')
    expect(response).toBe('Delayed answer to: Test question')
  })
})