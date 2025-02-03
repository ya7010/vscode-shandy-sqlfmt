export class SqlfmtNotInstalled extends Error {
  public constructor(command: string) {
    super(
      `"${command}" is not found. Please install [shandy-sqlfmt](https://github.com/tconbeer/sqlfmt) first.`,
    );
  }
}
