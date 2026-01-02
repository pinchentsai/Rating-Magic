declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

// 確保此檔案被視為全域宣告
export {};