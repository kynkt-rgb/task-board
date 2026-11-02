export const TITLE_MAX_LENGTH = 50;
export const STATUSES = ['todo', 'doing', 'done'];

/**
 * カードのタイトルをチェックする。
 * 前後の空白を取りのぞき、1〜50文字ならOK。
 * 文字数は絵文字なども1文字として数える（DBの char_length と同じ数え方）。
 */
export function validateTitle(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'タイトルは文字で指定してください' };
  }
  const title = input.trim();
  const length = [...title].length;
  if (length === 0) {
    return { ok: false, error: 'タイトルを入力してください' };
  }
  if (length > TITLE_MAX_LENGTH) {
    return { ok: false, error: `タイトルは${TITLE_MAX_LENGTH}文字以内で入力してください` };
  }
  return { ok: true, value: title };
}

/** 列の指定が todo / doing / done のどれかかをチェックする */
export function isValidStatus(input) {
  return typeof input === 'string' && STATUSES.includes(input);
}

/** URLの :id が正しい番号かをチェックし、番号を返す（正しくなければ null） */
export function parseId(input) {
  if (!/^[1-9]\d{0,14}$/.test(input)) {
    return null;
  }
  return Number(input);
}
