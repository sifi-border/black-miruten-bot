/**
 * アプリケーション内で使う日本語の文言を一元管理するファイル。
 * コード側の変更なしに文言だけ調整できるように、ロジックからは分離してある。
 */
export const messages = {
  env: {
    missingDiscordToken: "環境変数 DISCORD_TOKEN が設定されていません。",
    missingDiscordClientId: "環境変数 DISCORD_CLIENT_ID が設定されていません。",
  },

  deploy: {
    registeringToGuild: (guildId: string) => `ギルド(${guildId})にコマンドを登録します...`,
    registeringGlobally: "グローバルにコマンドを登録します...",
    registrationTargets: (commandNames: string) => `登録対象: ${commandNames}`,
    registrationComplete: (count: number) => `${count}個のコマンドを登録しました。`,
    registrationFailed: "コマンド登録に失敗しました:",
  },

  interactionReceived: {
    log: (commandName: string, userTag: string, guildId: string | null) =>
      `[${commandName}] ${userTag} が実行しました (guild: ${guildId ?? "DM"})`,
  },

  interactionError: {
    log: (commandName: string) => `[${commandName}] コマンド実行中にエラーが発生しました:`,
    reply: "コマンドの実行中にエラーが発生しました。",
  },

  loadCommands: {
    invalidCommandWarning: (file: string) =>
      `[loadCommands] ${file} からコマンドを読み込めませんでした(data/executeが見つかりません)`,
  },

  mirutenSay: {
    commandDescription: "みるてんに好きなことを言わせよう！",
    messageOptionDescription: "メッセージ",
    messageTooLong:
      "メッセージが長すぎるため吹き出しを生成できませんでした。もう少し短くして再度お試しください。",
    imageLoadErrorLog: (path: string) => `[miruten-say] 画像の読み込みに失敗しました: ${path}`,
    imageLoadErrorReply:
      "画像の読み込みに失敗したため投稿できませんでした。管理者に連絡してください。",
  },

  images: {
    defaultLabel: "デフォルト",
  },
} as const;
