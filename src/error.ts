export class RouterError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message)
    if (code) {
      this.code = code
    }
  }
}
