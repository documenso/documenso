export type FindResultSet<T> = {
  data: T[];
  count: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
};
