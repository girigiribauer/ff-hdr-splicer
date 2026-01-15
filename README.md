# FF HDR Splicer

ffmpeg を内部で利用して、HDR動画（HT.2020 / PQ / HLG）のトリミング・スライスができるデスクトップアプリです。

## ユーザーガイド (For Users)

### インストールと起動

GitHub の Releases ページからダウンロードしたアプリを実行する際、OSのセキュリティ機能により起動がブロックされる場合があります。

#### macOS: "App is damaged" (壊れているため開けません) と出る場合

Apple Silicon (M1/M2/etc) 環境では、Webからダウンロードした未署名（Ad-hoc署名）アプリは「壊れている」と判定されます。以下のいずれかの方法で回避してください。

**方法1: GUIツールを使用する (推奨)**
1.  オープンソースのツール **[Sentinel](https://github.com/alienator88/Sentinel/releases)** をダウンロードして起動します。
2.  `FF HDR Splicer.app` を Sentinel のウィンドウにドラッグ＆ドロップします。
3.  これで起動できるようになります。

**方法2: ターミナルを使用する**
ターミナルを開き、以下のコマンドを実行して属性を削除します。

```bash
xattr -cr /path/to/extracted/FF\ HDR\ Splicer.app
# 例: xattr -cr /Applications/FF\ HDR\ Splicer.app
```

### 使い方

1.  アプリを起動し、「Choose File」から編集したい動画ファイルを選択します。
2.  タイムラインでカットしたい区間を指定・分割します。
3.  「Delete」キーで不要な区間を削除したりできます。
4.  右上の「Export」ボタンを押すと、編集された動画が書き出されます（ffmpegによるロスレス結合ではありませんが、高品質で書き出されます）。

---

## 開発者向けドキュメント (For Developers)

### 開発・テスト

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm run test
```

### ビルド

手元でビルドする場合、**現在作業しているOS用のバイナリ** しか同梱されません。

```bash
# Mac用ビルド (.dmg)
npm run build:mac

# Windows用ビルド (.exe)
# ※注意: Windows機で実行すること
npm run build:win
```

### リリース

GitHub Actions を使ってクロスプラットフォームビルドを行います。

1.  **コミット & Push**: `main` ブランチにプッシュすると、CI (`.github/workflows/ci.yml`) が走り、Mac/Win 両方でスモークテストが行われます。
2.  **タグ付け**: リリース準備ができたらタグを打ちます（`v` 必須）。
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
3.  **公開**:
    GitHub Actions がドラフトリリースを作成するので、Releases ページで確認し「Publish」ボタンを押して公開します。
