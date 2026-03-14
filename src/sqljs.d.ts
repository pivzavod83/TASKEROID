declare module 'sql.js' {
  interface SqlJs {
    Database: new (data?: Buffer | Uint8Array) => unknown;
  }
  function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJs>;
  export default initSqlJs;
}
