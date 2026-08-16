/**
 * Ambient declaration for the untyped 'sm-crypto' package (SM3 hash / SM4 cipher).
 * Covers only the surface used by foundation/crypto-envelope.ts.
 */

declare module 'sm-crypto' {
  interface Sm4Options {
    mode?: 'cbc' | 'ecb'
    iv?: string
    padding?: 'pkcs#5' | 'pkcs#7' | 'none'
    output?: 'array' | 'arraybuffer'
  }

  export const sm3: {
    (data: string | number[], options?: { key?: string }): string
  }

  export const sm4: {
    encrypt(data: string, key: string, options?: Sm4Options): string | number[] | ArrayBuffer
    decrypt(data: string, key: string, options?: Sm4Options): string | number[] | ArrayBuffer
  }
}
