export type FindResultSet<T> = {
  data: T extends Array<any> ? T : T[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
};
