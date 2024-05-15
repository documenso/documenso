export class UserExistsError extends Error {
  constructor() {
    super('მომხმარებელი უკვე არსებობს');
  }
}
