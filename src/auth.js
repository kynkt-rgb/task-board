import { createHash, timingSafeEqual } from 'node:crypto';

// 文字列を同じ長さのハッシュにしてから比べる（比べる時間から答えを推測されないようにするため）
function safeEqual(a, b) {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * ベーシック認証。ユーザー名とパスワードが合っているときだけ先へ進める。
 * 利用者は1人だけなので、ユーザー名とパスワードは環境変数で1組だけ持つ。
 */
export function basicAuth({ user, password }) {
  return (req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator >= 0) {
        const userOk = safeEqual(decoded.slice(0, separator), user);
        const passwordOk = safeEqual(decoded.slice(separator + 1), password);
        if (userOk && passwordOk) {
          return next();
        }
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="task-board", charset="UTF-8"');
    res.status(401).json({ error: 'ログインが必要です' });
  };
}
