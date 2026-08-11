/**
 * アプリケーション内で使う日本語の文言を一元管理するファイル。
 * コード側の変更なしに文言だけ調整できるように、ロジックからは分離してある。
 */
export const messages = {
  env: {
    missingDiscordToken: "環境変数 DISCORD_TOKEN が設定されていません。",
    missingDiscordClientId: "環境変数 DISCORD_CLIENT_ID が設定されていません。",
    missingMongodbUri: "環境変数 MONGODB_URI が設定されていません。",
  },

  deploy: {
    registeringToGuild: (guildId: string) => `ギルド(${guildId})にコマンドを登録します...`,
    registeringGlobally: "グローバルにコマンドを登録します...",
    registrationTargets: (commandNames: string) => `登録対象: ${commandNames}`,
    registrationComplete: (count: number) => `${count}個のコマンドを登録しました。`,
    registrationCompleteForGuild: (count: number, guildId: string) =>
      `${count}個のコマンドをギルド(${guildId})に登録しました。`,
    registrationFailed: "コマンド登録に失敗しました:",
    registrationFailedForGuild: (guildId: string) => `ギルド(${guildId})への登録に失敗しました:`,
    registrationSummaryFailed: (guildIds: string) =>
      `一部のギルドで登録に失敗しました: ${guildIds}`,
  },

  interactionReceived: {
    log: (commandName: string, userTag: string, guildId: string | null) =>
      `[${commandName}] ${userTag} が実行しました (guild: ${guildId ?? "DM"})`,
  },

  interactionError: {
    log: (commandName: string) => `[${commandName}] コマンド実行中にエラーが発生しました:`,
    reply: "コマンドの実行中にエラーが発生しました。",
    replyFailedLog: (commandName: string) => `[${commandName}] エラー内容の返信にも失敗しました:`,
  },

  clientError: {
    log: "Discordクライアントでエラーが発生しました:",
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

  introQuiz: {
    commandDescription: "イントロクイズを開始・操作します。",
    startDescription: "イントロクイズを開始します。",
    skipDescription: "現在の問題をスキップします。",
    stopDescription: "イントロクイズを終了します。",
    scoreDescription: "現在のスコアを表示します。",
    countOptionDescription: "出題数(デフォルト: 5問)",
    playSecondsOptionDescription: "1問あたりの再生時間(秒、デフォルト: 8秒)",
    answerSecondsOptionDescription: "回答受付時間(秒、デフォルト: 15秒)",
    modeOptionDescription: "再生モード(デフォルト: イントロ)",
    modeChoiceIntro: "イントロ",
    modeChoiceRandom: "ランダム",
    guildOnly: "このコマンドはサーバー内でのみ実行できます。",
    mustRunInNormalChannel:
      "このコマンドはスレッド内では実行できません。通常のチャンネルで実行してください。",
    mustBeInVoiceChannel: "ボイスチャンネルに参加してから実行してください。",
    sessionAlreadyActive: "このサーバーではすでにイントロクイズが進行中です。",
    emptyQuestionPool:
      "問題が登録されていません。`npm run seed-questions` で問題を登録してください。",
    noActiveSession: "進行中のイントロクイズがありません。",
    skipped: "現在の問題をスキップしました。",
    stopAccepted: "イントロクイズを終了します。",
    voiceJoinFailed: "ボイスチャンネルへの接続に失敗しました。",
    voiceConnectionStateChange: (guildId: string, oldStatus: string, newStatus: string) =>
      `[introquiz] ギルド(${guildId})のVoiceConnection状態変化: ${oldStatus} -> ${newStatus}`,
    voiceConnectionError: (guildId: string) =>
      `[introquiz] ギルド(${guildId})のVoiceConnectionでエラーが発生しました:`,
    threadCreateFailed: "スレッドの作成に失敗しました。",
    startedWithClampedCount: (count: number) =>
      `登録されている問題数の都合上、${count}問で開始します。`,
    threadName: (startedAt: string) => `🎵イントロクイズ #${startedAt}`,
    threadCreateReason: "イントロクイズ用スレッド",
    startReply: (threadUrl: string) => `イントロクイズを開始しました! ${threadUrl}`,
    questionStart: (number: number, total: number, playSeconds: number) =>
      `第${number}問 / 全${total}問 スタート!(${playSeconds}秒間再生)`,
    answerCorrect: (userId: string, title: string, artist: string) =>
      `🎉 <@${userId}> 正解!\n正解: 「${title}」 / ${artist}`,
    answerTimeout: (title: string, artist: string) =>
      `⏱️ 正解者なし\n正解: 「${title}」 / ${artist}`,
    voiceDisconnected: "ボイスチャンネルから切断されたため、イントロクイズを終了しました。",
    unexpectedErrorLog: (guildId: string) =>
      `[introquiz] ギルド(${guildId})でエラーが発生したためセッションを終了しました:`,
    unexpectedError: "予期しないエラーが発生したため、イントロクイズを終了しました。",
    scoreboardTitle: (current: number, total: number) =>
      `📊 現在のスコア (${current}/${total}問終了)`,
    finalScoreboardTitle: "🏁 最終結果",
    scoreboardEmpty: "まだ得点はありません。",
    scoreboardLine: (rank: number, userId: string, score: number) =>
      `${rank}位  <@${userId}>  ${score}pt`,
  },

  seedQuestions: {
    usage: "使い方: npm run seed-questions -- <questions.jsonのパス>",
    inserted: (count: number) => `${count}件の問題を登録しました。`,
    failed: "問題の登録に失敗しました:",
  },

  images: {
    defaultLabel: "デフォルト",
  },

  health: {
    listening: (port: number) => `ヘルスチェックサーバーがポート${port}で待受を開始しました`,
    startError: "ヘルスチェックサーバーの起動に失敗しました:",
  },
} as const;
