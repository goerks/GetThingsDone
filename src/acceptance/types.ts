/** One test case for the product owner, in German (see "Test cases" in CLAUDE.md). */
export interface TestCase {
  /** `AC<n>.<m>`; the automated test of the case starts its name with it. */
  id: string;
  title: string;
  /** The page of the app where the case starts, as a hash address. */
  link: string;
  /** What to test on that page: a CSS selector of the element that lights up when the PO jumps there. */
  target?: string;
  given: string;
  when: string;
  then: string;
  /** The automated tests that cover the case, as `file › test title`; a test name starts with the id. */
  tests: string[];
  /** Set when the case is also checked by hand, and why. */
  manual?: string;
  /**
   * Set when the product owner has to check the case, and what exactly: a judgement no test can make, or something
   * only a person on a real machine can see. Cases without it are covered by the automated tests and are not shown to the
   * product owner by default.
   */
  poCheck?: string;
}

/** An acceptance criterion with its test cases. `story` names the proposal of the issue it belongs to. */
export interface Criterion {
  id: string;
  story: string;
  title: string;
  cases: TestCase[];
}
