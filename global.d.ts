// Augment the existing NodeJS namespace to include API_KEY in process.env, 
// preventing redeclaration errors for the global 'process' variable which is already defined by types.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
