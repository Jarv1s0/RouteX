import SparkMD5 from 'spark-md5'

export class HashType {
  private hashValue: string

  constructor(hash: string) {
    this.hashValue = hash
  }

  static makeHash(data: string): HashType {
    const hash = SparkMD5.hash(data)
    return new HashType(hash)
  }

  equal(hash: HashType): boolean {
    return this.hashValue === hash.hashValue
  }

  toString(): string {
    return this.hashValue
  }

  isValid(): boolean {
    return this.hashValue.length === 32
  }
}

export function getHash(name: string): string {
  const hash = HashType.makeHash(name)
  return hash.toString()
}
