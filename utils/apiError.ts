export class ApiError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    // Restore prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
