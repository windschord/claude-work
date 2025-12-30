/**
 * セッション名自動生成ユーティリティ
 *
 * Docker風の「形容詞-動物名」形式でセッション名を生成します。
 * 例: gentle-panda, swift-falcon
 */

/**
 * 形容詞リスト（50語以上）
 */
export const ADJECTIVES = [
  'swift',
  'gentle',
  'brave',
  'calm',
  'clever',
  'eager',
  'fierce',
  'happy',
  'jolly',
  'keen',
  'lively',
  'merry',
  'noble',
  'proud',
  'quick',
  'quiet',
  'rapid',
  'steady',
  'strong',
  'wise',
  'agile',
  'bold',
  'bright',
  'cool',
  'daring',
  'epic',
  'fancy',
  'grand',
  'humble',
  'ideal',
  'jovial',
  'kind',
  'lucky',
  'mighty',
  'neat',
  'optimal',
  'prime',
  'royal',
  'serene',
  'super',
  'tender',
  'ultra',
  'vivid',
  'warm',
  'witty',
  'young',
  'zealous',
  'active',
  'cosmic',
  'digital',
] as const;

/**
 * 動物名リスト（50語以上）
 */
export const ANIMALS = [
  'panda',
  'falcon',
  'tiger',
  'dolphin',
  'eagle',
  'fox',
  'hawk',
  'jaguar',
  'koala',
  'lion',
  'monkey',
  'otter',
  'penguin',
  'rabbit',
  'shark',
  'turtle',
  'whale',
  'wolf',
  'zebra',
  'bear',
  'cheetah',
  'deer',
  'elephant',
  'flamingo',
  'giraffe',
  'heron',
  'iguana',
  'jellyfish',
  'kangaroo',
  'lemur',
  'moose',
  'narwhal',
  'owl',
  'parrot',
  'quail',
  'raven',
  'seal',
  'toucan',
  'urchin',
  'viper',
  'walrus',
  'xerus',
  'yak',
  'badger',
  'cougar',
  'dove',
  'ferret',
  'goose',
  'hummingbird',
  'impala',
] as const;

/**
 * 形容詞-動物名形式のセッション名を生成する
 * @returns 生成されたセッション名（例: "gentle-panda"）
 */
export function generateSessionName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective}-${animal}`;
}

/**
 * 既存のセッション名と重複しない名前を生成する
 * @param existingNames 既存のセッション名の配列
 * @param maxAttempts 最大試行回数（デフォルト: 10）
 * @returns 一意のセッション名
 */
export function generateUniqueSessionName(
  existingNames: string[],
  maxAttempts: number = 10
): string {
  const existingSet = new Set(existingNames);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const name = generateSessionName();
    if (!existingSet.has(name)) {
      return name;
    }
  }

  // 最大試行回数に達した場合はタイムスタンプ付きの名前を返す
  const timestamp = Date.now();
  return `session-${timestamp}`;
}
