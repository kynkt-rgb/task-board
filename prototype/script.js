// タスクボード プロトタイプ
// 本物のアプリはサーバー（API）とDBを使うが、ここでは配列にデータを持って「それらしく」動かす。
// サーバーとのやりとりは fakeApi にまとめ、少し待ち時間を入れて通信中の見え方も確かめられるようにしている。

const STATUSES = ['todo', 'doing', 'done'];
const MAX_LENGTH = 50;
const WAIT_MS = 400; // 通信にかかる時間のまね

// ---- 見本データ（画面設計書のレイアウト図と同じ内容） ----
function sampleCards() {
  return [
    { id: 1, title: '宿題', status: 'todo' },
    { id: 2, title: '買い物', status: 'todo' },
    { id: 3, title: 'そうじ', status: 'doing' },
    { id: 4, title: '歯みがき', status: 'done' },
  ];
}

// ---- にせのサーバー ----
const fakeApi = {
  cards: sampleCards(),
  nextId: 5,
  saveError: false,   // 確認用パネルで切りかえる
  loadError: false,

  wait() {
    return new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  },
  async list() {
    await this.wait();
    if (this.loadError) throw new Error('サーバーに接続できません');
    return this.cards.map((c) => ({ ...c }));
  },
  async add(title) {
    await this.wait();
    if (this.saveError) throw new Error('サーバーに接続できません');
    this.cards.push({ id: this.nextId++, title, status: 'todo' });
  },
  async move(id, to) {
    await this.wait();
    if (this.saveError) throw new Error('サーバーに接続できません');
    const card = this.cards.find((c) => c.id === id);
    const diff = Math.abs(STATUSES.indexOf(card.status) - STATUSES.indexOf(to));
    if (diff !== 1) throw new Error('となりの列にしか動かせません');
    // 移動先の一番下に入れるため、いったん取りだして最後に入れなおす
    this.cards = this.cards.filter((c) => c.id !== id);
    this.cards.push({ ...card, status: to });
  },
  async remove(id) {
    await this.wait();
    if (this.saveError) throw new Error('サーバーに接続できません');
    this.cards = this.cards.filter((c) => c.id !== id);
  },
};

// ---- 画面の部品 ----
const form = document.getElementById('add-form');
const input = document.getElementById('title-input');
const addButton = document.getElementById('add-button');
const inputError = document.getElementById('input-error');
const statusMessage = document.getElementById('status');

let cards = [];
let busy = false;

// 絵文字も1文字と数える
function countChars(text) {
  if (window.Intl && Intl.Segmenter) {
    return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].length;
  }
  return [...text].length;
}

function showInputError(text) {
  inputError.textContent = text;
  inputError.hidden = !text;
}

function showStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.hidden = !text;
  statusMessage.classList.toggle('is-error', isError);
}

function setBusy(value) {
  busy = value;
  addButton.disabled = value;
  document.querySelectorAll('.card button').forEach((b) => { b.disabled = value; });
}

// ---- 描画 ----
function render(focusTarget) {
  STATUSES.forEach((status, index) => {
    const column = document.querySelector(`.column[data-status="${status}"]`);
    const list = column.querySelector('.card-list');
    const inColumn = cards.filter((c) => c.status === status);

    column.querySelector('.count').textContent = `（${inColumn.length}）`;
    list.replaceChildren();

    if (inColumn.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'カードはありません'; // M-06
      list.append(empty);
      return;
    }

    inColumn.forEach((card) => {
      list.append(createCard(card, index));
    });
  });

  // 操作したあと、フォーカスが迷子にならないようにする
  if (focusTarget) {
    const el = document.querySelector(focusTarget);
    (el || input).focus();
  }
}

function createCard(card, index) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.id = card.id;

  const top = document.createElement('div');
  top.className = 'card-top';

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = card.title; // HTMLとして読みこまない

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-button';
  del.textContent = '×';
  del.setAttribute('aria-label', `「${card.title}」を削除`);
  del.addEventListener('click', () => removeCard(card));

  top.append(title, del);

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (index > 0) {
    const left = makeMoveButton('←', `「${card.title}」を${label(STATUSES[index - 1])}へ移動`, 'move-left');
    left.addEventListener('click', () => moveCard(card, STATUSES[index - 1], 'move-left'));
    actions.append(left);
  }
  if (index < STATUSES.length - 1) {
    const right = makeMoveButton('→', `「${card.title}」を${label(STATUSES[index + 1])}へ移動`, 'move-right');
    right.addEventListener('click', () => moveCard(card, STATUSES[index + 1], 'move-right'));
    actions.append(right);
  }

  li.append(top, actions);
  return li;
}

function makeMoveButton(text, ariaLabel, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

function label(status) {
  return { todo: 'やること', doing: '進行中', done: '完了' }[status];
}

// ---- 操作 ----
async function load() {
  cards = [];
  render();
  showStatus('読みこみ中…'); // M-03
  setBusy(true);
  try {
    cards = await fakeApi.list();
    showStatus('');
  } catch (err) {
    showStatus(`カードを読みこめませんでした：${err.message}`, true); // M-05
  } finally {
    setBusy(false);
    render();
  }
}

// 保存して、成功したら一覧を読みなおす（本物と同じ流れ）
async function save(action, focusTarget) {
  setBusy(true);
  try {
    await action();
    cards = await fakeApi.list();
    showStatus('');
    return true;
  } catch (err) {
    showStatus(`保存できませんでした：${err.message}`, true); // M-04
    return false;
  } finally {
    setBusy(false);
    render(focusTarget);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;

  const title = input.value.trim();
  if (title === '') {
    showInputError('タイトルを入力してください'); // M-01
    input.focus();
    return;
  }
  if (countChars(title) > MAX_LENGTH) {
    showInputError(`タイトルは${MAX_LENGTH}文字までです`);
    input.focus();
    return;
  }
  showInputError('');

  const ok = await save(() => fakeApi.add(title), '#title-input');
  if (ok) input.value = ''; // 失敗したときは文字を残す
});

function moveCard(card, to, buttonClass) {
  if (busy) return;
  // 移動したカードの同じ向きのボタンにフォーカスを戻す（なければ反対向き）
  const other = buttonClass === 'move-left' ? 'move-right' : 'move-left';
  save(() => fakeApi.move(card.id, to), `.card[data-id="${card.id}"] .${buttonClass}, .card[data-id="${card.id}"] .${other}`);
}

function removeCard(card) {
  if (busy) return;
  if (!confirm(`「${card.title}」を削除しますか？`)) return; // M-02
  save(() => fakeApi.remove(card.id), '#title-input');
}

// ---- 確認用パネル（本番にはない） ----
document.getElementById('sim-save-error').addEventListener('change', (event) => {
  fakeApi.saveError = event.target.checked;
});
document.getElementById('sim-load-error').addEventListener('click', async () => {
  fakeApi.loadError = true;
  await load();
  fakeApi.loadError = false;
});
document.getElementById('sim-reload').addEventListener('click', () => {
  fakeApi.cards = sampleCards();
  fakeApi.nextId = 5;
  showInputError('');
  input.value = '';
  load();
});

load();
