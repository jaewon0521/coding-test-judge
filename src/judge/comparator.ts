export interface Comparator<T = unknown> {
  compare(actual: T, expected: T): boolean;
}
