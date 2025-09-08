# SendGrid Inbound Parse Webhook サーバー

SendGrid Inbound Parse Webhook を受信し、メールの詳細ログ表示、自動転送、キーワードベースのインテリジェントルーティング機能を提供する高機能サーバーです。

## 主な機能

### 高度なメール処理
- **完全メール解析**: ヘッダー、コンテンツ、添付ファイルを含むすべてのメールフィールドを抽出
- **Rawデータ表示**: 適切にセクション分けされた整形済みメールコンテンツ表示
- **バウンスメール処理**: 配信失敗メールを検出し、詳細なエラー情報を処理
- **転送メッセージ検出**: 転送メールコンテンツと件名を識別・抽出
- **MIME件名デコード**: 日本語などのエンコードされた件名を正しくデコード

### インテリジェントメール転送
- **SendGrid自動連携**: SendGrid API経由でメールを自動転送
- **件名ベースルーティング**: キーワードマッチングによる宛先別振り分け
- **多段階件名検出**: 転送メール、バウンスメール、通常メールから件名を解析
- **設定可能なルーティング**: 環境変数によるキーワードと宛先のカスタマイズ

### 包括的ログ機能
- **構造化コンソール出力**: 明確に整理された色分けセクション
- **リアルタイム処理状況**: メール分類とルーティング決定を表示
- **添付ファイル情報**: 転送メール検出を含む詳細な添付ファイル解析
- **JSONデータダンプ**: デバッグ用完全Rawデータエクスポート

## 必要環境
- Node.js 12以上
- メール転送用SendGrid APIキー

## セットアップ

### 1. 依存関係のインストール
```bash
git clone <リポジトリURL>
cd InboundParseWebhookSever
npm install
```

### 2. 環境変数の設定
サンプル環境ファイルをコピーして設定：
```bash
cp .env.example .env
```

`.env`ファイルを編集：
```env
# サーバー設定
PORT=3011
SENDGRID_API_KEY=your_sendgrid_api_key_here

# メールルーティング用件名キーワード（カンマ区切り）
SUBJECT_KEYWORDS_TYPE_A=invoice,receipt,payment
SUBJECT_KEYWORDS_TYPE_B=SendGrid,support,help,inquiry
SUBJECT_KEYWORDS_TYPE_C=bounce,undelivered,failure

# メール転送先設定
FORWARD_EMAIL_TYPE_A=accounting@example.com
FORWARD_EMAIL_TYPE_B=support@example.com
FORWARD_EMAIL_TYPE_C=admin@example.com
FORWARD_EMAIL_DEFAULT=default@example.com
```

## メールルーティングシステム

サーバーは件名キーワードに基づいて自動的にメールを分類・ルーティングします：

### Type A - 財務・業務関連
- **キーワード**: invoice, receipt, payment
- **用途**: 経理・財務関連書類
- **デフォルト転送先**: accounting@example.com

### Type B - サポート・コミュニケーション
- **キーワード**: SendGrid, support, help, inquiry
- **用途**: カスタマーサポート・技術的問い合わせ
- **デフォルト転送先**: support@example.com

### Type C - システムアラート
- **キーワード**: bounce, undelivered, failure
- **用途**: 配信失敗・システム通知
- **デフォルト転送先**: admin@example.com

### デフォルトルート
- **フォールバック**: 上記カテゴリに該当しないメール
- **デフォルト転送先**: default@example.com

## サーバー起動

### 本番モード
```bash
npm start
```

### 開発モード（自動リロード）
```bash
npm run dev
```

サーバーは設定されたポート（デフォルト：3011）で起動し、以下を表示します：
```
SendGrid API initialized
Server is running on port 3011
```

## SendGrid設定

### 1. Inbound Parse設定
1. SendGridダッシュボード：**Settings** > **Inbound Parse**
2. ホスト名を追加し、宛先URLを設定：
   ```
   http://<your-domain>:3011/inbound
   ```
3. 必要なオプション（添付ファイル、スパムチェック等）を有効化

### 2. APIキー設定
1. Mail Send権限を持つSendGrid APIキーを生成
2. `.env`ファイルの`SENDGRID_API_KEY`に追加

## APIエンドポイント

### POST /inbound
**SendGrid Inbound Parse用プライマリWebhookエンドポイント**

受信メールを処理し、以下を実行：
- すべてのメールフィールドと添付ファイルを解析
- 転送メッセージを検出し、元の件名を抽出
- バウンスメールの配信失敗詳細を解析
- 件名キーワードに基づくメール振り分け
- SendGrid経由で設定済み宛先へメール転送
- 包括的な処理情報をログ出力

### GET /
**ヘルスチェックエンドポイント**
戻り値：`SendGrid Inbound Parse Webhook Server is running`

## メール処理フロー

### 1. メール受信
```
================================================================================
INBOUND EMAIL RECEIVED
================================================================================
Timestamp: 2025-09-08T03:03:18.137Z
```

### 2. コンテンツ解析
- **基本情報**: From、To、CC、BCC、Subject
- **セキュリティ**: DKIM、SPF検証
- **コンテンツ**: テキスト、HTML、Rawメールデータ
- **添付ファイル**: 転送メール用特別処理を含むファイル解析

### 3. 件名検出優先順位
1. **転送メッセージ件名**（最高優先度）
   - `---------- Forwarded message ----------`セクションから
   - バウンスメール内埋め込みメッセージから
2. **元メール件名**（中優先度）
   - バウンスメールメタデータから
3. **現在メール件名**（最低優先度）
   - 受信メールヘッダーから

### 4. MIME件名デコード
```
Subject 2 (raw): "=?UTF-8?B?W+OBvuOCi+OBkOODqeODs+ODiV1IZWxsbw==?= from SendGrid + curl"
Decoded Base64: "W+OBvuOCk+OBkOODqeODs+ODiV1IZWxsbw==" -> "[まるぐらんど]Hello"
Subject 2 (decoded): "[まるぐらんど]Hello from SendGrid + curl"
```

### 5. メール分類
```
EMAIL CLASSIFICATION:
  Subject analyzed: "[まるぐらんど]Hello from SendGrid + curl"
  Email Type: TYPE_B
  Forward To: support@example.com
```

### 6. 自動転送
- 元コンテンツ付き整形メールを送信
- バウンスメール用配信失敗詳細を含める
- 元メールデータを`.eml`ファイルとして添付
- 包括的転送ログを提供

## 高度な機能

### バウンスメール処理
配信失敗を自動検出し、以下を抽出：
- **失敗宛先**: 元の配信先メールアドレス
- **失敗理由**: 詳細エラーメッセージ
- **元メッセージ**: 完全な元メールコンテンツ
- **配信ステータス**: SMTPレスポンスコードと診断情報

### 転送メッセージ処理
様々な形式の転送メールを識別：
- Gmail転送メッセージ
- Outlook転送メッセージ
- 日本語メールクライアント形式
- カスタム転送パターン

### 添付ファイル処理
- **完全ファイル情報**: 名前、タイプ、サイズ
- **メール添付検出**: `.eml`および`message/rfc822`ファイルを識別
- **プレビュー生成**: メール添付ファイル用コンテンツプレビュー表示
- **セキュリティ情報**: ファイルタイプ検証とサイズ制限

## トラブルシューティング

### よくある問題

1. **SendGrid APIキー問題**
   ```
   Warning: SENDGRID_API_KEY not found in environment variables
   ```
   解決方法：`.env`ファイルでAPIキーが適切に設定されているか確認

2. **メール転送失敗**
   詳細エラーメッセージのコンソール出力を確認し、以下を検証：
   - APIキー権限
   - 送信者ドメイン認証
   - 受信者メールアドレス有効性

3. **件名検出問題**
   詳細ログを有効にして件名検出プロセスを確認：
   ```
   Searching for Subject in email field...
   Found forwarded subject: "Your Subject Here"
   ```

### デバッグモード
サーバーはデフォルトで詳細ログを提供します。以下を追跡するためコンソール出力を監視：
- メール処理段階
- 件名検出結果
- ルーティング決定
- 転送ステータス

## 開発

### ファイル構造
```
├── index.js          # メインサーバーアプリケーション
├── package.json      # 依存関係とスクリプト
├── .env.example      # 環境設定テンプレート
├── README.md         # このドキュメント
└── .gitignore       # Gitignoreパターン
```

### 機能拡張
ルーティングシステムは各メールタイプ用カスタム処理をサポートします（`index.js`の245-262行目のswitchステートメント）：

```javascript
switch (emailType) {
  case 'TYPE_A':
    console.log('Processing as TYPE_A');
    // 請求書処理ロジックをここに追加
    break;
  case 'TYPE_B':
    console.log('Processing as TYPE_B');
    // サポートチケットロジックをここに追加
    break;
  case 'TYPE_C':
    console.log('Processing as TYPE_C');
    // バウンス処理ロジックをここに追加
    break;
  default:
    console.log('Processing as DEFAULT type');
    // デフォルト処理ロジックをここに追加
    break;
}
```

## ライセンス

MIT License - 詳細はLICENSEファイルを参照してください。

---

サポートや機能要求については、リポジトリでissueを作成してください。