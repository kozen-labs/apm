/** Summary returned after an install or uninstall run. */
export interface IOperationResult {
  succeeded: string[];
  skipped:   string[];
  errors:    Array<[string, string]>;
  elapsed:   number;
  target:    string;
}
