export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Claude Work
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          ClaudeWorkプロジェクトへようこそ
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          ダッシュボード
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          プロジェクト管理機能は今後実装予定です。
        </p>
      </div>
    </div>
  );
}
