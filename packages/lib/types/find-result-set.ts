export type FindResultSet<T> = {
  data: T extends Array<unknown> ? T : T[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
};
