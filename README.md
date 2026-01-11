# FF HDR Splicer

ffmpeg を内部で利用して、HDR動画（HT.2020 / PQ / HLG）のトリミング・スライスができるデスクトップアプリです。
Electron + SolidJS + Vite で構築されています。

## プロジェクト構成

*   **electron/**: Mainプロセス。ファイルシステム操作や `child_process` (ffmpeg) の実行を担当します。

## 開発・テスト

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm run test
```

## ビルド

手元でビルドする場合、**現在作業しているOS用のバイナリ** しか同梱されません。
（例: Macで `build:win` をしても、中身の ffmpeg は Mac用のままになり、Windowsで動きません！）

```bash
# Mac用ビルド (.dmg)
npm run build:mac

# Windows用ビルド (.exe)
# ※注意: Windows機で実行すること
npm run build:win
```

## リリース

GitHub Actions を使ってクロスプラットフォームビルドを行います。

1.  **コミット & Push**: `main` ブランチにプッシュすると、CI (`.github/workflows/ci.yml`) が走り、Mac/Win 両方でスモークテストが行われます。
2.  **タグ付け**: リリース準備ができたらタグを打ちます（`v` 必須）。
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
3.  **公開**:
    GitHub Actions がドラフトリリースを作成するので、Releases ページで確認し「Publish」ボタンを押して公開します。

## 環境設定の注意点

*   **package-lock.json**: `ffmpeg-static` のバージョンを固定するために必須です。
*   **Sign Off (Mac)**: 開発用ビルドの高速化とログの匿名化のため、`package.json` で `mac.identity: null` (署名なし) に設定しています。
