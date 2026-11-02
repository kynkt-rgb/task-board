// 列の決まった値（DBの columns 表と同じ並び）
const COLUMNS = [
  { id: 'todo', name: 'やること' },
  { id: 'doing', name: '進行中' },
  { id: 'done', name: '完了' },
];

const form = document.getElementById('add-form');
const input = document.getElementById('title-input');
const inputError = document.getElementById('input-error');
const statusMessage = document.getElementById('status-message');
const board = document.getElementById('board');

// 画面に出すデータ。正しいデータはDBにあり、これはDBから読みこんだ写し
let cards = [];
// 通信中に同じ操作を2回しないためのしるし
let busy = false;

/** サーバーのAPIを呼ぶ。失敗したらエラーを投げる */
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error('サーバーにつながりません。ネット接続を確認してください');
  }
  if (!response.ok) {
    let message = `通信エラー（${response.status}）`;
    try {
      message = (await response.json()).error ?? message;
    } catch {
      // エラーの中身が読めないときは、上の文言のまま
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function showStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle('message-error', isError);
  statusMessage.hidden = text === '';
}

function showInputError(text) {
  inputError.textContent = text;
  inputError.hidden = text === '';
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('button')) {
    button.disabled = value;
  }
}

/** ボタンを1つ作る */
function createButton(label, ariaLabel, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
}

/** カード1枚分の部品を作る（タイトルは textContent で入れ、HTMLとして読ませない） */
function createCardElement(card, columnIndex) {
  const item = document.createElement('li');
  item.className = 'card';
  item.dataset.id = String(card.id);

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = card.title;
  header.append(
    title,
    createButton('×', `「${card.title}」を削除`, 'delete', () => removeCard(card)),
  );

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const left = COLUMNS[columnIndex - 1];
  const right = COLUMNS[columnIndex + 1];
  if (left) {
    actions.append(createButton('←', `「${card.title}」を${left.name}へ移動`, 'move-left',
      () => moveCard(card, left.id, 'move-left')));
  }
  if (right) {
    actions.append(createButton('→', `「${card.title}」を${right.name}へ移動`, 'move-right',
      () => moveCard(card, right.id, 'move-right')));
  }

  item.append(header, actions);
  return item;
}

/** cards の中身から画面を作りなおす */
function render() {
  COLUMNS.forEach((column, index) => {
    const section = board.querySelector(`[data-status="${column.id}"]`);
    const list = section.querySelector('.card-list');
    const columnCards = cards.filter((card) => card.status === column.id);

    section.querySelector('.count').textContent = `（${columnCards.length}）`;
    if (columnCards.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'カードはありません';
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(...columnCards.map((card) => createCardElement(card, index)));
    }
  });
}

/** 画面を作りなおしたあと、操作していたカードのボタンにフォーカスを戻す（キーボード操作用） */
function restoreFocus(cardId, className) {
  const cardElement = board.querySelector(`.card[data-id="${cardId}"]`);
  const target = cardElement?.querySelector(`.${className}`) ?? cardElement?.querySelector('button');
  (target ?? input).focus();
}

/**
 * 操作のたびに使う共通の流れ。
 * ① サーバーに送る → ② DBから一覧を読みなおす → ③ 画面を作りなおす
 */
async function run(action) {
  if (busy) return false;
  setBusy(true);
  try {
    await action();
    cards = await api('/api/cards');
    render();
    showStatus('');
    return true;
  } catch (error) {
    showStatus(`保存できませんでした：${error.message}`, true);
    return false;
  } finally {
    setBusy(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (title === '') {
    showInputError('タイトルを入力してください');
    input.focus();
    return;
  }
  showInputError('');
  const ok = await run(() => api('/api/cards', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }));
  if (ok) {
    input.value = '';
  }
  input.focus();
});

async function moveCard(card, status, className) {
  await run(() => api(`/api/cards/${card.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }));
  restoreFocus(card.id, className);
}

async function removeCard(card) {
  if (!window.confirm(`「${card.title}」を削除しますか？`)) {
    return;
  }
  await run(() => api(`/api/cards/${card.id}`, { method: 'DELETE' }));
  input.focus();
}

/** 開いたときにDBからカードを読みこむ */
async function load() {
  showStatus('読みこみ中…');
  try {
    cards = await api('/api/cards');
    render();
    showStatus('');
  } catch (error) {
    render();
    showStatus(`カードを読みこめませんでした：${error.message}`, true);
  }
}

load();
