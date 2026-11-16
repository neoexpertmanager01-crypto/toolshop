// Помилки рівня service/. api/ перетворює їх у ErrorResponse з відповідним HTTP-статусом.
export class AppError extends Error {
  constructor({ status, error, code, details }) {
    super(code || error);
    this.status = status;
    this.error = error;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super({ status: 400, error: "ValidationError", code: details[0]?.code, details });
  }
}

export class NotFoundError extends AppError {
  constructor(code) {
    super({ status: 404, error: "NotFound", code });
  }
}

export class ConflictError extends AppError {
  constructor(code, details) {
    super({ status: 409, error: "Conflict", code, details });
  }
}

export class UnprocessableError extends AppError {
  constructor(code) {
    super({ status: 422, error: "UnprocessableEntity", code });
  }
}
