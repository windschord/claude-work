# タスク管理書: Docker環境ターミナル描画不具合修正

## タスク一覧

### TASK-001: 遅延リサイズのテスト作成

**ステータス**: `DONE`
**見積もり**: 20分
**関連**: REQ-001, REQ-002, design.md 修正1-3
**完了サマリー**: 遅延リサイズ機能のテスト6件を追加。TDDのRED段階で4件が失敗することを確認。

#### 説明

DockerAdapter の遅延リサイズ機能に対するテストを作成する。
- resize()がlastKnownCols/Rowsを保存すること
- 初回出力受信後に遅延リサイズが実行されること
- セッションが存在しない場合やサイズ未設定の場合のエッジケース

#### 受入基準

- [x] resize()がsessionのlastKnownCols/Rowsを更新することを確認するテスト
- [x] 初回onDataで遅延リサイズタイマーが設定されることを確認するテスト
- [x] 遅延リサイズがptyProcess.resize()を呼ぶことを確認するテスト
- [x] lastKnownCols/Rowsが未設定の場合は遅延リサイズが実行されないことを確認するテスト
- [x] 2回目以降のonDataでは遅延リサイズが設定されないことを確認するテスト

---

### TASK-002: DockerAdapter.resize()にクライアントサイズ追跡を追加

**ステータス**: `DONE`
**見積もり**: 10分
**関連**: design.md 修正1, 修正2
**依存**: TASK-001
**完了サマリー**: DockerSession interfaceにlastKnownCols/lastKnownRowsを追加し、resize()でサイズを記憶するよう実装。

#### 説明

DockerSession interfaceにlastKnownCols/lastKnownRowsを追加し、
resize()メソッドで値を保存する。

#### 受入基準

- [x] DockerSession interfaceにlastKnownCols/lastKnownRows追加
- [x] resize()がセッションにサイズを保存
- [x] 既存のresize動作（ptyProcess.resize）に影響なし

---

### TASK-003: createSession()のonDataに遅延リサイズを追加

**ステータス**: `DONE`
**見積もり**: 15分
**関連**: design.md 修正3
**依存**: TASK-002
**完了サマリー**: createSession()のonDataハンドラで初回出力受信後に1秒遅延リサイズを実装。全39テストがパス。

#### 説明

createSession()のonDataハンドラで、初回出力受信後に
1秒の遅延を置いてリサイズを再実行する。

#### 受入基準

- [x] 初回出力受信時にhasReceivedOutput=trueかつ遅延リサイズタイマー設定
- [x] 1秒後にlastKnownCols/RowsでptyProcess.resize()を呼ぶ
- [x] 2回目以降のonDataでは遅延リサイズが重複実行されない
- [x] TASK-001のテストがすべてパスする

---

### TASK-004: 既存テストの確認

**ステータス**: `DONE`
**見積もり**: 10分
**関連**: NFR-002
**完了サマリー**: DockerAdapter 39テスト、HostAdapter 27テスト、全66テストがパス。既存機能への影響なし。

#### 説明

既存テストに影響がないことを確認する。

#### 受入基準

- [x] DockerAdapterの既存テストがパスする
- [x] HostAdapterのテストに影響がない
